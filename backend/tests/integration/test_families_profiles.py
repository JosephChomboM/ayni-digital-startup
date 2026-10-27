from collections.abc import Iterator
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import delete, event
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.models import UserConsent
from app.modules.families.service import FamiliesError, FamiliesService

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def service(caregiver_account: SimpleNamespace) -> Iterator[FamiliesService]:
    with Session(engine) as session:
        yield FamiliesService(session)


def test_caregiver_and_member_can_read_their_own_account_family_and_members(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    for account in (caregiver_account, family_member):
        current = service.get_current_user(account.user_id)
        family = service.get_family(account.user_id)
        members = service.list_members(account.user_id)
        assert current.user.id == account.user_id
        assert current.consent.text_version == "1.0"
        assert family.id == caregiver_account.family_id
        assert {member.id for member in members.items} == {
            caregiver_account.user_id,
            family_member.user_id,
        }
        assert other_caregiver_account.user_id not in {member.id for member in members.items}
        assert all(set(member.model_dump()) == {"id", "name", "role"} for member in members.items)
        assert "password_hash" not in current.model_dump_json()


def test_profile_create_replace_and_member_read_preserve_other_family_profile(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session:
        other = FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id,
            name="Otro perfil",
            birth_decade=1950,
            interests=["Cocina"],
        )
    first = service.save_elder_profile(
        caregiver_account.user_id,
        name=" Perfil de prueba ",
        birth_decade=1940,
        interests=[" Música "],
    )
    assert first.name == "Perfil de prueba"
    assert first.interests == ["Música"]
    replaced = service.save_elder_profile(
        caregiver_account.user_id, name="Perfil actualizado", birth_decade=1930, interests=[]
    )
    read = service.get_elder_profile(family_member.user_id)

    assert read.id == first.id == replaced.id
    assert read.created_at == first.created_at
    assert read.name == "Perfil actualizado"
    assert read.interests == []
    assert read.family_id == caregiver_account.family_id
    assert service.get_elder_profile(other_caregiver_account.user_id) == other


@pytest.mark.parametrize("member", [False, True])
def test_reading_missing_profile_returns_not_found(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    member: bool,
) -> None:
    with pytest.raises(FamiliesError) as error:
        service.get_elder_profile(family_member.user_id if member else caregiver_account.user_id)

    assert (error.value.code, error.value.status_code) == ("elder_profile_not_found", 404)


def test_family_member_cannot_write_profile(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
) -> None:
    with pytest.raises(FamiliesError) as error:
        service.save_elder_profile(
            family_member.user_id, name="Perfil", birth_decade=1940, interests=[]
        )
    assert (error.value.code, error.value.status_code) == ("forbidden", 403)
    with pytest.raises(FamiliesError) as missing:
        service.get_elder_profile(caregiver_account.user_id)
    assert missing.value.code == "elder_profile_not_found"


@pytest.mark.parametrize(
    "operation",
    ["get_current_user", "get_family", "list_members", "get_elder_profile", "save_elder_profile"],
)
def test_profile_and_family_services_reject_missing_user(
    service: FamiliesService,
    operation: str,
) -> None:
    with pytest.raises(FamiliesError) as error:
        if operation == "save_elder_profile":
            service.save_elder_profile(uuid4(), name="Perfil", birth_decade=1940, interests=[])
        else:
            getattr(service, operation)(uuid4())
    assert (error.value.code, error.value.status_code) == ("unauthorized", 401)


@pytest.mark.parametrize(
    "changes", [{"name": " "}, {"birth_decade": 1945}, {"interests": ["Música"] * 21}]
)
def test_profile_service_validates_input_before_writing(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    changes: dict[str, object],
) -> None:
    data = {"name": "Perfil", "birth_decade": 1940, "interests": []}
    data.update(changes)
    with pytest.raises(ValidationError):
        service.save_elder_profile(caregiver_account.user_id, **data)
    with pytest.raises(FamiliesError) as missing:
        service.get_elder_profile(caregiver_account.user_id)
    assert missing.value.code == "elder_profile_not_found"


def test_profile_commit_failure_preserves_previous_profile(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
) -> None:
    first = service.save_elder_profile(
        caregiver_account.user_id, name="Perfil", birth_decade=1940, interests=["Música"]
    )

    def fail(session: Session) -> None:
        raise RuntimeError("Fallo simulado")

    event.listen(service.session, "before_commit", fail, once=True)
    with pytest.raises(RuntimeError, match="Fallo simulado"):
        service.save_elder_profile(
            caregiver_account.user_id, name="Cambio", birth_decade=1950, interests=[]
        )
    assert service.get_elder_profile(caregiver_account.user_id) == first


@pytest.mark.parametrize(
    "operation", ["get_family", "list_members", "get_elder_profile", "list_invitations"]
)
def test_family_services_report_family_not_found(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    operation: str,
) -> None:
    monkeypatch.setattr(service.repository, "get_family", lambda *args, **kwargs: None)
    with pytest.raises(FamiliesError) as error:
        getattr(service, operation)(caregiver_account.user_id)
    assert (error.value.code, error.value.status_code) == ("family_not_found", 404)


def test_inconsistent_account_without_consent_returns_generic_internal_error(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
) -> None:
    with engine.begin() as connection:
        connection.execute(
            delete(UserConsent).where(UserConsent.user_id == caregiver_account.user_id)
        )
    with pytest.raises(FamiliesError) as error:
        service.get_current_user(caregiver_account.user_id)
    assert (error.value.code, error.value.status_code) == ("internal_error", 500)
    assert caregiver_account.email not in error.value.message
