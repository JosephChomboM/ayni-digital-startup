from types import SimpleNamespace

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.billing.errors import BillingError
from app.modules.billing.service import BillingService
from tests.integration.billing_helpers import FakeBillingGateway

pytestmark = pytest.mark.integration


def test_cancel_keeps_paid_period_and_is_repeatable(caregiver_account: SimpleNamespace) -> None:
    gateway = FakeBillingGateway()
    with Session(engine) as session:
        service = BillingService(session, gateway)
        service.create_checkout(caregiver_account.user_id)
        subscription_id = gateway.activate(caregiver_account.family_id)
        invoice_id = gateway.subscriptions[subscription_id]["latest_invoice"]
        service.handle_webhook(*gateway.signed_event("invoice.paid", gateway.invoices[invoice_id]))
        before = service.get_status(caregiver_account.user_id)
        canceled = service.cancel_subscription(caregiver_account.user_id)
        assert canceled.cancel_at_period_end and canceled.plan == "family"
        assert canceled.paid_until == before.paid_until
        assert service.cancel_subscription(caregiver_account.user_id) == canceled
    assert gateway.cancel_calls == 1


def test_cannot_cancel_subscription_from_another_family(
    caregiver_account: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    gateway = FakeBillingGateway()
    with Session(engine) as session:
        service = BillingService(session, gateway)
        service.create_checkout(caregiver_account.user_id)
        subscription_id = gateway.activate(caregiver_account.family_id)
        invoice_id = gateway.subscriptions[subscription_id]["latest_invoice"]
        service.handle_webhook(*gateway.signed_event("invoice.paid", gateway.invoices[invoice_id]))
        with pytest.raises(BillingError) as error:
            service.cancel_subscription(other_caregiver_account.user_id)
        assert error.value.code == "subscription_not_found"
        assert service.get_status(caregiver_account.user_id).plan == "family"
    assert gateway.cancel_calls == 0


def test_member_cannot_cancel_family_subscription(family_member: SimpleNamespace) -> None:
    with Session(engine) as session, pytest.raises(BillingError) as error:
        BillingService(session, FakeBillingGateway()).cancel_subscription(family_member.user_id)
    assert error.value.code == "forbidden"
