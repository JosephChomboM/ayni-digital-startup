import json
from types import SimpleNamespace

import httpx
import pytest
from pydantic import ValidationError

from app.core.errors import ApplicationError
from app.modules.assistant import service


def request():
    return service.TurnRequest(
        instruction="Abre mis recuerdos",
        screen=service.Screen(
            page="home",
            text="Espacio familiar",
            controls=[service.Control(id="memories", label="Recuerdos", kind="click")],
        ),
    )


def provider(monkeypatch, reply):
    monkeypatch.setattr(
        service,
        "get_settings",
        lambda: SimpleNamespace(
            groq_api_key="test-only",
            groq_model="openai/gpt-oss-20b",
            conversation_timeout_seconds=5,
        ),
    )
    client = httpx.Client
    monkeypatch.setattr(
        service.httpx,
        "Client",
        lambda **kwargs: client(
            transport=httpx.MockTransport(
                lambda _: httpx.Response(
                    200, json={"choices": [{"message": {"content": json.dumps(reply)}}]}
                )
            )
        ),
    )


def test_action_uses_only_offered_controls(monkeypatch):
    provider(
        monkeypatch, {"message": "Abro tus recuerdos.", "action": "click", "target": "memories"}
    )
    assert service.decide(request()).target == "memories"


@pytest.mark.parametrize(
    "action,target,value",
    [("click", "delete", ""), ("fill", "memories", "x"), ("scroll", "", "sideways")],
)
def test_provider_cannot_invent_controls_or_operations(monkeypatch, action, target, value):
    provider(
        monkeypatch, {"message": "Un paso.", "action": action, "target": target, "value": value}
    )
    with pytest.raises(ApplicationError):
        service.decide(request())


def test_unknown_select_value_is_rejected(monkeypatch):
    data = request()
    data.screen.controls = [
        service.Control(
            id="memory",
            label="Recuerdo",
            kind="select",
            options=[service.Option(value="1", label="Paseo")],
        )
    ]
    provider(
        monkeypatch,
        {"message": "Elijo una foto.", "action": "select", "target": "memory", "value": "2"},
    )
    with pytest.raises(ApplicationError):
        service.decide(data)


def test_limits_and_extra_fields_are_enforced():
    with pytest.raises(ValidationError):
        service.TurnRequest.model_validate({**request().model_dump(), "javascript": "arbitrary"})
    with pytest.raises(ValidationError):
        service.Screen(page="home", text="x" * 14001, controls=[])


def test_routes_require_authentication_without_calling_provider(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post("/assistant/turn", json=request().model_dump())
        assert response.status_code == 401
        response = client.post("/assistant/voice", json={"text": "Hola"})
        assert response.status_code == 401
