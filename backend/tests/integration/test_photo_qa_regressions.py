from collections.abc import Iterator, Sequence
from io import BytesIO
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.memories.photo_router import get_photo_storage
from app.modules.memories.photo_settings import photo_storage_error
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


@pytest.mark.parametrize("phase", ["upload", "signed_urls"])
def test_failed_upload_rolls_back_and_allows_retry(
    client, storage, caregiver_account, memory, monkeypatch, phase
):
    """Un fallo no deja archivos huérfanos ni consume una foto del cupo."""
    original = getattr(storage, phase)

    def fail(*args, **kwargs):
        if phase == "upload":
            original(*args, **kwargs)
        raise photo_storage_error()

    data = BytesIO()
    Image.new("RGB", (8, 6), "blue").save(data, format="PNG")
    with monkeypatch.context() as patch:
        patch.setattr(storage, phase, fail)
        response = client.post(
            f"/memories/{memory.id}/photos",
            headers=headers(caregiver_account),
            files={"file": ("foto.png", data.getvalue(), "image/png")},
        )
    assert response.status_code == 503
    assert not storage.objects
    listing = client.get(f"/memories/{memory.id}/photos", headers=headers(caregiver_account))
    assert listing.json()["total"] == 0
    upload(client, caregiver_account, memory.id)
    assert len(storage.objects) == 1
    assert (
        client.get(f"/memories/{memory.id}/photos", headers=headers(caregiver_account)).json()[
            "total"
        ]
        == 1
    )


def test_failed_delete_preserves_photo_and_can_be_retried(
    client, storage, caregiver_account, memory, monkeypatch
):
    """La base de datos conserva la foto cuando Storage rechaza el borrado."""
    photo = upload(client, caregiver_account, memory.id)
    path = f"/memories/{memory.id}/photos/{photo['id']}"

    def fail(*args, **kwargs):
        raise photo_storage_error()

    with monkeypatch.context() as patch:
        patch.setattr(storage, "remove", fail)
        assert client.delete(path, headers=headers(caregiver_account)).status_code == 503
    assert len(storage.objects) == 1
    assert (
        client.get(f"/memories/{memory.id}/photos", headers=headers(caregiver_account)).json()[
            "total"
        ]
        == 1
    )
    assert client.delete(path, headers=headers(caregiver_account)).status_code == 204
    assert not storage.objects
    assert (
        client.get(f"/memories/{memory.id}/photos", headers=headers(caregiver_account)).json()[
            "total"
        ]
        == 0
    )


def test_photo_cannot_be_deleted_through_another_memory(client, storage, caregiver_account, memory):
    """Una foto de la misma familia sigue vinculada a su recuerdo original."""
    photo = upload(client, caregiver_account, memory.id)
    another = create_memory(caregiver_account)
    response = client.delete(
        f"/memories/{another.id}/photos/{photo['id']}", headers=headers(caregiver_account)
    )
    assert response.status_code == 404
    assert len(storage.objects) == 1
    assert (
        client.get(f"/memories/{memory.id}/photos", headers=headers(caregiver_account)).json()[
            "items"
        ][0]["id"]
        == photo["id"]
    )


@pytest.mark.parametrize("authorization", [None, "Bearer invalido"])
def test_unauthenticated_writes_have_no_storage_effects(
    client, storage, caregiver_account, memory, authorization
):
    photo = upload(client, caregiver_account, memory.id)
    before = dict(storage.objects)
    auth = {} if authorization is None else {"Authorization": authorization}
    path = f"/memories/{memory.id}/photos"
    assert (
        client.post(
            path, headers=auth, files={"file": ("foto.png", b"invalid", "image/png")}
        ).status_code
        == 401
    )
    assert client.delete(f"{path}/{photo['id']}", headers=auth).status_code == 401
    assert storage.objects == before
