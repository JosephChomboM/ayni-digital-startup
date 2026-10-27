import logging
import secrets

import pytest

from app.core.security import hash_password, verify_password


def test_hash_password_creates_argon2id_hash_that_fits_storage() -> None:
    password_value = secrets.token_urlsafe(24)

    encoded = hash_password(password_value)

    assert encoded.startswith("$argon2id$")
    assert password_value not in encoded
    assert len(encoded) <= 255


def test_verify_password_accepts_correct_password() -> None:
    password_value = secrets.token_urlsafe(24)

    assert verify_password(password_value, hash_password(password_value)) is True


def test_verify_password_rejects_wrong_password() -> None:
    password_value = secrets.token_urlsafe(24)
    encoded = hash_password(password_value)

    assert verify_password(password_value + "x", encoded) is False


def test_hash_password_uses_a_fresh_salt_for_each_call() -> None:
    password_value = secrets.token_urlsafe(24)

    first = hash_password(password_value)
    second = hash_password(password_value)

    assert first != second
    assert verify_password(password_value, first) is True
    assert verify_password(password_value, second) is True


@pytest.mark.parametrize("encoded", ["", "invalid", "$argon2id$", "$argon2id$v=19$m=invalid", "ñ"])
def test_verify_password_rejects_malformed_stored_hash(encoded: str) -> None:
    assert verify_password(secrets.token_urlsafe(24), encoded) is False


def test_password_whitespace_unicode_and_case_are_preserved() -> None:
    password_value = f"  Ñá-{secrets.token_urlsafe(24)}  "
    encoded = hash_password(password_value)

    assert verify_password(password_value, encoded) is True
    assert verify_password(password_value.strip(), encoded) is False
    assert verify_password(password_value.swapcase(), encoded) is False


def test_hashing_and_verification_do_not_log_sensitive_values(
    caplog: pytest.LogCaptureFixture,
) -> None:
    password_value = secrets.token_urlsafe(24)
    malformed_value = secrets.token_urlsafe(24)
    with caplog.at_level(logging.DEBUG):
        encoded = hash_password(password_value)
        assert verify_password(password_value, encoded) is True
        assert verify_password(password_value + "x", encoded) is False
        assert verify_password(password_value, malformed_value) is False

    for record in caplog.records:
        for value in (password_value, encoded, malformed_value):
            assert value not in str(record.__dict__)
