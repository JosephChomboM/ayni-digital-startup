import logging
import time

from app.core.config import Settings, get_settings
from app.modules.nlp.extractors import EntityExtractor, SpacyExtractor
from app.modules.nlp.llm import LlmExtractor
from app.modules.nlp.schemas import Entity, EntityKind

__all__ = ["Entity", "EntityKind", "extract_entities"]

logger = logging.getLogger(__name__)


def build_extractors(settings: Settings) -> list[EntityExtractor]:
    """LLM first (only if there is a key), then spaCy."""
    extractors: list[EntityExtractor] = []
    if settings.groq_api_key:
        extractors.append(
            LlmExtractor(
                api_key=settings.groq_api_key,
                model=settings.groq_model,
                timeout_seconds=settings.llm_timeout_seconds,
            )
        )
    extractors.append(SpacyExtractor())
    return extractors


# Tried in order until one works.
EXTRACTORS: list[EntityExtractor] = build_extractors(get_settings())


def extract_entities(text: str) -> list[Entity]:
    """Never raises. LLM → spaCy → []"""
    if not text.strip():
        return []

    for extractor in EXTRACTORS:
        start = time.perf_counter()
        try:
            entities = extractor.extract(text)
        except Exception as exc:
            # Only the error type: the message could quote the anecdote.
            logger.warning(
                "nlp extractor failed, falling back",
                extra={"extractor": extractor.name, "error": type(exc).__name__},
            )
            continue
        logger.info(
            "nlp extraction done",
            extra={
                "extractor": extractor.name,
                "latency_ms": round((time.perf_counter() - start) * 1000),
                "entity_count": len(entities),
            },
        )
        return _dedupe(entities)

    return []


def _dedupe(entities: list[Entity]) -> list[Entity]:
    seen: set[tuple[EntityKind, str]] = set()
    unique = []
    for entity in entities:
        key = (entity.kind, entity.text.casefold())
        if entity.text and key not in seen:
            seen.add(key)
            unique.append(entity)
    return unique
