import secrets
from functools import lru_cache
from typing import cast

from pydantic import SecretStr
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.core.security_settings import get_security_settings
from app.modules.families.consent import CONSENT_TEXT, CONSENT_TEXT_VERSION
from app.modules.families.models import UserRole
from app.modules.families.repository import FamiliesRepository
from app.modules.families.schemas import (
    AuthenticationResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
)


@lru_cache(maxsize=1)
def _dummy_password_hash() -> str:
    return hash_password(secrets.token_urlsafe(32))


class FamiliesError(Exception):
    def __init__(self, *, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class FamiliesService:
    """Own the transaction for each write operation; use a dedicated session."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = FamiliesRepository(session)

    def login(self, *, email: str, password: SecretStr | str) -> AuthenticationResponse:
        request = LoginRequest(email=email, password=password)
        with self.session.begin():
            user = self.repository.get_user_by_email(request.email)
            encoded = user.password_hash if user is not None else _dummy_password_hash()
            matches = verify_password(request.password.get_secret_value(), encoded)
            if user is None or not matches:
                raise FamiliesError(
                    code="invalid_credentials",
                    message="El correo o la contraseña no son correctos.",
                    status_code=401,
                )
            return AuthenticationResponse.model_validate(
                {
                    "access_token": create_access_token(user.id),
                    "expires_in": get_security_settings().jwt_access_token_expire_minutes * 60,
                    "user": user,
                }
            )

    def register_caregiver(
        self,
        *,
        email: str,
        name: str,
        password: SecretStr | str,
        family_name: str,
        accepted: bool = False,
        text_version: str | None = None,
    ) -> RegisterResponse:
        if accepted is not True:
            raise FamiliesError(
                code="consent_required",
                message="Acepta el consentimiento para continuar.",
                status_code=422,
            )
        if text_version != CONSENT_TEXT_VERSION:
            raise FamiliesError(
                code="consent_version_invalid",
                message="Revisa y acepta la versión actual del consentimiento.",
                status_code=422,
            )
        request = RegisterRequest(
            email=email,
            name=name,
            password=password,
            family_name=family_name,
            consent={"accepted": accepted, "text_version": text_version},
        )
        try:
            with self.session.begin():
                if self.repository.get_user_by_email(request.email) is not None:
                    raise self._email_already_registered()
                encoded = hash_password(request.password.get_secret_value())
                family = self.repository.create_family(name=cast(str, request.family_name))
                user = self.repository.create_user(
                    family_id=family.id,
                    email=request.email,
                    name=request.name,
                    password_hash=encoded,
                    role=UserRole.PRIMARY_CAREGIVER,
                )
                consent = self.repository.create_consent(
                    user_id=user.id, text_version=CONSENT_TEXT_VERSION, text=CONSENT_TEXT
                )
                response = RegisterResponse.model_validate(
                    {"user": user, "family": family, "consent": consent}
                )
        except IntegrityError as exc:
            if (
                getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
                == "uq_users_email"
            ):
                raise self._email_already_registered() from None
            raise
        return response

    @staticmethod
    def _email_already_registered() -> FamiliesError:
        return FamiliesError(
            code="email_already_registered",
            message="Este correo ya está registrado. Inicia sesión.",
            status_code=409,
        )
