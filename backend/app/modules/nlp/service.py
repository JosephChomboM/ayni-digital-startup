import logging
import time
from dataclasses import dataclass, field

from app.core.config import Settings, get_settings
from app.modules.nlp.extractors import EntityExtractor, SpacyExtractor
from app.modules.nlp.llm import LlmExtractor
from app.modules.nlp.schemas import Entity, EntityKind

__all__ = [
    "Entity",
    "EntityKind",
    "ExtractionResult",
    "extract_entities",
    "extract_entities_with_status",
]

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


@dataclass(frozen=True)
class ExtractionResult:
    entities: list[Entity] = field(repr=False)
    succeeded: bool


def extract_entities(text: str) -> list[Entity]:
    """Never raises. LLM → spaCy → []"""
    return extract_entities_with_status(text).entities


def extract_entities_with_status(text: str) -> ExtractionResult:
    """Report total failure separately from a successful extraction with no entities."""
    if not text.strip():
        return ExtractionResult(entities=[], succeeded=True)

    for extractor in EXTRACTORS:
        start = time.perf_counter()
        try:
            entities = _dedupe(extractor.extract(text))
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
        return ExtractionResult(entities=entities, succeeded=True)

    return ExtractionResult(entities=[], succeeded=False)


def _dedupe(entities: list[Entity]) -> list[Entity]:
    seen: set[tuple[EntityKind, str]] = set()
    unique = []
    for entity in entities:
        key = (entity.kind, entity.text.casefold())
        if entity.text and key not in seen:
            seen.add(key)
            unique.append(entity)
    return unique
