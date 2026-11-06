from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.billing.errors import BillingError
from app.modules.billing.models import Subscription
from app.modules.billing.service import BillingService

pytestmark = pytest.mark.integration


def test_free_plan_rejects_eleventh_photo(caregiver_account: SimpleNamespace) -> None:
    with Session(engine) as session:
        policy = BillingService(session).get_photo_quota(caregiver_account.user_id)
    policy.require_capacity(9)
    with pytest.raises(BillingError) as error:
        policy.require_capacity(10)
    assert error.value.code == "photo_limit_reached"


def test_cancellation_preserves_unlimited_photos_only_for_paid_period(
    caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session:
        with session.begin():
            subscription = Subscription(
                family_id=caregiver_account.family_id,
                status="active",
                paid_until=datetime.now(UTC) + timedelta(days=1),
                cancel_at_period_end=True,
            )
            session.add(subscription)
        BillingService(session).get_photo_quota(caregiver_account.user_id).require_capacity(100)
        with session.begin():
            subscription.paid_until = datetime.now(UTC) - timedelta(seconds=1)
        policy = BillingService(session).get_photo_quota(caregiver_account.user_id)
        with pytest.raises(BillingError) as error:
            policy.require_capacity(10)
        assert error.value.code == "photo_limit_reached"
