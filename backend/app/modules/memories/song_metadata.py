"""Metadatos públicos; no descarga audio ni inventa artista, año o género."""

import re
import threading
import time
from functools import lru_cache
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from pydantic import BaseModel, ConfigDict

from app.core.errors import ApplicationError

_music_lock = threading.Lock()
_last_music_request = 0.0
HEADERS = {"User-Agent": "AyniDigital/1.0 (https://github.com/JosephChomboM/ayni-digital-startup)"}


class SongSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recording_id: UUID


def _music(path: str, **params) -> dict:
    global _last_music_request
    with _music_lock:
        delay = 1.05 - (time.monotonic() - _last_music_request)
        if delay > 0:
            time.sleep(delay)
        _last_music_request = time.monotonic()
        with httpx.Client(timeout=10, headers=HEADERS) as client:
            response = client.get(
                "https://musicbrainz.org/ws/2/" + path, params={"fmt": "json", **params}
            )
            response.raise_for_status()
            return response.json()


def _recording(data: dict) -> dict:
    artists = "".join(
        str(item.get("name", item.get("artist", {}).get("name", ""))) + item.get("joinphrase", "")
        for item in data.get("artist-credit", [])
        if isinstance(item, dict)
    )
    date = data.get("first-release-date") or ""
    year = int(date[:4]) if re.match(r"^\d{4}", date) else None
    artist_genres = sorted(
        {
            str(genre["name"])[:60]
            for credit in data.get("artist-credit", [])
            if isinstance(credit, dict)
            for genre in credit.get("artist", {}).get("genres", [])
        }
    )[:5]
    return {
        "recording_id": str(UUID(data["id"])),
        "title": str(data.get("title", ""))[:200],
        "artist": artists[:200] or None,
        "year": year,
        "genres": [str(item["name"])[:60] for item in data.get("genres", [])[:5]],
        "artist_genres": artist_genres,
        "version": str(data.get("disambiguation", ""))[:200],
        "source_url": "https://musicbrainz.org/recording/" + str(UUID(data["id"])),
    }


@lru_cache(maxsize=128)
def search_song(url: str, fallback_title: str, search: str | None = None) -> dict:
    host = urlsplit(url).hostname
    endpoint = (
        "https://www.youtube.com/oembed"
        if host == "www.youtube.com"
        else "https://open.spotify.com/oembed"
        if host == "open.spotify.com"
        else None
    )
    result = {"status": "unavailable", "title": fallback_title, "channel": None, "candidates": []}
    if not endpoint:
        return result
    try:
        with httpx.Client(timeout=5) as client:
            response = client.get(endpoint, params={"url": url, "format": "json"})
            response.raise_for_status()
            metadata = response.json()
        title = str(metadata.get("title", fallback_title))[:200]
        result.update(title=title, channel=metadata.get("author_name"))
    except (httpx.HTTPError, ValueError, TypeError):
        title = fallback_title[:200]
    try:
        # La búsqueda no confirma automáticamente que una grabación sea la del video.
        clean = re.sub(r"\([^)]*\)|\[[^]]*\]", "", search or title).strip()[:200]
        artist, separator, track = clean.partition(" - ")

        def words(value: str) -> str:
            return " ".join(re.findall(r"[^\W_]+", value, re.UNICODE))

        query = (
            f'recording:"{words(track)}" AND artist:"{words(artist)}"'
            if separator
            else f'recording:"{words(clean)}"'
        )
        candidates = _music("recording", query=query, limit=50).get("recordings", [])
        candidates.sort(
            key=lambda item: (
                -int(item.get("score", 0)),
                item.get("first-release-date") or "9999",
                bool(item.get("disambiguation")),
            )
        )
        result["candidates"] = [
            _recording(item) for item in candidates if int(item.get("score", 0)) >= 60
        ][:3]
        result["status"] = "needs_confirmation" if result["candidates"] else "unavailable"
    except (httpx.HTTPError, ValueError, TypeError, KeyError):
        pass
    return result


@lru_cache(maxsize=128)
def recording_context(recording_id: UUID) -> dict:
    try:
        result = _recording(_music("recording/" + str(recording_id), inc="artist-credits+genres"))
        return {"status": "confirmed", **result}
    except (httpx.HTTPError, ValueError, TypeError, KeyError):
        raise ApplicationError(
            code="song_metadata_unavailable",
            status_code=503,
            message=(
                "No pudimos consultar los datos de esta grabación. "
                "La canción puede seguir reproduciéndose."
            ),
        ) from None
