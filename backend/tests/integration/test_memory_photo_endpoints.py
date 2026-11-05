from collections.abc import Iterator, Sequence
from datetime import UTC, datetime, timedelta
from io import BytesIO
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.families.service import FamiliesService
from app.modules.memories.photo_router import get_photo_storage
from app.modules.memories.photo_settings import PHOTO_MAX_BYTES
from app.modules.memories.schemas import AnecdoteCreateRequest, MemoryResponse
from app.modules.memories.service import MemoriesService

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


class FakePhotoStorage:
    bucket = "fotos"

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.sign_count = 0

    def upload(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        assert bucket == self.bucket and content_type == "image/png"
        self.objects[key] = data

    def signed_urls(self, bucket: str, keys: Sequence[str]) -> dict[str, str]:
        self.sign_count += 1
        assert all(key in self.objects for key in keys)
        return {key: f"https://private.example.test/{key}?token={self.sign_count}" for key in keys}

    def remove(self, bucket: str, keys: Sequence[str]) -> None:
        for key in keys:
            self.objects.pop(key, None)


@pytest.fixture
def storage() -> FakePhotoStorage:
    return FakePhotoStorage()


@pytest.fixture
def client(storage: FakePhotoStorage) -> Iterator[TestClient]:
    previous = app.dependency_overrides.get(get_photo_storage)
    app.dependency_overrides[get_photo_storage] = lambda: storage
    try:
        with TestClient(app) as instance:
            yield instance
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_photo_storage, None)
        else:
            app.dependency_overrides[get_photo_storage] = previous


def create_memory(actor: SimpleNamespace) -> MemoryResponse:
    with Session(engine) as session:
        return MemoriesService(session).create_memory(
            actor.user_id,
            AnecdoteCreateRequest(type="anecdote", title="Un paseo", text="Un paseo en familia."),
        )


@pytest.fixture
def memory(caregiver_account: SimpleNamespace, memory_profile_id: UUID) -> MemoryResponse:
    return create_memory(caregiver_account)


def headers(account: SimpleNamespace) -> dict[str, str]:
    return {"Authorization": "Bearer " + create_access_token(account.user_id)}


def upload(client: TestClient, account: SimpleNamespace, memory_id: UUID) -> dict[str, object]:
    data = BytesIO()
    Image.new("RGB", (8, 6), "blue").save(data, format="PNG")
    response = client.post(
        f"/memories/{memory_id}/photos",
        headers=headers(account),
        files={"file": ("private-original-name.png", data.getvalue(), "image/png")},
    )
    assert response.status_code == 201, response.json()
    return response.json()


def test_upload_returns_private_short_lived_photo_link(
    client: TestClient,
    storage: FakePhotoStorage,
    caregiver_account: SimpleNamespace,
    memory: MemoryResponse,
) -> None:
    photo = upload(client, caregiver_account, memory.id)
    assert photo["memory_id"] == str(memory.id)
    assert photo["created_by"] == str(caregiver_account.user_id)
    assert photo["width"] == 8 and photo["height"] == 6
    assert "private.example.test" in photo["url"]
    expires = datetime.fromisoformat(photo["url_expires_at"].replace("Z", "+00:00"))
    assert datetime.now(UTC) < expires < datetime.now(UTC) + timedelta(minutes=6)
    assert "bucket" not in photo and "object_key" not in photo
    key = next(iter(storage.objects))
    assert key.startswith(f"{caregiver_account.family_id}/{memory.id}/")
    assert "original-name" not in key


