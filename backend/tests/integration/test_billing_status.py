from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.errors import ApplicationError
from app.modules.billing.models import Subscription
from app.modules.billing.service import BillingService

pytestmark = pytest.mark.integration


def test_unsubscribed_family_has_free_plan(caregiver_account: SimpleNamespace) -> None:
    with Session(engine) as session:
        status = BillingService(session).get_status(caregiver_account.user_id)
    assert status.plan == "free" and status.subscription_status == "none"
    assert status.amount_minor == 1990 and status.currency == "PEN" and status.test_mode


def test_status_rejects_missing_account() -> None:
    with Session(engine) as session, pytest.raises(ApplicationError) as error:
        BillingService(session).get_status(uuid4())
    assert error.value.code == "unauthorized"


def test_member_reads_own_plan_and_other_family_stays_free(
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session, session.begin():
        session.add(
            Subscription(
                family_id=caregiver_account.family_id,
                status="active",
                paid_until=datetime.now(UTC) + timedelta(days=30),
                cancel_at_period_end=True,
            )
        )
    with Session(engine) as session:
        service = BillingService(session)
        assert service.get_status(family_member.user_id).plan == "family"
        assert service.get_status(other_caregiver_account.user_id).plan == "free"


def test_expired_paid_period_does_not_grant_family_plan(
    caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session, session.begin():
        session.add(
            Subscription(
                family_id=caregiver_account.family_id,
                status="active",
                paid_until=datetime.now(UTC) - timedelta(seconds=1),
            )
        )
    with Session(engine) as session:
        assert BillingService(session).get_status(caregiver_account.user_id).plan == "free"
