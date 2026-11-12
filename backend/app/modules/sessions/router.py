from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.families.service import get_authenticated_user_id
from app.modules.sessions.assistant import ChatRequest
from app.modules.sessions.conversation import ConversationRequest, ConversationTurn
from app.modules.sessions.schemas import (
    GenerateSessionRequest,
    SessionDetail,
    SessionListRequest,
    SessionListResponse,
    SessionMessageResponse,
)
from app.modules.sessions.service import SessionsService

router = APIRouter(prefix="/sessions", tags=["sessions"])


def get_sessions_service(db: Annotated[Session, Depends(get_db)]) -> SessionsService:
    return SessionsService(db)


ActorId = Annotated[UUID, Depends(get_authenticated_user_id)]
Service = Annotated[SessionsService, Depends(get_sessions_service)]


@router.post("/generate", status_code=201, response_model=SessionDetail)
def generate_session(
    actor_id: ActorId,
    service: Service,
    data: GenerateSessionRequest | None = None,
) -> SessionDetail:
    return service.generate_session(actor_id)


@router.get("", response_model=SessionListResponse)
def list_sessions(
    query: Annotated[SessionListRequest, Query()],
    actor_id: ActorId,
    service: Service,
) -> SessionListResponse:
    return service.list_sessions(actor_id, query)


@router.post("/conversation/{memory_id}", response_model=ConversationTurn)
def converse_about_memory(
    memory_id: UUID, data: ConversationRequest, actor_id: ActorId, service: Service
) -> ConversationTurn:
    return service.converse_about_memory(actor_id, memory_id, data)


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: UUID, actor_id: ActorId, service: Service) -> SessionDetail:
    return service.get_session(actor_id, session_id)


@router.get("/{session_id}/messages", response_model=list[SessionMessageResponse])
def list_messages(
    session_id: UUID, actor_id: ActorId, service: Service
) -> list[SessionMessageResponse]:
    return service.list_messages(actor_id, session_id)


@router.post("/{session_id}/chat", response_model=SessionMessageResponse)
def chat(
    session_id: UUID, data: ChatRequest, actor_id: ActorId, service: Service
) -> SessionMessageResponse:
    return service.chat(actor_id, session_id, data)
