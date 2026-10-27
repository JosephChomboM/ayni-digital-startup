from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.security_settings import get_security_settings

_password_hasher = PasswordHasher()


class InvalidAccessTokenError(ValueError):
    """The supplied access token cannot authenticate a user."""


def hash_password(password: str) -> str:
    """Create an Argon2id hash with a fresh random salt."""
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Return False for a mismatched password or malformed stored hash."""
    try:
        return _password_hasher.verify(password_hash, password)
    except (InvalidHashError, VerificationError, UnicodeEncodeError):
        return False


def create_access_token(user_id: UUID) -> str:
    settings = get_security_settings()
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
        },
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )


def decode_access_token(token: str) -> UUID:
    """Validate the signature, required claims and expiry, then return the user ID."""
    settings = get_security_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            options={"require": ["sub", "iat", "exp"]},
        )
        return UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError):
        raise InvalidAccessTokenError(
            "Tu sesión no es válida o ya venció. Vuelve a iniciar sesión."
        ) from None
