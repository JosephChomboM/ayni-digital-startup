from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException
from starlette.types import Message

from app.core.db import get_db
from app.core.error_handlers import error_response
from app.modules.families.service import get_authenticated_user_id
from app.modules.memories.photo_settings import PHOTO_MAX_BYTES
from app.modules.memories.photo_storage import PhotoStorage, SupabasePhotoStorage
from app.modules.memories.schemas import PhotoListResponse, PhotoResponse
from app.modules.memories.service import MemoriesService


class PhotoUploadRoute(APIRoute):
    def get_route_handler(self) -> Callable[[Request], Awaitable[Response]]:
        original = super().get_route_handler()

        async def limited(request: Request) -> Response:
            if request.method != "POST":
                return await original(request)
            maximum = PHOTO_MAX_BYTES + 65536  # Small allowance for multipart headers.
            length = request.headers.get("content-length", "")
            if length.isdecimal() and int(length) > maximum:
                return error_response(
                    413, "photo_too_large", "La foto debe pesar como máximo 8 MB."
                )
            received = 0

            async def receive() -> Message:
                nonlocal received
                message = await request.receive()
                received += len(message.get("body", b""))
                if received > maximum:
                    raise HTTPException(status_code=413)
                return message

            try:
                return await original(Request(request.scope, receive=receive))
            except HTTPException as error:
                if error.status_code != 413:
                    raise
                return error_response(
                    413, "photo_too_large", "La foto debe pesar como máximo 8 MB."
                )

        return limited


router = APIRouter(route_class=PhotoUploadRoute)


def get_photo_storage() -> PhotoStorage:
    return SupabasePhotoStorage()


def get_photo_service(
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[PhotoStorage, Depends(get_photo_storage)],
) -> MemoriesService:
    return MemoriesService(db, photo_storage=storage)


PhotoServiceDep = Annotated[MemoriesService, Depends(get_photo_service)]
PhotoActorDep = Annotated[UUID, Depends(get_authenticated_user_id)]


@router.post("/{memory_id}/photos", response_model=PhotoResponse, status_code=201)
def upload_photo(
    memory_id: UUID,
    actor_id: PhotoActorDep,
    service: PhotoServiceDep,
    file: Annotated[UploadFile, File()],
) -> PhotoResponse:
    try:
        return service.upload_photo(
            actor_id,
            memory_id,
            data=file.file.read(PHOTO_MAX_BYTES + 1),
            content_type=file.content_type or "",
            filename=file.filename or "",
        )
    finally:
        file.file.close()


@router.get("/{memory_id}/photos", response_model=PhotoListResponse)
def list_photos(
    memory_id: UUID,
    actor_id: PhotoActorDep,
    service: PhotoServiceDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PhotoListResponse:
    return service.list_photos(actor_id, memory_id, limit=limit, offset=offset)


@router.delete("/{memory_id}/photos/{photo_id}", status_code=204, response_class=Response)
def delete_photo(
    memory_id: UUID,
    photo_id: UUID,
    actor_id: PhotoActorDep,
    service: PhotoServiceDep,
) -> Response:
    service.delete_photo(actor_id, memory_id, photo_id)
    return Response(status_code=204)
