from collections.abc import Iterator
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.errors import ApplicationError
from app.core.security import create_access_token
from app.main import app
from app.modules.billing import service as billing_service
from app.modules.billing.models import CheckoutAttempt, Subscription
from app.modules.families.models import ElderProfile, Family, User, UserConsent
from app.modules.memories import service as memories_service
from app.modules.memories.models import Memory, MemoryPhoto, MemoryType
from app.modules.responses.models import SessionResponse
from app.modules.sessions.models import FamilySession

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as instance:
        yield instance


@pytest.fixture
def providers(monkeypatch: pytest.MonkeyPatch) -> SimpleNamespace:
    state = SimpleNamespace(removed=[], expired=[], deleted=[], fail_storage=False)

    class Storage:
        def remove(self, bucket: str, keys: list[str]) -> None:
            if state.fail_storage:
                raise ApplicationError(
                    code="photo_storage_unavailable", message="Inténtalo de nuevo.", status_code=503
                )
            state.removed.extend((bucket, key) for key in keys)

    class Gateway:
        def expire_checkout(self, session_id: str) -> dict:
            state.expired.append(session_id)
            return {"id": session_id, "customer": "cus_synthetic", "status": "expired"}

        def delete_customer(self, customer_id: str) -> dict:
            state.deleted.append(customer_id)
            return {"id": customer_id, "deleted": True}

    monkeypatch.setattr(memories_service, "SupabasePhotoStorage", Storage)
    monkeypatch.setattr(billing_service, "StripeGateway", Gateway)
    return state


def auth(account: SimpleNamespace) -> dict[str, str]:
    return {"Authorization": "Bearer " + create_access_token(account.user_id)}


def body(account: SimpleNamespace) -> dict[str, str]:
    return {"password": account.password.get_secret_value(), "confirmation": "ELIMINAR"}


def seed_memory(account: SimpleNamespace, profile_id: UUID) -> tuple[UUID, UUID, str]:
    with Session(engine) as db, db.begin():
        memory = Memory(
            elder_profile_id=profile_id,
            created_by=account.user_id,
            type=MemoryType.ANECDOTE,
            title="Recuerdo de prueba",
            text="Un paseo en familia.",
            is_positive=True,
        )
        db.add(memory)
        db.flush()
        key = f"synthetic/{uuid4()}.png"
        photo = MemoryPhoto(
            memory_id=memory.id,
            created_by=account.user_id,
            bucket="fotos",
            object_key=key,
            content_type="image/png",
            size_bytes=64,
            width=1,
            height=1,
        )
        db.add(photo)
        db.flush()
        return memory.id, photo.id, key


def test_member_deletion_removes_own_memories_and_files_but_preserves_family(
    client: TestClient,
    providers: SimpleNamespace,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    family_member: SimpleNamespace,
) -> None:
    own_memory, own_photo, own_key = seed_memory(family_member, memory_profile_id)
    shared_memory, _, _ = seed_memory(caregiver_account, memory_profile_id)
    headers = auth(family_member)
    result = client.request("DELETE", "/users/me", json=body(family_member), headers=headers)
    assert result.status_code == 204 and result.content == b""
    assert providers.removed == [("fotos", own_key)]
    assert providers.deleted == []
    with Session(engine) as db:
        assert db.get(User, family_member.user_id) is None
        assert db.get(Memory, own_memory) is None and db.get(MemoryPhoto, own_photo) is None
        assert db.get(Family, caregiver_account.family_id) is not None
        assert db.get(ElderProfile, memory_profile_id) is not None
        assert db.get(Memory, shared_memory) is not None
    assert client.get("/users/me", headers=headers).status_code == 401
    assert client.get("/users/me", headers=auth(caregiver_account)).status_code == 200


