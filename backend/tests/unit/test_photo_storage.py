import secrets

import httpx
import pytest
from pydantic import SecretStr

from app.core.errors import ApplicationError
from app.modules.memories.photo_settings import PhotoStorageSettings
from app.modules.memories.photo_storage import SupabasePhotoStorage


def storage() -> SupabasePhotoStorage:
    return SupabasePhotoStorage(
        PhotoStorageSettings(
            _env_file=None,
            supabase_url="https://storage.example.test",
            supabase_service_role_key=SecretStr(secrets.token_urlsafe(32)),
        )
    )


def test_private_upload_signed_url_and_delete_use_authenticated_storage_requests(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        assert request.headers["authorization"].startswith("Bearer ")
        if request.method == "GET":
            return httpx.Response(200, json={"public": False})
        if request.url.path.startswith("/storage/v1/object/sign/"):
            return httpx.Response(
                200,
                json=[
                    {
                        "path": "family/photo.png",
                        "signedURL": "/object/sign/fotos/family/photo.png?token=synthetic",
                    }
                ],
            )
        if request.method == "POST":
            assert request.headers["content-type"] == "image/png"
            assert request.headers["x-upsert"] == "false"
            assert request.content == b"validated pixels"
        return httpx.Response(200, json={})

    original_client = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: original_client(
            transport=httpx.MockTransport(handle),
            **kwargs,
        ),
    )
    gateway = storage()
    gateway.upload("fotos", "family/photo.png", b"validated pixels", "image/png")
    signed = gateway.signed_urls("fotos", ["family/photo.png"])
    assert signed["family/photo.png"].startswith(
        "https://storage.example.test/storage/v1/object/sign/"
    )
    gateway.remove("fotos", ["family/photo.png"])
    assert [request.method for request in seen] == ["GET", "POST", "POST", "DELETE"]


def test_public_bucket_is_rejected_before_upload(monkeypatch: pytest.MonkeyPatch) -> None:
    gateway = storage()
    seen = []

    def request(method: str, path: str, **kwargs: object) -> object:
        seen.append(method)
        return {"public": True}

    monkeypatch.setattr(gateway, "_request", request)
    with pytest.raises(ApplicationError) as error:
        gateway.upload("fotos", "family/photo.png", b"pixels", "image/png")
    assert error.value.code == "photo_bucket_not_private"
    assert seen == ["GET"]


def test_storage_failure_does_not_expose_provider_details(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"message": "Provider private diagnostic"})

    original_client = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: original_client(
            transport=httpx.MockTransport(fail),
            **kwargs,
        ),
    )
    with pytest.raises(ApplicationError) as error:
        storage().upload("fotos", "family/photo.png", b"pixels", "image/png")
    assert error.value.code == "photo_storage_unavailable"
    assert "Provider" not in error.value.message