def test_upload_rejects_fake_image_with_uniform_error(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory: MemoryResponse,
) -> None:
    response = client.post(
        f"/memories/{memory.id}/photos",
        headers=headers(caregiver_account),
        files={"file": ("photo.png", b"not an image", "image/png")},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "photo_format_invalid"


def test_list_allows_family_member_and_paginates_fresh_signed_urls(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    memory: MemoryResponse,
) -> None:
    upload(client, caregiver_account, memory.id)
    upload(client, caregiver_account, memory.id)
    response = client.get(f"/memories/{memory.id}/photos?limit=1", headers=headers(family_member))
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2 and len(data["items"]) == 1
    again = client.get(f"/memories/{memory.id}/photos?limit=1", headers=headers(family_member))
    assert again.json()["items"][0]["url"] != data["items"][0]["url"]


def test_list_requires_login(client: TestClient, memory: MemoryResponse) -> None:
    response = client.get(f"/memories/{memory.id}/photos")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthorized"


def test_other_family_cannot_list_upload_or_delete_photos(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
    memory: MemoryResponse,
) -> None:
    photo = upload(client, caregiver_account, memory.id)
    path = f"/memories/{memory.id}/photos"
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id,
            name="Otro perfil de prueba",
            birth_decade=1940,
            interests=[],
        )
    other = headers(other_caregiver_account)
    responses = [
        client.get(path, headers=other),
        client.post(path, headers=other, files={"file": ("a.png", b"x", "image/png")}),
        client.delete(f"{path}/{photo['id']}", headers=other),
    ]
    assert all(response.status_code == 404 for response in responses)
    assert all(response.json()["detail"]["code"] == "memory_not_found" for response in responses)


def test_delete_removes_file_and_photo_metadata(
    client: TestClient,
    storage: FakePhotoStorage,
    caregiver_account: SimpleNamespace,
    memory: MemoryResponse,
) -> None:
    photo = upload(client, caregiver_account, memory.id)
    response = client.delete(
        f"/memories/{memory.id}/photos/{photo['id']}", headers=headers(caregiver_account)
    )
    assert response.status_code == 204 and response.content == b""
    assert not storage.objects
    assert (
        client.get(f"/memories/{memory.id}/photos", headers=headers(caregiver_account)).json()[
            "total"
        ]
        == 0
    )


def test_delete_unknown_photo_returns_not_found(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory: MemoryResponse,
) -> None:
    response = client.delete(
        f"/memories/{memory.id}/photos/{uuid4()}", headers=headers(caregiver_account)
    )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "photo_not_found"


def test_non_author_family_member_cannot_manage_photos(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    memory: MemoryResponse,
) -> None:
    photo = upload(client, caregiver_account, memory.id)
    path = f"/memories/{memory.id}/photos"
    member = headers(family_member)
    response = client.post(path, headers=member, files={"file": ("a.png", b"x", "image/png")})
    assert response.status_code == 403
    response = client.delete(f"{path}/{photo['id']}", headers=member)
    assert response.status_code == 403


def test_member_can_add_to_own_memory_and_caregiver_can_delete(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    memory = create_memory(family_member)
    photo = upload(client, family_member, memory.id)
    response = client.delete(
        f"/memories/{memory.id}/photos/{photo['id']}", headers=headers(caregiver_account)
    )
    assert response.status_code == 204


def test_free_photo_limit_is_shared_across_memories(
    client: TestClient,
    storage: FakePhotoStorage,
    caregiver_account: SimpleNamespace,
    memory: MemoryResponse,
) -> None:
    for _ in range(9):
        upload(client, caregiver_account, memory.id)
    upload(client, caregiver_account, create_memory(caregiver_account).id)
    response = client.post(
        f"/memories/{memory.id}/photos",
        headers=headers(caregiver_account),
        files={"file": ("a.png", b"x", "image/png")},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "photo_limit_reached"
    assert len(storage.objects) == 10


def test_upload_rejects_oversized_request_before_storage(
    client: TestClient,
    storage: FakePhotoStorage,
    caregiver_account: SimpleNamespace,
    memory: MemoryResponse,
) -> None:
    response = client.post(
        f"/memories/{memory.id}/photos",
        headers=headers(caregiver_account),
        files={"file": ("a.png", b"x" * (PHOTO_MAX_BYTES + 65537), "image/png")},
    )
    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "photo_too_large"
    assert not storage.objects


def test_deleting_memory_also_removes_private_photo_objects(
    client: TestClient,
    storage: FakePhotoStorage,
    caregiver_account: SimpleNamespace,
    memory: MemoryResponse,
) -> None:
    upload(client, caregiver_account, memory.id)
    response = client.delete(f"/memories/{memory.id}", headers=headers(caregiver_account))
    assert response.status_code == 204
    assert not storage.objects
