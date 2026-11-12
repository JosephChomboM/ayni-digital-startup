from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.billing.errors import BillingError
from app.modules.billing.models import Subscription
from app.modules.billing.service import BillingService

pytestmark = pytest.mark.integration


def test_free_family_session_quota_has_a_seven_day_window(
    caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session:
        policy = BillingService(session).get_session_quota(caregiver_account.user_id)
    assert policy.window_days == 7
    policy.require_capacity(0)
    with pytest.raises(BillingError) as error:
        policy.require_capacity(1)
    assert error.value.code == "session_limit_reached"


def test_paid_family_has_no_session_limit_until_paid_period_expires(
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
        BillingService(session).get_session_quota(caregiver_account.user_id).require_capacity(50)
        with session.begin():
            subscription.paid_until = datetime.now(UTC) - timedelta(seconds=1)
        with pytest.raises(BillingError):
            BillingService(session).get_session_quota(caregiver_account.user_id).require_capacity(1)
