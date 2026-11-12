import json
from types import SimpleNamespace

import httpx
import pytest

from app.modules.sessions import conversation


@pytest.mark.parametrize(
    "choice, source", [(1, "ai"), (999, "guide"), ("texto inesperado", "guide")]
)
def test_provider_sees_only_safe_categories_and_can_only_select_a_catalogue_question(
    monkeypatch: pytest.MonkeyPatch, choice: int | str, source: str
) -> None:
    monkeypatch.setattr(
        conversation,
        "get_settings",
        lambda: SimpleNamespace(groq_api_key="test", groq_model="test", llm_timeout_seconds=1),
    )

    def respond(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        context = json.loads(payload["messages"][1]["content"])
        assert set(context) == {"actividad", "tema_elegido", "opciones"}
        assert context["actividad"] == "paseo"
        assert context["tema_elegido"] == "place"
        assert "nombre-privado" not in request.content.decode()
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps({"choice": choice})}}]},
        )

    client = httpx.Client(transport=httpx.MockTransport(respond))
    monkeypatch.setattr(conversation.httpx, "Client", lambda **_: client)
    turn = conversation.select_conversation_turn(
        "Un paseo con nombre-privado", conversation.ConversationRequest(topic="place")
    )
    assert turn.source == source
    assert turn.question_id == ("sounds" if source == "ai" else "surroundings")
    assert turn.question == conversation.QUESTIONS["place"][turn.question_id]
