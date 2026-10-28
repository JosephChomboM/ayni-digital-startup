from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from app.modules.memories.schemas import (
    MemoryCreateRequest,
    MemoryListRequest,
    MemoryPatchRequest,
    MemoryResponse,
    SongCreateRequest,
)


@pytest.mark.parametrize(
    "content",
    [
        {"type": "anecdote", "text": " Un paseo en familia. "},
        {"type": "song", "url": "https://youtu.be/abcdefghijk?si=tracking"},
    ],
)
def test_create_accepts_supported_types_and_defaults_to_unmarked(content: dict[str, str]) -> None:
    request = TypeAdapter(MemoryCreateRequest).validate_python(
        {"title": " Un recuerdo ", **content}
    )
    assert request.title == "Un recuerdo"
    assert not request.is_positive and not request.is_sensitive
    if request.type == "anecdote":
        assert request.text == "Un paseo en familia."
    else:
        assert request.url == "https://www.youtube.com/watch?v=abcdefghijk"


@pytest.mark.parametrize(
    "content",
    [
        {"type": "photo", "url": "https://example.com/photo.jpg"},
        {"type": "anecdote", "text": "Texto", "url": "https://youtu.be/abcdefghijk"},
        {"type": "anecdote", "text": "x" * 5001},
        {"type": "anecdote", "text": "Texto", "is_positive": "true"},
    ],
)
def test_create_rejects_photos_mixed_content_and_invalid_values(content: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        TypeAdapter(MemoryCreateRequest).validate_python({"title": "Recuerdo", **content})


@pytest.mark.parametrize(
    "url",
    [
        "http://youtu.be/abcdefghijk",
        "https://youtube.com.example.com/watch?v=abcdefghijk",
        "https://www.youtube.com/playlist?list=abcdefghijk",
        "https://open.spotify.com/artist/1234567890123456789012",
        "https://user:secret@youtu.be/abcdefghijk",
    ],
)
def test_song_url_rejects_other_hosts_resources_and_credentials(url: str) -> None:
    with pytest.raises(ValidationError) as error:
        SongCreateRequest(type="song", title="Canción", url=url)
    assert error.value.errors()[0]["type"] == "song_url_invalid"


def test_spotify_track_url_is_normalized_without_tracking() -> None:
    request = SongCreateRequest(
        type="song",
        title="Canción",
        url="https://open.spotify.com/intl-es/track/1234567890123456789012?si=tracking",
    )
    assert request.url == "https://open.spotify.com/track/1234567890123456789012"


def test_patch_preserves_explicit_false_and_omits_unchanged_fields() -> None:
    patch = MemoryPatchRequest(is_positive=False, is_sensitive=True)
    assert patch.model_dump(exclude_unset=True) == {"is_positive": False, "is_sensitive": True}


@pytest.mark.parametrize(
    "fields",
    [
        {},
        {"title": None},
        {"type": "song"},
        {"text": "Texto", "url": "https://youtu.be/abcdefghijk"},
    ],
)
def test_patch_rejects_empty_null_type_changes_and_mixed_content(fields: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        MemoryPatchRequest(**fields)


def test_response_converts_dates_to_utc_and_hides_internal_version() -> None:
    now = datetime.now(timezone(timedelta(hours=-5)))
    response = MemoryResponse.model_validate(
        {
            "id": uuid4(),
            "elder_profile_id": uuid4(),
            "created_by": uuid4(),
            "type": "anecdote",
            "title": "Paseo",
            "text": "Un paseo.",
            "url": None,
            "is_positive": True,
            "is_sensitive": True,
            "entities": [],
            "entities_status": "failed",
            "created_at": now,
            "updated_at": now,
            "content_version": 1,
        }
    )
    assert response.created_at.utcoffset() == timedelta(0)
    assert response.model_dump(mode="json")["updated_at"].endswith("Z")
    assert "content_version" not in response.model_dump()


def test_list_defaults_hide_sensitive_and_bound_pagination() -> None:
    query = MemoryListRequest()
    assert not query.include_sensitive
    assert (query.limit, query.offset) == (20, 0)
    with pytest.raises(ValidationError):
        MemoryListRequest(limit=101)
    with pytest.raises(ValidationError):
        MemoryListRequest(offset=-1)
