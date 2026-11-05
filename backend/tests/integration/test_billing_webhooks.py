from types import SimpleNamespace

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.billing.errors import BillingError
from app.modules.billing.models import WebhookEvent
from app.modules.billing.service import BillingService
from tests.integration.billing_helpers import FakeBillingGateway

pytestmark = pytest.mark.integration


def test_paid_invoice_activates_family_once_and_old_snapshot_does_not_regress(
    caregiver_account: SimpleNamespace,
) -> None:
    gateway = FakeBillingGateway()
    with Session(engine) as session:
        service = BillingService(session, gateway)
        service.create_checkout(caregiver_account.user_id)
        subscription_id = gateway.activate(caregiver_account.family_id)
        remote = gateway.subscriptions[subscription_id]
        payload, signature = gateway.signed_event(
            "invoice.paid", gateway.invoices[remote["latest_invoice"]]
        )
        service.handle_webhook(payload, signature)
        service.handle_webhook(payload, signature)
        status = service.get_status(caregiver_account.user_id)
        assert status.plan == "family" and status.subscription_status == "active"
        with session.begin():
            assert (
                session.scalar(
                    select(func.count())
                    .select_from(WebhookEvent)
                    .where(WebhookEvent.family_id == caregiver_account.family_id)
                )
                == 1
            )
        stale = {**remote, "status": "canceled"}
        service.handle_webhook(*gateway.signed_event("customer.subscription.updated", stale))
        assert service.get_status(caregiver_account.user_id).plan == "family"


def test_invalid_signature_cannot_activate_subscription(caregiver_account: SimpleNamespace) -> None:
    with Session(engine) as session:
        service = BillingService(session, FakeBillingGateway())
        with pytest.raises(BillingError) as error:
            service.handle_webhook(b"{}", "invalid")
        assert error.value.code == "invalid_webhook_signature"
        assert service.get_status(caregiver_account.user_id).plan == "free"


def test_old_payment_does_not_restore_canceled_subscription(
    caregiver_account: SimpleNamespace,
) -> None:
    gateway = FakeBillingGateway()
    with Session(engine) as session:
        service = BillingService(session, gateway)
        service.create_checkout(caregiver_account.user_id)
        subscription_id = gateway.activate(caregiver_account.family_id)
        remote = gateway.subscriptions[subscription_id]
        invoice = gateway.invoices[remote["latest_invoice"]]
        service.handle_webhook(*gateway.signed_event("invoice.paid", invoice))
        remote["status"] = "canceled"
        service.handle_webhook(*gateway.signed_event("invoice.paid", invoice))
        status = service.get_status(caregiver_account.user_id)
        assert status.plan == "free" and status.subscription_status == "canceled"


def test_failed_renewal_does_not_extend_paid_period(caregiver_account: SimpleNamespace) -> None:
    gateway = FakeBillingGateway()
    with Session(engine) as session:
        service = BillingService(session, gateway)
        service.create_checkout(caregiver_account.user_id)
        subscription_id = gateway.activate(caregiver_account.family_id)
        remote = gateway.subscriptions[subscription_id]
        invoice = gateway.invoices[remote["latest_invoice"]]
        service.handle_webhook(*gateway.signed_event("invoice.paid", invoice))
        paid_until = service.get_status(caregiver_account.user_id).paid_until
        remote["status"] = "past_due"
        invoice["status"] = "open"
        invoice["amount_paid"] = 0
        service.handle_webhook(*gateway.signed_event("invoice.payment_failed", invoice))
        status = service.get_status(caregiver_account.user_id)
        assert status.subscription_status == "past_due" and status.paid_until == paid_until
