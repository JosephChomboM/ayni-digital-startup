"""Descarga reproducible de carlfm; el modelo no se incluye en Git."""

import hashlib
from pathlib import Path

import httpx

REVISION = "5ec43b186ef915a195d3ddbcfd9916e76c503c3f"
BASE_URL = f"https://huggingface.co/rhasspy/piper-voices/resolve/{REVISION}/es/es_ES/carlfm/x_low"
DESTINATION = Path(__file__).resolve().parents[1] / "voices"
HASHES = {
    "es_ES-carlfm-x_low.onnx": "d69677323a907cd4963f42b29c20a98b5d6bfa7f3e64df339915e4650c00d125",
    "es_ES-carlfm-x_low.onnx.json": (
        "d9bdfa9ff01eb2bc9e62e7d2593939d1e4c4d8eb7cf75f972731539d12399966"
    ),
    "MODEL_CARD": "a6e62a3d36c37c7702d877f784001208b952e2bf4d17c72a6b5da442fbefb4b3",
}


def main() -> None:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name in ("es_ES-carlfm-x_low.onnx", "es_ES-carlfm-x_low.onnx.json", "MODEL_CARD"):
        target = DESTINATION / name
        with httpx.Client(follow_redirects=True, timeout=120) as client:
            response = client.get(f"{BASE_URL}/{name}")
            response.raise_for_status()
        if hashlib.sha256(response.content).hexdigest() != HASHES[name]:
            raise ValueError(f"La descarga no coincide con la versión verificada: {name}")
        temporary = target.with_suffix(target.suffix + ".download")
        temporary.write_bytes(response.content)
        temporary.replace(target)
        print(f"Descargado {name}: {hashlib.sha256(response.content).hexdigest()}")


if __name__ == "__main__":
    main()
