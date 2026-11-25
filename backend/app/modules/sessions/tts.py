"""Voz carlfm generada en el servidor, sin enviar el texto a proveedores externos."""

import json
import wave
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field

from app.core.errors import ApplicationError

if TYPE_CHECKING:
    from piper import PiperVoice

VOICE_PATH = Path(__file__).resolve().parents[3] / "voices" / "es_ES-carlfm-x_low.onnx"
_synthesis_lock = Lock()


class VoiceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, hide_input_in_errors=True)
    text: str = Field(min_length=1, max_length=400, repr=False)


@lru_cache(maxsize=1)
def load_voice() -> "PiperVoice":
    import onnxruntime
    from piper import PiperVoice
    from piper.config import PiperConfig

    # Un solo hilo de inferencia para no saturar el plan gratuito del servidor.
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    options.enable_cpu_mem_arena = False
    config = json.loads(VOICE_PATH.with_suffix(".onnx.json").read_text(encoding="utf-8"))
    return PiperVoice(
        config=PiperConfig.from_dict(config),
        session=onnxruntime.InferenceSession(
            str(VOICE_PATH), sess_options=options, providers=["CPUExecutionProvider"]
        ),
        download_dir=VOICE_PATH.parent,
    )


def synthesize_voice(data: VoiceRequest) -> bytes:
    if not _synthesis_lock.acquire(blocking=False):
        raise ApplicationError(
            code="voice_busy",
            status_code=503,
            message="La voz está ocupada. Puedes seguir leyendo.",
        )
    try:
        from piper import SynthesisConfig

        output = BytesIO()
        with wave.open(output, "wb") as audio:
            load_voice().synthesize_wav(
                data.text, audio, syn_config=SynthesisConfig(length_scale=1.05)
            )
        return output.getvalue()
    except Exception:
        # No registrar el texto ni detalles de recuerdos familiares.
        raise ApplicationError(
            code="voice_unavailable",
            status_code=503,
            message="La voz no está disponible. Puedes seguir leyendo.",
        ) from None
    finally:
        _synthesis_lock.release()
