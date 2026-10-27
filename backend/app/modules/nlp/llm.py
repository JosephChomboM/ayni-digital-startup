import httpx
from pydantic import BaseModel

from app.modules.nlp.schemas import Entity

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Only the anecdote goes to the LLM (CLAUDE.md, Ley 29733): no IDs, emails or
# account data. The prompt asks for literal extraction, never interpretation.
SYSTEM_PROMPT = """\
Extraes datos de una anécdota familiar escrita en español.
Responde solo con JSON de esta forma:
{"entities": [{"kind": "person", "text": "..."}]}

Valores de "kind":
- "person": nombres de personas o parentescos (mi papá, la tía Rosa)
- "place": ciudades, barrios, países, lugares concretos
- "period": años, décadas o épocas (1965, los años 60, su juventud)
- "activity": actividades, oficios, pasatiempos o costumbres (bailar marinera, pescar)

Reglas:
- "text" es una copia literal de un fragmento de la anécdota.
- No inventes nada que no esté escrito. Si no hay entidades, devuelve {"entities": []}.
- No interpretes ni opines sobre la persona, su salud ni sus emociones."""


class LlmResponse(BaseModel):
    entities: list[Entity]


class LlmExtractor:
    name = "groq"

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_seconds: float,
        client: httpx.Client | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.client = client or httpx.Client(timeout=timeout_seconds)

    def extract(self, text: str) -> list[Entity]:
        response = self.client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
            },
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        entities = LlmResponse.model_validate_json(content).entities

        # Drop anything the model made up: every entity must appear in the anecdote.
        lowered = text.casefold()
        return [e for e in entities if e.text.strip() and e.text.casefold() in lowered]
