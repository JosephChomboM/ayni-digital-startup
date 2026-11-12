from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.families.service import FamiliesService, get_authenticated_user_id
from app.modules.insights.service import (
    PauseAlert,
    ReactionRecord,
    ReactionSummary,
    evaluate_pause_alert,
    summarize_reactions,
)
from app.modules.responses.service import ResponsesService

router = APIRouter(prefix="/insights", tags=["insights"])


class FamilyReactions(BaseModel):
    history: list[ReactionRecord]
    summary: ReactionSummary
    pause: PauseAlert


@router.get("/reactions", response_model=FamilyReactions)
def family_reactions(
    actor: Annotated[UUID, Depends(get_authenticated_user_id)],
    db: Annotated[Session, Depends(get_db)],
) -> FamilyReactions:
    profile = FamiliesService(db).get_elder_profile(actor)
    history = [
        ReactionRecord(
            session_id=item.session_id,
            elder_profile_id=item.elder_profile_id,
            occurred_at=item.occurred_at,
            reaction=item.reaction,
        )
        for item in ResponsesService(db).get_history(actor)
    ]
    end = datetime.now(UTC)
    return FamilyReactions(
        history=history,
        summary=summarize_reactions(profile.id, history, start=end - timedelta(days=30), end=end),
        pause=evaluate_pause_alert([item.reaction for item in history]),
    )
