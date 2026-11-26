from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.assistant.service import Decision, TurnRequest, decide
from app.modules.families.service import FamiliesService, get_authenticated_user_id
from app.modules.sessions.tts import VoiceRequest, synthesize_voice

router = APIRouter(prefix="/assistant", tags=["assistant"])
Actor = Annotated[UUID, Depends(get_authenticated_user_id)]


def verified_actor(actor_id: Actor, db: Annotated[Session, Depends(get_db)]) -> UUID:
    FamiliesService(db).get_current_user(actor_id)
    return actor_id


VerifiedActor = Annotated[UUID, Depends(verified_actor)]


@router.post("/turn", response_model=Decision)
def turn(data: TurnRequest, actor_id: VerifiedActor) -> Decision:
    return decide(data)


@router.post("/voice")
def voice(data: VoiceRequest, actor_id: VerifiedActor) -> Response:
    return Response(content=synthesize_voice(data), media_type="audio/wav")
