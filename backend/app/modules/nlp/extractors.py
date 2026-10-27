import re
from functools import lru_cache
from typing import TYPE_CHECKING, Protocol

from app.modules.nlp.schemas import Entity, EntityKind

if TYPE_CHECKING:
    from spacy.language import Language

SPACY_MODEL = "es_core_news_sm"

# es_core_news_sm only knows PER, LOC, ORG and MISC; ORG and MISC are too noisy to use.
SPACY_LABELS = {"PER": EntityKind.PERSON, "LOC": EntityKind.PLACE}

# The Spanish model has no date entities, so periods come from simple patterns:
# "1965", "los años 60", "la década del 70".
PERIOD_PATTERN = re.compile(
    r"\b(?:19|20)\d{2}\b|\b(?:los\s+años|la\s+década\s+de(?:l)?)\s+(?:19)?\d0\b",
    re.IGNORECASE,
)


class EntityExtractor(Protocol):
    name: str

    def extract(self, text: str) -> list[Entity]: ...


class NullExtractor:
    name = "null"

    def extract(self, text: str) -> list[Entity]:
        return []


@lru_cache(maxsize=1)
def _load_spacy() -> "Language":
    # Imported and loaded lazily: the model takes ~1 s and a good share of the
    # 512 MB that Render's free plan gives us, so we only pay for it once.
    import spacy

    return spacy.load(SPACY_MODEL, disable=["parser", "lemmatizer"])


class SpacyExtractor:
    name = "spacy"

    def extract(self, text: str) -> list[Entity]:
        doc = _load_spacy()(text)
        entities = [
            Entity(kind=SPACY_LABELS[ent.label_], text=ent.text.strip())
            for ent in doc.ents
            if ent.label_ in SPACY_LABELS
        ]
        entities += [
            Entity(kind=EntityKind.PERIOD, text=match.group())
            for match in PERIOD_PATTERN.finditer(text)
        ]
        return entities
