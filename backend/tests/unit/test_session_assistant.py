import base64
import json
from io import BytesIO

import httpx
import pytest
from PIL import Image

from app.core.config import Settings
from app.core.errors import ApplicationError
from app.modules.sessions import assistant


def photo() -> str:
    output = BytesIO()
    Image.new("RGB", (16, 12), "green").save(output, format="PNG")
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode()


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setattr(assistant.time, "sleep", lambda _: None)
    calls = []
    settings = Settings(
        groq_api_key="test-only", groq_model="chat-model", groq_vision_model="vision-model"
    )
    monkeypatch.setattr(assistant, "get_settings", lambda: settings)

    # Guardar la clase antes del reemplazo evita construir recursivamente el cliente.
    real_client = httpx.Client

    def setup(content=None, status=200):
        def respond(request):
            calls.append(json.loads(request.content))
            body = (
                content
                if content is not None
                else {
                    "message": "Mencionaste los árboles del parque. ¿Qué te gustaba hacer allí?",
                    "suggestion": "continue",
                    "observations": ["Árboles verdes"],
                }
            )
            return httpx.Response(
                status, json={"choices": [{"message": {"content": json.dumps(body)}}]}
            )

        monkeypatch.setattr(
            assistant.httpx,
            "Client",
            lambda **_: real_client(transport=httpx.MockTransport(respond)),
        )

    setup()
    return calls, settings, setup


def test_provider_receives_the_actual_reply_and_recent_context_not_a_question_catalogue(provider):
    calls, _, _ = provider
    result = assistant.generate_reply(
        assistant.ChatRequest(text="Me gustaba cantar en el parque"),
        context=["Un paseo familiar"],
        history=[{"role": "assistant", "content": "¿Qué hacían?"}],
    )
    payload = calls[0]
    assert payload["model"] == "chat-model"
    assert payload["messages"][-1]["content"] == "Me gustaba cantar en el parque"
    assert payload["messages"][-2]["content"] == "¿Qué hacían?"
    assert "opciones" not in json.dumps(payload)
    assert result.message.startswith("Mencionaste")
    assert result.observations == []


def test_vision_sends_only_a_clean_image_and_uses_the_vision_model(provider):
    calls, _, _ = provider
    result = assistant.generate_reply(
        assistant.ChatRequest(text="¿Qué ves?", image=photo(), image_consent=True),
        context=[],
        history=[],
    )
    assert calls[0]["model"] == "vision-model"
    url = calls[0]["messages"][-1]["content"][1]["image_url"]["url"]
    assert url.startswith("data:image/jpeg;base64,")
    with Image.open(BytesIO(base64.b64decode(url.split(",")[1]))) as image:
        assert image.size == (16, 12)
        assert not image.getexif()
    assert result.observations == ["Árboles verdes"]


def test_image_requires_explicit_consent_before_contacting_provider(provider):
    calls, _, _ = provider
    with pytest.raises(ApplicationError) as error:
        assistant.generate_reply(assistant.ChatRequest(image=photo()), context=[], history=[])
    assert error.value.code == "conversation_image_consent_required"
    assert not calls


@pytest.mark.parametrize(
    "image",
    [
        "https://private.example.test/photo",
        "data:image/jpeg;base64,invalid",
        "data:text/html;base64,AAAA",
    ],
)
def test_images_cannot_be_external_urls_or_invalid_data(provider, image):
    calls, _, _ = provider
    with pytest.raises(ApplicationError) as error:
        assistant.generate_reply(
            assistant.ChatRequest(image=image, image_consent=True), context=[], history=[]
        )
    assert error.value.code == "conversation_image_invalid"
    assert not calls


def test_missing_key_is_an_explicit_error_and_never_a_fake_ai_reply(provider):
    calls, settings, _ = provider
    settings.groq_api_key = ""
    with pytest.raises(ApplicationError) as error:
        assistant.generate_reply(assistant.ChatRequest(text="Hola"), context=[], history=[])
    assert error.value.code == "conversation_ai_not_configured"
    assert not calls


