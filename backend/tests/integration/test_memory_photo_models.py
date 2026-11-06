from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.memories.models import Memory, MemoryPhoto
from app.modules.memories.schemas import AnecdoteCreateRequest
from app.modules.memories.service import MemoriesService

pytestmark = pytest.mark.integration


def test_photo_metadata_is_linked_to_memory_and_removed_with_it(
    caregiver_account: SimpleNamespace, memory_profile_id: UUID
) -> None:
    with Session(engine) as session:
        memory = MemoriesService(session).create_memory(
            caregiver_account.user_id,
            AnecdoteCreateRequest(type="anecdote", title="Un paseo", text="Un paseo en familia."),
        )
        with session.begin():
            photo = MemoryPhoto(
                memory_id=memory.id,
                created_by=caregiver_account.user_id,
                bucket="fotos",
                object_key=f"test/{uuid4()}.png",
                content_type="image/png",
                size_bytes=100,
                width=10,
                height=10,
            )
            session.add(photo)
            session.flush()
            photo_id = photo.id
            assert photo.created_at.utcoffset() is not None
            session.execute(delete(Memory).where(Memory.id == memory.id))
            assert session.scalar(select(MemoryPhoto.id).where(MemoryPhoto.id == photo_id)) is None


def test_database_rejects_unsupported_photo_format(
    caregiver_account: SimpleNamespace, memory_profile_id: UUID
) -> None:
    with Session(engine) as session:
        memory = MemoriesService(session).create_memory(
            caregiver_account.user_id,
            AnecdoteCreateRequest(type="anecdote", title="Un paseo", text="Un paseo en familia."),
        )
        session.add(
            MemoryPhoto(
                memory_id=memory.id,
                created_by=caregiver_account.user_id,
                bucket="fotos",
                object_key=f"test/{uuid4()}.svg",
                content_type="image/svg+xml",
                size_bytes=100,
                width=10,
                height=10,
            )
        )
        with pytest.raises(IntegrityError, match="ck_photos_content_type"):
            session.flush()
