import base64
import wave
from io import BytesIO

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import ApplicationError
from app.modules.sessions import speech


def recording():
    output = BytesIO()
    with wave.open(output, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(16000)
        stream.writeframes(b"\x01\x00" * 16000)
    return base64.b64encode(output.getvalue()).decode()


def test_cloud_transcription_requires_consent_before_any_request():
    with pytest.raises(ApplicationError) as error:
        speech.transcribe_audio(speech.AudioRequest(audio=recording(), content_type="audio/wav"))
    assert error.value.code == "audio_consent_required"


@pytest.mark.parametrize("audio", ["invalid", base64.b64encode(b"not audio" * 100).decode()])
def test_cloud_transcription_rejects_invalid_or_disguised_files(audio):
    with pytest.raises(ApplicationError) as error:
        speech.transcribe_audio(
            speech.AudioRequest(audio=audio, content_type="audio/wav", consent=True)
        )
    assert error.value.code == "audio_invalid"


def test_transcription_uses_groq_spanish_audio_and_returns_only_the_transcript(monkeypatch):
    monkeypatch.setattr(speech, "get_settings", lambda: Settings(groq_api_key="test"))
    real_client = httpx.Client
    calls = []

    def respond(request):
        calls.append(request)
        assert b"whisper-large-v3" in request.content
        assert b"whisper-large-v3-turbo" not in request.content
        assert b'name="language"' in request.content
        assert b"RIFF" in request.content
        return httpx.Response(200, json={"text": " Paseamos por el parque. ", "duration": 1})

    monkeypatch.setattr(
        speech.httpx, "Client", lambda **_: real_client(transport=httpx.MockTransport(respond))
    )
    result = speech.transcribe_audio(
        speech.AudioRequest(audio=recording(), content_type="audio/wav", consent=True)
    )
    assert result.text == "Paseamos por el parque."
    assert len(calls) == 1


def test_provider_failure_does_not_pretend_that_audio_was_transcribed(monkeypatch):
    monkeypatch.setattr(speech, "get_settings", lambda: Settings(groq_api_key="test"))
    real_client = httpx.Client
    monkeypatch.setattr(
        speech.httpx,
        "Client",
        lambda **_: real_client(
            transport=httpx.MockTransport(lambda request: httpx.Response(429, json={}))
        ),
    )
    with pytest.raises(ApplicationError) as error:
        speech.transcribe_audio(
            speech.AudioRequest(audio=recording(), content_type="audio/wav", consent=True)
        )
    assert error.value.code == "transcription_unavailable"


@pytest.mark.parametrize(
    "result",
    [
        {"text": "", "duration": 3},
        {
            "text": "Gracias por ver el video",
            "duration": 4,
            "segments": [{"avg_logprob": -1.8, "no_speech_prob": 0.95}],
        },
    ],
)
def test_silence_or_unclear_audio_asks_to_repeat_instead_of_claiming_connection_failure(
    monkeypatch, result
):
    monkeypatch.setattr(speech, "get_settings", lambda: Settings(groq_api_key="test"))
    real_client = httpx.Client
    monkeypatch.setattr(
        speech.httpx,
        "Client",
        lambda **_: real_client(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, json=result))
        ),
    )
    with pytest.raises(ApplicationError) as error:
        speech.transcribe_audio(
            speech.AudioRequest(audio=recording(), content_type="audio/wav", consent=True)
        )
    assert error.value.status_code == 422
    assert error.value.code == "audio_not_understood"