def test_caregiver_deletion_cleans_family_sessions_responses_billing_and_private_files(
    client: TestClient,
    providers: SimpleNamespace,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    family_member: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    memory, photo, key = seed_memory(family_member, memory_profile_id)
    with Session(engine) as db, db.begin():
        guide = FamilySession(
            elder_profile_id=memory_profile_id,
            created_by=family_member.user_id,
            template_version="1.0",
            duration_minutes=15,
        )
        db.add(guide)
        db.flush()
        reaction = SessionResponse(
            session_id=guide.id,
            elder_profile_id=memory_profile_id,
            created_by=family_member.user_id,
            reaction="receptivo",
            occurred_at=datetime.now(UTC),
        )
        db.add_all(
            [
                reaction,
                Subscription(
                    family_id=caregiver_account.family_id,
                    stripe_customer_id="cus_synthetic",
                    stripe_subscription_id="sub_synthetic",
                    status="active",
                ),
                CheckoutAttempt(
                    family_id=caregiver_account.family_id,
                    stripe_session_id="cs_synthetic",
                    status="open",
                ),
            ]
        )
        db.flush()
        guide_id, reaction_id = guide.id, reaction.id
    headers = auth(caregiver_account)
    result = client.request("DELETE", "/users/me", json=body(caregiver_account), headers=headers)
    assert result.status_code == 204, result.text
    assert providers.expired == ["cs_synthetic"] and providers.deleted == ["cus_synthetic"]
    assert providers.removed == [("fotos", key)]
    with Session(engine) as db:
        for model, key_id in [
            (User, caregiver_account.user_id),
            (User, family_member.user_id),
            (Family, caregiver_account.family_id),
            (ElderProfile, memory_profile_id),
            (Memory, memory),
            (MemoryPhoto, photo),
            (FamilySession, guide_id),
            (SessionResponse, reaction_id),
            (Subscription, caregiver_account.family_id),
        ]:
            assert db.get(model, key_id) is None
        assert db.query(UserConsent).filter_by(user_id=caregiver_account.user_id).count() == 0
        assert db.get(User, other_caregiver_account.user_id) is not None
    assert client.get("/users/me", headers=headers).status_code == 401
    assert client.get("/users/me", headers=auth(other_caregiver_account)).status_code == 200


def test_delete_rejects_incorrect_password_without_starting_cleanup(
    client: TestClient,
    providers: SimpleNamespace,
    caregiver_account: SimpleNamespace,
) -> None:
    result = client.request(
        "DELETE",
        "/users/me",
        json={"password": uuid4().hex, "confirmation": "ELIMINAR"},
        headers=auth(caregiver_account),
    )
    assert result.status_code == 403 and result.json()["detail"]["code"] == "invalid_password"
    assert providers.removed == providers.deleted == []
    assert client.get("/users/me", headers=auth(caregiver_account)).status_code == 200


@pytest.mark.parametrize("extra", [{"confirmation": "no"}, {"family_id": str(uuid4())}])
def test_delete_requires_exact_confirmation_and_rejects_client_scope(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    extra: dict,
) -> None:
    result = client.request(
        "DELETE",
        "/users/me",
        json={**body(caregiver_account), **extra},
        headers=auth(caregiver_account),
    )
    assert result.status_code == 422 and result.json()["detail"]["code"] == "validation_error"


def test_delete_requires_authentication(client: TestClient) -> None:
    result = client.request(
        "DELETE", "/users/me", json={"password": uuid4().hex, "confirmation": "ELIMINAR"}
    )
    assert result.status_code == 401 and result.json()["detail"]["code"] == "unauthorized"


def test_storage_failure_leaves_retryable_private_cleanup_instead_of_false_success(
    client: TestClient,
    providers: SimpleNamespace,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    memory, photo, key = seed_memory(caregiver_account, memory_profile_id)
    providers.fail_storage = True
    result = client.request(
        "DELETE", "/users/me", json=body(caregiver_account), headers=auth(caregiver_account)
    )
    assert result.status_code == 503
    with Session(engine) as db:
        assert db.get(User, caregiver_account.user_id).deletion_pending is True
        assert db.get(Memory, memory).deletion_pending is True
        assert db.get(MemoryPhoto, photo).object_key == key
    pending = client.get("/users/me", headers=auth(caregiver_account))
    assert (
        pending.status_code == 409
        and pending.json()["detail"]["code"] == "account_deletion_pending"
    )
    providers.fail_storage = False
    retry = client.request(
        "DELETE", "/users/me", json=body(caregiver_account), headers=auth(caregiver_account)
    )
    assert retry.status_code == 204 and providers.removed == [("fotos", key)]
    with Session(engine) as db:
        assert db.get(User, caregiver_account.user_id) is None
