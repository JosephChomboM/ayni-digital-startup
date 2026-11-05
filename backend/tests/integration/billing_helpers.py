from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID


class FakeBillingGateway:
    """In-memory Stripe boundary: no credentials or external API calls in tests."""

    def __init__(self) -> None:
        self.checkout_calls: list[UUID] = []
        self.subscriptions: dict[str, dict[str, Any]] = {}
        self.invoices: dict[str, dict[str, Any]] = {}
        self.cancel_calls = 0

    def create_customer(self, family_id: UUID) -> str:
        return f"cus_{family_id.hex}"

    def create_checkout(
        self, customer_id: str, family_id: UUID, attempt_id: UUID
    ) -> dict[str, Any]:
        self.checkout_calls.append(attempt_id)
        return {
            "id": f"cs_test_{attempt_id.hex}",
            "livemode": False,
            "status": "open",
            "url": f"https://checkout.stripe.com/c/pay/{attempt_id.hex}",
            "expires_at": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
        }

    def get_checkout(self, session_id: str) -> dict[str, Any]:
        return {"id": session_id, "status": "expired", "livemode": False}

    def get_subscription(self, subscription_id: str) -> dict[str, Any]:
        return deepcopy(self.subscriptions[subscription_id])

    def get_invoice(self, invoice_id: str) -> dict[str, Any]:
        return deepcopy(self.invoices[invoice_id])

    def cancel_subscription(self, subscription_id: str) -> dict[str, Any]:
        self.cancel_calls += 1
        self.subscriptions[subscription_id]["cancel_at_period_end"] = True
        return self.get_subscription(subscription_id)

    def verify_event(self, payload: bytes, signature: str) -> dict[str, Any]:
        raise NotImplementedError
