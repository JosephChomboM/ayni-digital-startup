from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class EntityKind(StrEnum):
    PERSON = "person"
    PLACE = "place"
    PERIOD = "period"
    ACTIVITY = "activity"


class Entity(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: EntityKind
    text: str
