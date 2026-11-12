import json

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import ApplicationError
from app.modules.sessions import look


def valid_look(**changes) -> dict:
    body = {
        "hat": "beret",
        "body": "scarf",
        "glasses": False,
        "hat_color": "#b94c35",
        "outfit_color": "#edce84",
        "accent_color": "#235c50",
        "wall": ["#f7f0e1", "#f3ead8"],
        "decor": [{"icon": "palette", "place": "wall"}, {"icon": "brush", "place": "floor"}],
        "description": "Ayni se puso una boina de pintor y colgó un cuadro con una paleta.",
    }
    body.update(changes)
    return body


@pytest.fixture
def provider(monkeypatch):
    look._cache.clear()
    calls = []
    monkeypatch.setattr(look.time, "sleep", lambda _: None)
    monkeypatch.setattr(
        look, "get_settings", lambda: Settings(groq_api_key="test-only", groq_model="chat-model")
    )
    real_client = httpx.Client

    def setup(*bodies):
        replies = list(bodies)

        def respond(request):
            calls.append(json.loads(request.content))
            body = replies.pop(0) if len(replies) > 1 else replies[0]
            return httpx.Response(
                200, json={"choices": [{"message": {"content": json.dumps(body)}}]}
            )

        monkeypatch.setattr(
            look.httpx,
            "Client",
            lambda **_: real_client(transport=httpx.MockTransport(respond)),
        )

    setup(valid_look())
    return calls, setup


def test_ai_designs_a_look_for_any_interest_and_only_receives_interests(provider):
    calls, _ = provider
    result = look.generate_look(["pintar acuarelas", "ajedrez"], ["Mis ollas preferidas"])
    assert result.hat == "beret"
    assert [item.icon for item in result.decor] == ["palette", "brush"]
    sent = json.loads(calls[0]["messages"][1]["content"])
    assert sent == {
        "gustos": ["pintar acuarelas", "ajedrez"],
        "recuerdos_de_la_sesion": ["Mis ollas preferidas"],
        "variante": 0,
    }
    look.generate_look(["pintar acuarelas", "ajedrez"], ["Mis ollas preferidas"])
    assert len(calls) == 1  # el mismo look se reutiliza sin volver a llamar a la IA


def test_another_variant_asks_again_with_more_variety(provider):
    calls, _ = provider
    look.generate_look(["cocinar"], [])
    look.generate_look(["cocinar"], [], variant=1)
    assert len(calls) == 2
    assert calls[1]["temperature"] > calls[0]["temperature"]


def test_dark_walls_are_replaced_and_repeated_objects_dropped(provider):
    _, setup = provider
    setup(
        valid_look(
            wall=["#202020", "#f3ead8"],
            decor=[{"icon": "dog", "place": "floor"}, {"icon": "dog", "place": "wall"}],
        )
    )
    result = look.generate_look(["mi perro"], [])
    assert result.wall == ["#f7f0e1", "#f3ead8"]
    assert [item.icon for item in result.decor] == ["dog"]


@pytest.mark.parametrize(
    "bad",
    [
        valid_look(hat="<script>"),
        valid_look(hat_color="red"),
        valid_look(extra="campo"),
    ],
)
def test_pieces_outside_the_catalogue_are_rejected(provider, bad):
    _, setup = provider
    setup(bad)
    with pytest.raises(ApplicationError) as error:
        look.generate_look(["leer"], [])
    assert error.value.code == "look_ai_unavailable"


def test_without_interests_or_key_there_is_no_ai_call(provider, monkeypatch):
    calls, _ = provider
    with pytest.raises(ApplicationError) as empty:
        look.generate_look([" "], [])
    assert empty.value.code == "look_needs_interests"
    monkeypatch.setattr(look, "get_settings", lambda: Settings(groq_api_key=""))
    with pytest.raises(ApplicationError) as offline:
        look.generate_look(["leer"], [])
    assert offline.value.code == "look_ai_unavailable"
    assert not calls


def test_unknown_objects_are_dropped_without_losing_the_look(provider):
    _, setup = provider
    setup(valid_look(decor=[{"icon": "skull", "place": "wall"}, {"icon": "dog", "place": "floor"}]))
    result = look.generate_look(["mi perro"], [])
    assert [item.icon for item in result.decor] == ["dog"]


def test_a_busy_provider_is_retried_once_after_a_short_wait(provider, monkeypatch):
    calls, _ = provider
    real_client = httpx._client.Client  # el fixture ya reemplazó httpx.Client
    replies = [
        httpx.Response(429, headers={"retry-after": "1"}, json={"error": {}}),
        httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(valid_look())}}]}),
    ]

    def respond(request):
        calls.append(json.loads(request.content))
        return replies.pop(0)

    monkeypatch.setattr(
        look.httpx, "Client", lambda **_: real_client(transport=httpx.MockTransport(respond))
    )
    assert look.generate_look(["leer"], []).hat == "beret"
    assert len(calls) == 2
