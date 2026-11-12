import json
import re
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from app.core.config import get_settings

Topic = Literal["start", "place", "activity", "detail", "ease"]
Source = Literal["ai", "guide"]
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Keys are stable for the life of an open conversation. All displayed wording
# comes from this catalogue, even when the model selects the next question.
QUESTIONS: dict[Topic, dict[str, str]] = {
    "start": {
        "first": "¿Qué parte de este recuerdo te gustaría compartir?",
        "moment": "¿Hay algún momento que te guste volver a contar?",
        "beginning": "¿Por dónde te gustaría empezar?",
    },
    "place": {
        "surroundings": "¿Qué detalle del lugar te gustaría describir?",
        "sounds": "¿Recuerdas algún sonido de ese lugar que te guste?",
        "view": "¿Qué te gustaba mirar cuando estabas allí?",
    },
    "activity": {
        "doing": "¿Qué te gustaba hacer en ese momento?",
        "together": "¿Qué disfrutaban hacer juntos?",
        "repeat": "¿Qué parte de esa actividad te gustaría repetir?",
    },
    "detail": {
        "detail": "¿Hay algún detalle de ese día que te gustaría contarnos?",
        "smile": "¿Qué parte de ese recuerdo te hace sonreír?",
        "tell": "¿Qué más te gustaría compartir de ese momento?",
    },
    "ease": {
        "easy_choice": "¿Te gustaría escuchar el recuerdo otra vez o pasar a otra actividad?",
        "easy_detail": "¿Hay algo de esta historia que te llame la atención ahora?",
        "easy_listen": "Podemos quedarnos escuchando. ¿Qué prefieres hacer?",
    },
}


class ConversationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: Topic
    asked: list[str] = Field(default_factory=list, max_length=5)


class ConversationTurn(BaseModel):
    question_id: str
    question: str
    source: Source


class QuestionSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    choice: StrictInt


def _scene(anecdote: str) -> str:
    # Derive a coarse activity category in the backend. Never forward the
    # anecdote, extracted entities or raw conversation to the provider.
    words = set(re.findall(r"[^\W\d_]+", anecdote.casefold()))
    for label, cues in (
        ("paseo", {"paseo", "viaje", "parque", "playa", "caminata"}),
        ("celebración", {"fiesta", "cumpleaños", "boda", "celebración"}),
        ("comida", {"cocina", "cocinar", "comida", "receta", "almuerzo"}),
        ("música", {"música", "canción", "baile", "bailar", "cantar"}),
    ):
        if words & cues:
            return label
    return "momento en familia"


def select_conversation_turn(anecdote: str, request: ConversationRequest) -> ConversationTurn:
    candidates = [
        (key, question)
        for key, question in QUESTIONS[request.topic].items()
        if key not in request.asked
    ]
    if not candidates:
        candidates = [
            (key, question)
            for key, question in (QUESTIONS["detail"] | QUESTIONS["start"]).items()
            if key not in request.asked
        ]
    choice, source = _choose_question(_scene(anecdote), request.topic, candidates)
    key, question = candidates[choice]
    return ConversationTurn(question_id=key, question=question, source=source)


def _choose_question(
    scene: str, topic: Topic, candidates: list[tuple[str, str]]
) -> tuple[int, Source]:
    settings = get_settings()
    if not settings.groq_api_key:
        return 0, "guide"

    context = {
        "actividad": scene,
        "tema_elegido": topic,
        "opciones": [question for _, question in candidates],
    }
    try:
        with httpx.Client(timeout=settings.llm_timeout_seconds) as client:
            response = client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": settings.groq_model,
                    "max_completion_tokens": 256,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Elige la pregunta más adecuada para conversar en familia "
                                "según la actividad y el tema elegido. "
                                'Devuelve solo JSON: {"choice": N}, con N como índice desde cero.'
                            ),
                        },
                        {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
                    ],
                },
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
        selection = QuestionSelection.model_validate_json(content).choice
        if 0 <= selection < len(candidates):
            return selection, "ai"
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        # The family can keep talking even if the provider is unavailable.
        pass
    return 0, "guide"
