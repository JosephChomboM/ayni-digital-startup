import secrets
from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.families.models import UserRole
from app.modules.families.schemas import (
    AuthenticationResponse,
    ConsentAcceptance,
    ConsentResponse,
    ElderProfileRequest,
    InvitationCreatedResponse,
    InvitationCreateRequest,
    InvitationResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    UserResponse,
)


@pytest.fixture
def registration_data() -> dict[str, object]:
    return {
        "email": "  CUIDADOR@EXAMPLE.COM  ",
        "name": "  Persona de prueba  ",
        "password": secrets.token_urlsafe(16),
        "consent": {"accepted": True, "text_version": "1.0"},
        "family_name": "  Familia de prueba  ",
    }


@pytest.fixture
def user_record() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        email="cuidador@example.com",
        name="Persona de prueba",
        family_id=uuid4(),
        role=UserRole.PRIMARY_CAREGIVER,
        created_at=datetime(2026, 10, 26, 9, 30, tzinfo=timezone(timedelta(hours=-5))),
        password_hash=secrets.token_hex(32),
    )


def test_caregiver_registration_normalizes_email_and_names(
    registration_data: dict[str, object],
) -> None:
    request = RegisterRequest.model_validate(registration_data)

    assert request.email == "cuidador@example.com"
    assert request.name == "Persona de prueba"
    assert request.family_name == "Familia de prueba"
    assert request.invitation_token is None


def test_invited_registration_protects_sensitive_fields(
    registration_data: dict[str, object],
) -> None:
    registration_data.pop("family_name")
    invitation_value = secrets.token_urlsafe(24)
    password_value = " " + secrets.token_urlsafe(16) + " "
    registration_data.update(invitation_token=invitation_value, password=password_value)

    request = RegisterRequest.model_validate(registration_data)

    assert request.family_name is None
    assert request.invitation_token is not None
    assert request.invitation_token.get_secret_value() == invitation_value
    assert request.password.get_secret_value() == password_value
    for value in (invitation_value, password_value):
        assert value not in repr(request)
        assert value not in request.model_dump_json()


@pytest.mark.parametrize(
    "changes",
    [
        {"email": "sin-correo"},
        {"email": "   "},
        {"name": "   "},
        {"name": "a" * 101},
        {"family_name": ""},
        {"family_name": None},
        {"invitation_token": secrets.token_urlsafe(24)},
        {"family_name": None, "invitation_token": ""},
        {"role": "cuidador_principal"},
        {"family_id": str(uuid4())},
        {"consent": {"accepted": True, "text_version": ""}},
    ],
)
def test_registration_rejects_invalid_data_and_client_assigned_permissions(
    registration_data: dict[str, object], changes: dict[str, object]
) -> None:
    registration_data.update(changes)

    with pytest.raises(ValidationError) as error:
        RegisterRequest.model_validate(registration_data)

    assert registration_data["password"] not in str(error.value)


@pytest.mark.parametrize("accepted", [False, "true", 1, None])
def test_consent_requires_explicit_boolean_acceptance(accepted: object) -> None:
    with pytest.raises(ValidationError) as error:
        ConsentAcceptance.model_validate({"accepted": accepted, "text_version": "1.0"})

    if accepted is False:
        assert error.value.errors()[0]["type"] == "consent_required"


def test_client_cannot_set_consent_acceptance_date() -> None:
    with pytest.raises(ValidationError):
        ConsentAcceptance.model_validate(
            {"accepted": True, "text_version": "1.0", "accepted_at": datetime.now(UTC)}
        )


@pytest.mark.parametrize("length", [0, 9, 10])
def test_registration_password_minimum_length(
    registration_data: dict[str, object], length: int
) -> None:
    registration_data["password"] = secrets.token_hex(8)[:length]

    if length < 10:
        with pytest.raises(ValidationError):
            RegisterRequest.model_validate(registration_data)
    else:
        request = RegisterRequest.model_validate(registration_data)
        assert len(request.password.get_secret_value()) == 10


def test_login_normalizes_email_and_preserves_password() -> None:
    password_value = " " + secrets.token_urlsafe(16) + " "
    request = LoginRequest(email="  FAMILIAR@EXAMPLE.COM  ", password=password_value)

    assert request.email == "familiar@example.com"
    assert request.password.get_secret_value() == password_value
    assert password_value not in request.model_dump_json()


def test_login_rejects_short_password() -> None:
    with pytest.raises(ValidationError):
        LoginRequest(email="familiar@example.com", password=secrets.token_hex(4))


