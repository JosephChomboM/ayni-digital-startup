import httpx

from app.modules.memories import song_metadata as songs


def test_artist_search_survives_an_unavailable_video_title(monkeypatch):
    songs.search_song.cache_clear()
    real_client = httpx.Client
    monkeypatch.setattr(
        songs.httpx,
        "Client",
        lambda **_: real_client(transport=httpx.MockTransport(lambda _: httpx.Response(400))),
    )
    calls = []

    def music(path, **params):
        calls.append(params)
        return {
            "recordings": [
                {
                    "id": "f4ca25fa-66e1-43bb-836b-912131879a43",
                    "score": 100,
                    "title": "Never Gonna Give You Up",
                    "first-release-date": "1987-07-27",
                    "artist-credit": [{"name": "Rick Astley"}],
                }
            ]
        }

    monkeypatch.setattr(songs, "_music", music)
    result = songs.search_song(
        "https://www.youtube.com/watch?v=dQw4w9WgXc",
        "Recuerdo favorito",
        "Rick Astley - Never Gonna Give You Up",
    )
    assert calls[0]["query"] == 'recording:"Never Gonna Give You Up" AND artist:"Rick Astley"'
    assert result["status"] == "needs_confirmation"
    assert result["candidates"][0]["year"] == 1987
    assert result["candidates"][0]["artist"] == "Rick Astley"
    songs.search_song.cache_clear()


def test_artist_genres_do_not_become_recording_genres():
    result = songs._recording(
        {
            "id": "f4ca25fa-66e1-43bb-836b-912131879a43",
            "artist-credit": [{"artist": {"name": "Artista", "genres": [{"name": "pop"}]}}],
        }
    )
    assert result["year"] is None
    assert result["genres"] == []
    assert result["artist_genres"] == ["pop"]
