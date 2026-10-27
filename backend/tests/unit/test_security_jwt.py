import logging
import os
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest

from app.core.security import InvalidAccessTokenError, create_access_token, decode_access_token

pytestmark = pytest.mark.usefixtures("isolated_security_environment")


@pytest.fixture
def claims() -> dict[str, object]:
    now = datetime.now(UTC)
    return {"sub": str(uuid4()), "iat": now, "exp": now + timedelta(minutes=30)}


def sign_claims(claims: dict[str, object]) -> str:
    return jwt.encode(claims, os.environ["JWT_SECRET"], algorithm="HS256")


def test_create_access_token_contains_only_identity_and_expiration() -> None:
    user_id = uuid4()
    before = int(datetime.now(UTC).timestamp())

    encoded = create_access_token(user_id)

    payload = jwt.decode(encoded, os.environ["JWT_SECRET"], algorithms=["HS256"])
    assert set(payload) == {"sub", "iat", "exp"}
    assert payload["sub"] == str(user_id)
    assert before <= payload["iat"] <= int(datetime.now(UTC).timestamp())
    assert payload["exp"] - payload["iat"] == 1800
    assert jwt.get_unverified_header(encoded)["alg"] == "HS256"


@pytest.mark.parametrize(("minutes", "seconds"), [("", 1800), ("15", 900)])
def test_create_access_token_uses_configured_or_default_duration(
    monkeypatch: pytest.MonkeyPatch, minutes: str, seconds: int
) -> None:
    monkeypatch.setenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", minutes)

    encoded = create_access_token(uuid4())

    payload = jwt.decode(encoded, os.environ["JWT_SECRET"], algorithms=["HS256"])
    assert payload["exp"] - payload["iat"] == seconds


def test_decode_access_token_returns_user_uuid() -> None:
    user_id = uuid4()

    assert decode_access_token(create_access_token(user_id)) == user_id


def test_decode_access_token_rejects_signature_from_another_key(claims: dict[str, object]) -> None:
    encoded = jwt.encode(claims, secrets.token_hex(32), algorithm="HS256")

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(encoded)


def test_decode_access_token_rejects_tampered_signature() -> None:
    message, signature = create_access_token(uuid4()).rsplit(".", 1)
    replacement = "A" if signature[0] != "A" else "B"
    modified = f"{message}.{replacement}{signature[1:]}"

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(modified)


@pytest.mark.parametrize("claim", ["sub", "iat", "exp"])
def test_decode_access_token_requires_identity_and_dates(
    claims: dict[str, object], claim: str
) -> None:
    claims.pop(claim)

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(sign_claims(claims))


@pytest.mark.parametrize(
    ("claim", "value"),
    [
        ("sub", "invalid-uuid"),
        ("sub", 123),
        ("sub", None),
        ("iat", "invalid-date"),
        ("iat", None),
        ("iat", []),
        ("exp", "invalid-date"),
        ("exp", None),
        ("exp", []),
        ("exp", 0),
    ],
)
def test_decode_access_token_rejects_invalid_claims(
    claims: dict[str, object], claim: str, value: object
) -> None:
    claims[claim] = value

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(sign_claims(claims))


def test_decode_access_token_rejects_future_issue_date(claims: dict[str, object]) -> None:
    claims["iat"] = datetime.now(UTC) + timedelta(hours=1)

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(sign_claims(claims))


def test_decode_access_token_rejects_token_at_expiration(claims: dict[str, object]) -> None:
    claims["exp"] = int(datetime.now(UTC).timestamp())

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(sign_claims(claims))


def test_decode_access_token_rejects_unapproved_algorithm(claims: dict[str, object]) -> None:
    encoded = jwt.encode(claims, os.environ["JWT_SECRET"], algorithm="HS512")

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(encoded)


def test_decode_access_token_rejects_unsigned_token(claims: dict[str, object]) -> None:
    encoded = jwt.encode(claims, key=None, algorithm="none")

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(encoded)


@pytest.mark.parametrize("encoded", ["", "invalid", "a.b.c", "🌿"])
def test_decode_access_token_rejects_malformed_token(encoded: str) -> None:
    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(encoded)


def test_jwt_utilities_do_not_expose_tokens_or_keys_in_errors_or_logs(
    claims: dict[str, object], caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.DEBUG):
        valid = create_access_token(uuid4())
        decode_access_token(valid)
        claims["exp"] = 0
        expired = sign_claims(claims)
        with pytest.raises(InvalidAccessTokenError) as error:
            decode_access_token(expired)

    for value in (valid, expired, os.environ["JWT_SECRET"]):
        assert value not in str(error.value)
        for record in caplog.records:
            assert value not in str(record.__dict__)
