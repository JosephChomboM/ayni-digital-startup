import warnings
from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePath

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import ApplicationError
from app.modules.memories.photo_settings import PHOTO_MAX_BYTES, PHOTO_MAX_PIXELS


@dataclass(frozen=True)
class ValidatedPhoto:
    data: bytes
    content_type: str
    extension: str
    width: int
    height: int


def _invalid_photo() -> ApplicationError:
    return ApplicationError(
        code="photo_format_invalid",
        message="Elige una foto JPG, PNG o WebP válida.",
        status_code=422,
    )


def _too_large() -> ApplicationError:
    return ApplicationError(
        code="photo_too_large",
        message="La foto debe pesar como máximo 8 MB.",
        status_code=413,
    )


def validate_photo(data: bytes, content_type: str, filename: str) -> ValidatedPhoto:
    if len(data) > PHOTO_MAX_BYTES:
        raise _too_large()
    formats = {
        "JPEG": ("image/jpeg", ".jpg", {".jpg", ".jpeg"}),
        "PNG": ("image/png", ".png", {".png"}),
        "WEBP": ("image/webp", ".webp", {".webp"}),
    }
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                image_format = source.format
                if image_format not in formats or getattr(source, "n_frames", 1) != 1:
                    raise _invalid_photo()
                mime, extension, suffixes = formats[image_format]
                if content_type != mime or PurePath(filename).suffix.lower() not in suffixes:
                    raise _invalid_photo()
                if source.width * source.height > PHOTO_MAX_PIXELS:
                    raise ApplicationError(
                        code="photo_dimensions_invalid",
                        message="Elige una foto de hasta 20 millones de píxeles.",
                        status_code=422,
                    )
                source.verify()
            with Image.open(BytesIO(data)) as source:
                oriented = ImageOps.exif_transpose(source)
                mode = "RGB" if image_format == "JPEG" else "RGBA"
                pixels = oriented.convert(mode)
                # Copy only pixels: names, EXIF, GPS and other embedded metadata are omitted.
                clean = Image.frombytes(mode, pixels.size, pixels.tobytes())
                output = BytesIO()
                clean.save(output, format=image_format)
                encoded = output.getvalue()
                if len(encoded) > PHOTO_MAX_BYTES:
                    raise _too_large()
                return ValidatedPhoto(encoded, mime, extension, clean.width, clean.height)
    except (
        UnidentifiedImageError,
        SyntaxError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise _invalid_photo() from None
