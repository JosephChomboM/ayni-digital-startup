from io import BytesIO

import pytest
from PIL import Image

from app.core.errors import ApplicationError
from app.modules.memories.photo_images import validate_photo
from app.modules.memories.photo_settings import PHOTO_MAX_BYTES


@pytest.mark.parametrize(
    "image_format,mime,suffix",
    [
        ("JPEG", "image/jpeg", ".jpg"),
        ("PNG", "image/png", ".png"),
        ("WEBP", "image/webp", ".webp"),
    ],
)
def test_valid_photos_are_decoded_and_metadata_is_removed(
    image_format: str, mime: str, suffix: str
) -> None:
    image = Image.new("RGB", (8, 6), "green")
    exif = Image.Exif()
    exif[270] = "Private embedded note"
    data = BytesIO()
    image.save(data, format=image_format, exif=exif)
    photo = validate_photo(data.getvalue(), mime, "foto" + suffix)
    with Image.open(BytesIO(photo.data)) as clean:
        assert clean.size == (8, 6)
        assert not clean.getexif()
    assert photo.content_type == mime


def test_invalid_or_mislabeled_file_is_rejected() -> None:
    with pytest.raises(ApplicationError) as error:
        validate_photo(b"not a real image", "image/png", "foto.png")
    assert error.value.code == "photo_format_invalid"
    data = BytesIO()
    Image.new("RGB", (1, 1)).save(data, format="PNG")
    with pytest.raises(ApplicationError) as error:
        validate_photo(data.getvalue(), "image/jpeg", "foto.jpg")
    assert error.value.code == "photo_format_invalid"


def test_oversized_file_is_rejected_before_image_decode() -> None:
    with pytest.raises(ApplicationError) as error:
        validate_photo(b"x" * (PHOTO_MAX_BYTES + 1), "image/png", "foto.png")
    assert error.value.status_code == 413