@pytest.mark.parametrize(
    "status,body",
    [
        (429, {}),
        (500, {}),
        (200, {"choice": 1}),
        (200, {"message": "Te diagnostico una enfermedad", "suggestion": "continue"}),
    ],
)
def test_provider_failures_or_invalid_claims_do_not_return_predefined_answers(
    provider, status, body
):
    _, _, setup = provider
    setup(content=body, status=status)
    with pytest.raises(ApplicationError) as error:
        assistant.generate_reply(assistant.ChatRequest(text="Hola"), context=[], history=[])
    assert error.value.code == "conversation_ai_unavailable"


def test_contacts_are_removed_before_sending_text_and_history(provider):
    calls, _, _ = provider
    assistant.generate_reply(
        assistant.ChatRequest(text="mi correo prueba@example.com y teléfono 987654321"),
        context=["https://example.com"],
        history=[{"role": "user", "content": "otra@example.com"}],
    )
    data = json.dumps(calls[0])
    assert "prueba@example.com" not in data
    assert "987654321" not in data
    assert "otra@example.com" not in data


def test_reply_keeps_only_one_question(provider):
    _, _, setup = provider
    setup(
        content={
            "message": "Hola, ¿cómo estás? Mencionaste el parque. ¿Qué te gustaba mirar?",
            "suggestion": "continue",
            "observations": [],
        }
    )
    reply = assistant.generate_reply(assistant.ChatRequest(text="Hola"), context=[], history=[])
    assert reply.message.count("?") == 1
    assert "Mencionaste el parque" in reply.message


@pytest.mark.parametrize("failure", ["timeout", "http", "format", "truncated"])
def test_transient_failure_recovers_without_a_fake_reply(monkeypatch, failure):
    monkeypatch.setattr(assistant, "get_settings", lambda: Settings(groq_api_key="test"))
    monkeypatch.setattr(assistant.time, "sleep", lambda _: None)
    calls = []
    real_client = httpx.Client

    def respond(request):
        calls.append(json.loads(request.content))
        if len(calls) == 1:
            if failure == "timeout":
                raise httpx.ReadTimeout("timeout", request=request)
            if failure == "http":
                return httpx.Response(502)
            content = '{"message":' if failure == "truncated" else '{"other":true}'
        else:
            content = json.dumps(
                {
                    "message": "Me contaste que te gustan los helados. ¿Cuál prefieres?",
                    "suggestion": "continue",
                    "observations": [],
                }
            )
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    monkeypatch.setattr(
        assistant.httpx, "Client", lambda **_: real_client(transport=httpx.MockTransport(respond))
    )
    result = assistant.generate_reply(
        assistant.ChatRequest(text="Los helados"), context=[], history=[]
    )
    assert "helados" in result.message
    assert len(calls) == 2
    assert calls[0]["messages"][-1] == calls[1]["messages"][-1]
    assert calls[0]["response_format"]["json_schema"]["strict"] is True
    assert calls[0]["reasoning_effort"] == "low"


@pytest.mark.parametrize("status,headers", [(401, {}), (429, {"Retry-After": "60"})])
def test_credentials_and_long_rate_limits_do_not_trigger_repeated_requests(
    monkeypatch, status, headers
):
    monkeypatch.setattr(assistant, "get_settings", lambda: Settings(groq_api_key="test"))
    real_client = httpx.Client
    calls = []

    def respond(request):
        calls.append(request)
        return httpx.Response(status, headers=headers)

    monkeypatch.setattr(
        assistant.httpx, "Client", lambda **_: real_client(transport=httpx.MockTransport(respond))
    )
    with pytest.raises(ApplicationError):
        assistant.generate_reply(assistant.ChatRequest(text="Hola"), context=[], history=[])
    assert len(calls) == 1


def test_ambiguous_input_can_receive_clarification_as_a_normal_turn(provider):
    calls, _, setup = provider
    setup(
        content={
            "message": "No entendí bien esa parte. ¿Me la cuentas de otra manera?",
            "suggestion": "continue",
            "observations": [],
        }
    )
    result = assistant.generate_reply(
        assistant.ChatRequest(text="Eso de allá, antes"), context=[], history=[]
    )
    assert result.suggestion == "continue"
    assert "No entendí bien" in result.message
    assert len(calls) == 1
