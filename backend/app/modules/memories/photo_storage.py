from collections.abc import Sequence
from typing import Protocol
from urllib.parse import quote, urlsplit

import httpx

from app.core.errors import ApplicationError
from app.modules.memories.photo_settings import (
    PHOTO_URL_SECONDS,
    PhotoStorageSettings,
    get_photo_storage_settings,
    photo_storage_error,
)


class PhotoStorage(Protocol):
    @property
    def bucket(self) -> str: ...
    def upload(self, bucket: str, key: str, data: bytes, content_type: str) -> None: ...
    def signed_urls(self, bucket: str, keys: Sequence[str]) -> dict[str, str]: ...
    def remove(self, bucket: str, keys: Sequence[str]) -> None: ...


class SupabasePhotoStorage:
    def __init__(self, settings: PhotoStorageSettings | None = None) -> None:
        self.settings = settings or get_photo_storage_settings()
        self._private_buckets: set[str] = set()

    @property
    def bucket(self) -> str:
        return self.settings.supabase_storage_bucket

    def _request(
        self, method: str, path: str, *, content_type: str | None = None, **kwargs: object
    ) -> object:
        self.settings.require()
        key = self.settings.supabase_service_role_key.get_secret_value()
        headers = {"Authorization": "Bearer " + key, "apikey": key}
        if content_type:
            headers.update(
                {"Content-Type": content_type, "x-upsert": "false", "cache-control": "max-age=60"}
            )
        try:
            with httpx.Client(timeout=15, follow_redirects=False) as client:
                response = client.request(
                    method,
                    self.settings.supabase_url.rstrip("/") + "/storage/v1" + path,
                    headers=headers,
                    **kwargs,
                )
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError):
            raise photo_storage_error() from None

    def _require_private(self, bucket: str) -> None:
        if bucket in self._private_buckets:
            return
        result = self._request("GET", "/bucket/" + quote(bucket, safe=""))
        if not isinstance(result, dict) or result.get("public") is not False:
            raise ApplicationError(
                code="photo_bucket_not_private",
                message="Las fotos compartidas todavía no están disponibles.",
                status_code=503,
            )
        self._private_buckets.add(bucket)

    def upload(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        self._require_private(bucket)
        # Object names are generated server-side; the original filename is not stored.
        self._request(
            "POST",
            "/object/" + quote(bucket, safe="") + "/" + quote(key, safe="/"),
            content=data,
            content_type=content_type,
        )

    def signed_urls(self, bucket: str, keys: Sequence[str]) -> dict[str, str]:
        if not keys:
            return {}
        self._require_private(bucket)
        result = self._request(
            "POST",
            "/object/sign/" + quote(bucket, safe=""),
            json={"expiresIn": PHOTO_URL_SECONDS, "paths": list(keys)},
        )
        if not isinstance(result, list):
            raise photo_storage_error()
        signed = {}
        root = self.settings.supabase_url.rstrip("/")
        for item in result:
            if not isinstance(item, dict) or item.get("error"):
                raise photo_storage_error()
            path = item.get("path")
            url = item.get("signedURL") or item.get("signedUrl")
            if path not in keys or not isinstance(url, str):
                raise photo_storage_error()
            if url.startswith("/object/sign/"):
                url = root + "/storage/v1" + url
            elif url.startswith("/storage/v1/object/sign/"):
                url = root + url
            parsed = urlsplit(url)
            expected = urlsplit(root)
            if (parsed.scheme, parsed.netloc) != (expected.scheme, expected.netloc):
                raise photo_storage_error()
            signed[str(path)] = url
        if len(signed) != len(keys):
            raise photo_storage_error()
        return signed

    def remove(self, bucket: str, keys: Sequence[str]) -> None:
        if keys:
            self._require_private(bucket)
            self._request(
                "DELETE", "/object/" + quote(bucket, safe=""), json={"prefixes": list(keys)}
            )
