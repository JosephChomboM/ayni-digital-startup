from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.families.service import get_authenticated_user_id
from app.modules.memories.extraction import extract_anecdote_entities
from app.modules.memories.models import EntitiesStatus, MemoryType
from app.modules.memories.photo_router import get_photo_storage
from app.modules.memories.photo_router import router as photo_router
from app.modules.memories.photo_storage import PhotoStorage
from app.modules.memories.schemas import (
    MemoryCreateRequest,
    MemoryListRequest,
    MemoryListResponse,
    MemoryPatchRequest,
    MemoryResponse,
)
from app.modules.memories.service import MemoriesService
from app.modules.memories.song_metadata import SongSelection

router = APIRouter(prefix="/memories", tags=["memories"])
router.include_router(photo_router)


def get_memories_service(
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[PhotoStorage, Depends(get_photo_storage)],
) -> MemoriesService:
    return MemoriesService(db, photo_storage=storage)


AuthenticatedUserId = Annotated[UUID, Depends(get_authenticated_user_id)]
MemoriesServiceDep = Annotated[MemoriesService, Depends(get_memories_service)]


def _schedule_extraction(tasks: BackgroundTasks, memory: MemoryResponse) -> None:
    if memory.type == MemoryType.ANECDOTE and memory.entities_status == EntitiesStatus.PENDING:
        tasks.add_task(extract_anecdote_entities, memory.id, memory.elder_profile_id)


@router.post("", response_model=MemoryResponse, status_code=201)
def create_memory(
    data: MemoryCreateRequest,
    background_tasks: BackgroundTasks,
    user_id: AuthenticatedUserId,
    service: MemoriesServiceDep,
) -> MemoryResponse:
    memory = service.create_memory(user_id, data)
    _schedule_extraction(background_tasks, memory)
    return memory


@router.get("", response_model=MemoryListResponse)
def list_memories(
    query: Annotated[MemoryListRequest, Query()],
    user_id: AuthenticatedUserId,
    service: MemoriesServiceDep,
) -> MemoryListResponse:
    return service.list_memories(user_id, query)


@router.get("/{memory_id}", response_model=MemoryResponse)
def get_memory(
    memory_id: UUID, user_id: AuthenticatedUserId, service: MemoriesServiceDep
) -> MemoryResponse:
    return service.get_memory(user_id, memory_id)


@router.get("/{memory_id}/song-context")
def song_context(
    memory_id: UUID,
    user_id: AuthenticatedUserId,
    service: MemoriesServiceDep,
    lookup: bool = False,
    search: Annotated[str | None, Query(max_length=200)] = None,
) -> dict:
    return service.get_song_context(user_id, memory_id, lookup, search)


@router.post("/{memory_id}/song-context")
def confirm_song_context(
    memory_id: UUID, data: SongSelection, user_id: AuthenticatedUserId, service: MemoriesServiceDep
) -> dict:
    return service.confirm_song_context(user_id, memory_id, data.recording_id)


@router.patch("/{memory_id}", response_model=MemoryResponse)
def update_memory(
    memory_id: UUID,
    data: MemoryPatchRequest,
    background_tasks: BackgroundTasks,
    user_id: AuthenticatedUserId,
    service: MemoriesServiceDep,
) -> MemoryResponse:
    memory = service.update_memory(user_id, memory_id, data)
    if "text" in data.model_fields_set:
        _schedule_extraction(background_tasks, memory)
    return memory


@router.delete("/{memory_id}", status_code=204, response_class=Response)
def delete_memory(
    memory_id: UUID, user_id: AuthenticatedUserId, service: MemoriesServiceDep
) -> Response:
    service.delete_memory(user_id, memory_id)
    return Response(status_code=204)


@router.post("/{memory_id}/entities/retry", response_model=MemoryResponse, status_code=202)
def retry_entities(
    memory_id: UUID,
    background_tasks: BackgroundTasks,
    user_id: AuthenticatedUserId,
    service: MemoriesServiceDep,
) -> MemoryResponse:
    memory = service.retry_entities(user_id, memory_id)
    _schedule_extraction(background_tasks, memory)
    return memory
