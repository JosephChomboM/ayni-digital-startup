import wave
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.error_handlers import register_error_handlers
from app.core.errors import ApplicationError
from app.modules.sessions import router, tts


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router.router)
    app.dependency_overrides[router.get_authenticated_user_id] = lambda: uuid4()
    app.dependency_overrides[router.get_sessions_service] = lambda: SimpleNamespace(
        get_session=lambda *_: None
    )
    monkeypatch.setattr(router, "synthesize_voice", lambda _: b"RIFFtestWAVE")
    return TestClient(app)


def test_voice_returns_private_audio_after_checking_session(client):
    response = client.post(f"/sessions/{uuid4()}/voice", json={"text": "Hola, soy Ayni."})
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert response.headers["cache-control"] == "no-store"
    assert response.content == b"RIFFtestWAVE"


@pytest.mark.parametrize("text", ["", "   ", "a" * 401])
def test_voice_rejects_empty_or_excessive_requests(client, text):
    assert client.post(f"/sessions/{uuid4()}/voice", json={"text": text}).status_code == 422


def test_foreign_session_cannot_generate_audio(client, monkeypatch):
    def forbidden(*_):
        raise ApplicationError(code="forbidden", status_code=403, message="Sin acceso")

    client.app.dependency_overrides[router.get_sessions_service] = lambda: SimpleNamespace(
        get_session=forbidden
    )
    monkeypatch.setattr(router, "synthesize_voice", lambda _: pytest.fail("No debe generar audio"))
    assert client.post(f"/sessions/{uuid4()}/voice", json={"text": "Hola"}).status_code == 403


def test_voice_requires_authentication(client):
    client.app.dependency_overrides.pop(router.get_authenticated_user_id)
    assert client.post(f"/sessions/{uuid4()}/voice", json={"text": "Hola"}).status_code == 401


def test_piper_failure_is_recoverable_and_releases_lock(monkeypatch):
    def fail():
        raise OSError("Modelo ausente")

    monkeypatch.setattr(tts, "load_voice", fail)
    for _ in range(2):
        with pytest.raises(ApplicationError) as error:
            tts.synthesize_voice(tts.VoiceRequest(text="Un recuerdo privado"))
        assert error.value.code == "voice_unavailable"
        assert "privado" not in error.value.message


def test_piper_outputs_valid_wav(monkeypatch):
    class FakeVoice:
        def synthesize_wav(self, text, audio, syn_config):
            assert text == "Hola"
            assert syn_config.length_scale == 1.05
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(16000)
            audio.writeframes(b"\x00\x00" * 160)

    monkeypatch.setattr(tts, "load_voice", lambda: FakeVoice())
    with wave.open(BytesIO(tts.synthesize_voice(tts.VoiceRequest(text="Hola")))) as audio:
        assert audio.getframerate() == 16000
        assert audio.getnframes() == 160


def test_busy_engine_does_not_queue_unbounded_requests():
    with tts._synthesis_lock:
        with pytest.raises(ApplicationError) as error:
            tts.synthesize_voice(tts.VoiceRequest(text="Hola"))
    assert error.value.code == "voice_busy"