def test_invitation_creation_normalizes_email_and_rejects_role_override() -> None:
    assert InvitationCreateRequest(email="  FAMILIAR@EXAMPLE.COM  ").email == "familiar@example.com"

    with pytest.raises(ValidationError):
        InvitationCreateRequest.model_validate(
            {"email": "familiar@example.com", "role": "cuidador_principal"}
        )


def test_profile_accepts_empty_interests_and_trims_text() -> None:
    request = ElderProfileRequest(name="  Familiar de prueba  ", birth_decade=1940, interests=[])

    assert request.name == "Familiar de prueba"
    assert request.interests == []
    with_interests = ElderProfileRequest(name="Perfil", birth_decade=1940, interests=[" Música "])
    assert with_interests.interests == ["Música"]


@pytest.mark.parametrize(
    "changes",
    [
        {"birth_decade": 1945},
        {"birth_decade": 9990},
        {"birth_decade": -10},
        {"birth_decade": "1940"},
        {"birth_decade": 1940.0},
        {"birth_decade": True},
        {"name": "   "},
        {"interests": ["   "]},
        {"interests": ["a" * 101]},
        {"interests": ["Música"] * 21},
    ],
)
def test_profile_rejects_invalid_decades_and_interests(changes: dict[str, object]) -> None:
    data = {"name": "Perfil de prueba", "birth_decade": 1940, "interests": []}
    data.update(changes)

    with pytest.raises(ValidationError):
        ElderProfileRequest.model_validate(data)


def test_user_response_reads_attributes_without_exposing_hash_and_uses_utc(
    user_record: SimpleNamespace,
) -> None:
    response = UserResponse.model_validate(user_record)
    data = response.model_dump(mode="json")

    assert data["created_at"] == "2026-10-26T14:30:00Z"
    assert data["role"] == "cuidador_principal"
    assert "password_hash" not in data
    assert user_record.password_hash not in response.model_dump_json()


def test_response_rejects_timestamp_without_timezone() -> None:
    with pytest.raises(ValidationError):
        ConsentResponse(text_version="1.0", accepted_at=datetime(2026, 10, 26))


def test_registration_response_has_no_token(user_record: SimpleNamespace) -> None:
    response = RegisterResponse.model_validate(
        {
            "user": user_record,
            "family": {
                "id": user_record.family_id,
                "name": "Familia de prueba",
                "created_at": user_record.created_at,
            },
            "consent": {"text_version": "1.0", "accepted_at": user_record.created_at},
            "access_token": secrets.token_urlsafe(24),
        }
    )

    assert set(response.model_dump()) == {"user", "family", "consent"}


def test_authentication_response_returns_bearer_token_and_expiration(
    user_record: SimpleNamespace,
) -> None:
    token_value = secrets.token_urlsafe(24)
    response = AuthenticationResponse.model_validate(
        {"access_token": token_value, "expires_in": 1800, "user": user_record}
    )

    assert response.model_dump(mode="json")["access_token"] == token_value
    assert response.token_type == "bearer"  # noqa: S105 -- Fixed protocol label.
    assert response.expires_in == 1800
    assert token_value not in repr(response)


@pytest.mark.parametrize("changes", [{"token_type": "basic"}, {"expires_in": 0}])
def test_authentication_response_rejects_invalid_token_metadata(
    user_record: SimpleNamespace, changes: dict[str, object]
) -> None:
    data = {"access_token": secrets.token_urlsafe(24), "expires_in": 1800, "user": user_record}
    data.update(changes)

    with pytest.raises(ValidationError):
        AuthenticationResponse.model_validate(data)


def test_invitation_response_only_exposes_token_on_creation() -> None:
    now = datetime.now(UTC)
    token_value = secrets.token_urlsafe(24)
    invitation = InvitationResponse.model_validate(
        {
            "id": uuid4(),
            "email": "familiar@example.com",
            "role": "familiar",
            "status": "pending",
            "created_at": now,
            "expires_at": now + timedelta(hours=72),
            "accepted_at": None,
            "revoked_at": None,
            "token_hash": secrets.token_hex(32),
        }
    )
    created = InvitationCreatedResponse(invitation=invitation, invitation_token=token_value)

    assert "token_hash" not in invitation.model_dump()
    assert "invitation_token" not in invitation.model_dump()
    assert created.model_dump(mode="json")["invitation_token"] == token_value
    assert token_value not in repr(created)
