"""Herramientas de consulta limitadas al contexto autorizado de esta sesión."""

import json
import re


class SessionTools:
    def __init__(self, memories: list[str], history: list[dict[str, str]]):
        self.memories = list(memories)
        self.history = history[-40:]

    def relevant_memories(self, query: str, limit: int = 3) -> list[str]:
        """Search the entire authorized collection; bound only the returned excerpts."""
        return self._rank(self.memories, query)[:limit]

    @staticmethod
    def _rank(values: list[str], query: str) -> list[str]:
        words = set(re.findall(r"\w+", query.casefold()))
        ranked = sorted(
            enumerate(values),
            key=lambda entry: (len(words & set(re.findall(r"\w+", entry[1].casefold()))), entry[0]),
            reverse=True,
        )
        return [value for _, value in ranked]

    @staticmethod
    def definitions() -> list[dict]:
        return [
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": description,
                    "parameters": {
                        "type": "object",
                        "properties": {"query": {"type": "string", "maxLength": 120}},
                        "required": ["query"],
                        "additionalProperties": False,
                    },
                },
            }
            for name, description in (
                (
                    "consultar_recuerdos",
                    "Busca detalles en los recuerdos autorizados de la sesión.",
                ),
                (
                    "consultar_conversacion",
                    "Busca lo que la persona contó antes, hasta los últimos 40 mensajes.",
                ),
            )
        ]

    def execute(self, name: str, arguments: str) -> str:
        sources = {
            "consultar_recuerdos": self.memories,
            "consultar_conversacion": [item["content"] for item in self.history],
        }
        if name not in sources:
            return json.dumps({"error": "herramienta_no_disponible"})
        try:
            data = json.loads(arguments)
            if not isinstance(data, dict) or set(data) != {"query"}:
                raise ValueError
            query = data["query"]
            if not isinstance(query, str) or len(query) > 120:
                raise ValueError
        except (ValueError, TypeError):
            return json.dumps({"error": "consulta_invalida"})
        ranked = self._rank(sources[name], query)
        return json.dumps(
            {
                "datos": [value[:1800] for value in ranked[:3]],
                "alcance": "Solo esta sesión; no es una evaluación de salud.",
            },
            ensure_ascii=False,
        )
