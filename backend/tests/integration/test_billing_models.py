from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.billing.models import CheckoutAttempt, Subscription, WebhookEvent

pytestmark = pytest.mark.integration


def test_subscription_checkout_and_minimal_webhook_are_persisted(
    caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session, session.begin():
        subscription = Subscription(family_id=caregiver_account.family_id)
        checkout = CheckoutAttempt(family_id=caregiver_account.family_id)
        event = WebhookEvent(
            stripe_event_id="evt_model_test",
            family_id=caregiver_account.family_id,
            event_type="invoice.paid",
            stripe_object_id="in_model_test",
            occurred_at=datetime.now(UTC),
        )
        session.add_all([subscription, checkout, event])
        session.flush()
        session.refresh(subscription)
        assert subscription.status == "none"
        assert subscription.paid_until is None
        assert not subscription.cancel_at_period_end
        assert checkout.status == "preparing"
        assert checkout.id is not None
        assert event.processed_at.utcoffset() is not None


def test_database_rejects_two_subscriptions_for_one_family(
    caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session:
        session.add_all(
            [
                Subscription(family_id=caregiver_account.family_id),
                Subscription(family_id=caregiver_account.family_id),
            ]
        )
        with pytest.raises(IntegrityError):
            session.flush()


def test_database_rejects_invalid_subscription_state(caregiver_account: SimpleNamespace) -> None:
    with Session(engine) as session:
        session.add(Subscription(family_id=caregiver_account.family_id, status="fake_paid"))
        with pytest.raises(IntegrityError, match="ck_billing_subscriptions_status"):
            session.flush()
