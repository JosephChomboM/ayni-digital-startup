import base64
import binascii
import re
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, StrictBool

from app.core.config import get_settings
from app.core.errors import ApplicationError


class AudioRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    audio: str = Field(max_length=1_400_000, repr=False)
    content_type: Literal["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"]
    consent: StrictBool = False


class Transcript(BaseModel):
    text: str


def transcribe_audio(data: AudioRequest) -> Transcript:
    if not data.consent:
        raise ApplicationError(
            code="audio_consent_required",
            status_code=422,
            message="Activa la transcripción mejorada para compartir esta grabación con Groq.",
        )
    extensions = {"audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav"}
    try:
        audio = base64.b64decode(data.audio, validate=True)
        signatures = {
            "audio/webm": audio.startswith(b"\x1aE\xdf\xa3"),
            "audio/ogg": audio.startswith(b"OggS"),
            "audio/wav": audio.startswith(b"RIFF") and audio[8:12] == b"WAVE",
            "audio/mp4": audio[4:8] == b"ftyp",
        }
        if not 44 <= len(audio) <= 1_000_000 or not signatures[data.content_type]:
            raise ValueError
    except (ValueError, binascii.Error):
        raise ApplicationError(
            code="audio_invalid",
            status_code=422,
            message="La grabación no es válida o supera 1 MB. Graba una respuesta breve.",
        ) from None
    settings = get_settings()
    if not settings.groq_api_key:
        raise ApplicationError(
            code="conversation_ai_not_configured",
            status_code=503,
            message="La transcripción mejorada no está configurada. Puedes usar el dictado local.",
        )
    try:
        with httpx.Client(timeout=settings.conversation_timeout_seconds) as client:
            response = client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": "Bearer " + settings.groq_api_key},
                files={
                    "file": ("voice." + extensions[data.content_type], audio, data.content_type)
                },
                data={
                    "model": "whisper-large-v3-turbo",
                    "language": "es",
                    "temperature": "0",
                    "response_format": "verbose_json",
                },
            )
            response.raise_for_status()
            result = response.json()
            if not isinstance(result, dict) or float(result.get("duration", 0)) > 40:
                raise ValueError
            text = re.sub(r"\s+", " ", str(result.get("text", ""))).strip()[:500]
            if not text:
                raise ValueError
            return Transcript(text=text)
    except (httpx.HTTPError, ValueError, TypeError, KeyError):
        raise ApplicationError(
            code="transcription_unavailable",
            status_code=503,
            message=(
                "No pudimos transcribir esta respuesta. Puedes reintentar o usar el dictado local."
            ),
        ) from None
