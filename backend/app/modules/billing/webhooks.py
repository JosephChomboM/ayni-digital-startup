from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.billing.errors import BillingError
from app.modules.billing.gateway import BillingGateway
from app.modules.billing.repository import BillingRepository
from app.modules.billing.schemas import WebhookResponse


class BillingWebhookProcessor:
    def __init__(self, session: Session, gateway: BillingGateway) -> None:
        self.session = session
        self.gateway = gateway
        self.repository = BillingRepository(session)

    @staticmethod
    def _invalid() -> BillingError:
        return BillingError(
            code="invalid_webhook_payload",
            message="El aviso de pago no es válido.",
            status_code=400,
        )

    @staticmethod
    def _id(value: Any) -> str | None:
        if isinstance(value, str):
            return value
        if isinstance(value, dict) and isinstance(value.get("id"), str):
            return value["id"]
        return None

    @staticmethod
    def _owner(remote: dict[str, Any]) -> tuple[UUID, UUID] | None:
        metadata = remote.get("metadata") or {}
        try:
            return UUID(metadata["family_id"]), UUID(metadata["attempt_id"])
        except (ValueError, KeyError, TypeError, AttributeError):
            return None

    @classmethod
    def _invoice_subscription(cls, invoice: dict[str, Any]) -> str | None:
        parent = invoice.get("parent") or {}
        details = parent.get("subscription_details") or {}
        return cls._id(details.get("subscription") or invoice.get("subscription"))

    def _matches_plan(self, remote: dict[str, Any]) -> bool:
        items = (remote.get("items") or {}).get("data") or []
        if remote.get("livemode") is not False or len(items) != 1:
            return False
        item = items[0]
        price = item.get("price") or {}
        recurring = price.get("recurring") or {}
        return (
            price.get("id") == self.gateway.price_id
            and price.get("currency") == "pen"
            and price.get("unit_amount") == 1990
            and item.get("quantity") == 1
            and recurring.get("interval") == "month"
            and recurring.get("interval_count") == 1
        )

    def _paid_period(self, remote: dict[str, Any]) -> datetime | None:
        invoice_id = self._id(remote.get("latest_invoice"))
        if not invoice_id:
            return None
        invoice = self.gateway.get_invoice(invoice_id)
        if (
            invoice.get("livemode") is not False
            or invoice.get("status") != "paid"
            or invoice.get("amount_paid") != 1990
            or invoice.get("currency") != "pen"
            or self._invoice_subscription(invoice) != remote["id"]
            or self._id(invoice.get("customer")) != self._id(remote.get("customer"))
        ):
            return None
        for line in (invoice.get("lines") or {}).get("data") or []:
            pricing = line.get("pricing") or {}
            price_id = self._id((pricing.get("price_details") or {}).get("price"))
            if price_id is None:
                price_id = self._id(line.get("price"))
            if price_id == self.gateway.price_id and line.get("amount") == 1990:
                end = (line.get("period") or {}).get("end")
                current_end = remote["items"]["data"][0].get("current_period_end")
                if isinstance(end, int) and isinstance(current_end, int) and end <= current_end:
                    return datetime.fromtimestamp(end, UTC)
        return None

    def process(self, payload: bytes, signature: str) -> WebhookResponse:
        event = self.gateway.verify_event(payload, signature)
        try:
            event_id = event["id"]
            event_type = event["type"]
            obj = event["data"]["object"]
            object_id = obj["id"]
            occurred_at = datetime.fromtimestamp(event["created"], UTC)
            if not all(isinstance(value, str) for value in (event_id, event_type, object_id)):
                raise self._invalid()
        except (KeyError, TypeError, ValueError, OverflowError, OSError):
            raise self._invalid() from None
        if event_type == "checkout.session.expired":
            self._expire_checkout(event_id, obj, occurred_at)
            return WebhookResponse()
        if event_type == "checkout.session.completed":
            subscription_id = self._id(obj.get("subscription"))
        elif event_type in {
            "invoice.paid",
            "invoice.payment_failed",
            "invoice.payment_action_required",
        }:
            subscription_id = self._invoice_subscription(obj)
        elif event_type in {
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
            "customer.subscription.paused",
            "customer.subscription.resumed",
        }:
            subscription_id = object_id
        else:
            return WebhookResponse()
        if not subscription_id:
            return WebhookResponse()
        owner = self._owner(self.gateway.get_subscription(subscription_id))
        if owner is None:
            return WebhookResponse()
        family_id, attempt_id = owner
        with self.session.begin():
            if self.repository.get_subscription(family_id) is None:
                return WebhookResponse()
            subscription = self.repository.lock_subscription(family_id)
            if self.repository.event_processed(event_id):
                return WebhookResponse()
            attempt = self.repository.get_checkout(attempt_id, family_id)
            if attempt is None:
                return WebhookResponse()
            if subscription.stripe_subscription_id != subscription_id:
                latest = self.repository.latest_checkout(family_id)
                if latest is None or latest.id != attempt_id:
                    return WebhookResponse()
            # Read current Stripe state under the family lock; old snapshots cannot regress it.
            remote = self.gateway.get_subscription(subscription_id)
            if (
                self._owner(remote) != owner
                or not self._matches_plan(remote)
                or self._id(remote.get("customer")) != subscription.stripe_customer_id
            ):
                return WebhookResponse()
            if remote.get("status") not in {
                "incomplete",
                "incomplete_expired",
                "trialing",
                "active",
                "past_due",
                "canceled",
                "unpaid",
                "paused",
            }:
                raise self._invalid()
            if subscription.stripe_subscription_id != subscription_id:
                subscription.paid_until = None
            subscription.stripe_subscription_id = subscription_id
            subscription.status = remote["status"]
            subscription.cancel_at_period_end = bool(remote.get("cancel_at_period_end"))
            paid_until = self._paid_period(remote)
            if paid_until is not None and (
                subscription.paid_until is None or paid_until > subscription.paid_until
            ):
                subscription.paid_until = paid_until
            if event_type == "checkout.session.completed" or paid_until is not None:
                attempt.status = "completed"
            self.repository.record_event(
                event_id=event_id,
                family_id=family_id,
                event_type=event_type,
                object_id=object_id,
                occurred_at=occurred_at,
            )
        return WebhookResponse()

    def _expire_checkout(self, event_id: str, obj: dict[str, Any], at: datetime) -> None:
        owner = self._owner(obj)
        if owner is None:
            return
        family_id, attempt_id = owner
        with self.session.begin():
            if self.repository.get_subscription(family_id) is None:
                return
            self.repository.lock_subscription(family_id)
            if self.repository.event_processed(event_id):
                return
            attempt = self.repository.get_checkout(attempt_id, family_id)
            if attempt is None or attempt.stripe_session_id != obj["id"]:
                return
            if attempt.status != "completed":
                attempt.status = "expired"
            self.repository.record_event(
                event_id=event_id,
                family_id=family_id,
                event_type="checkout.session.expired",
                object_id=obj["id"],
                occurred_at=at,
            )
