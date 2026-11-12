from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.families.service import get_authenticated_user_id
from app.modules.responses.schemas import ReactionRequest, ResponseDetail
from app.modules.responses.service import ResponsesService

router = APIRouter(prefix="/sessions", tags=["responses"])
Actor = Annotated[UUID, Depends(get_authenticated_user_id)]
Database = Annotated[Session, Depends(get_db)]


@router.post("/{session_id}/response", response_model=ResponseDetail, status_code=201)
def record_response(
    session_id: UUID,
    data: ReactionRequest,
    actor: Actor,
    db: Database,
    response: Response,
) -> ResponseDetail:
    result, created = ResponsesService(db).record_response(actor, session_id, data)
    response.status_code = 201 if created else 200
    return result


@router.get("/{session_id}/response", response_model=ResponseDetail)
def get_response(session_id: UUID, actor: Actor, db: Database) -> ResponseDetail:
    return ResponsesService(db).get_response(actor, session_id)
