import hashlib
import hmac
import json
import secrets
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from app.modules.billing.gateway import StripeGateway
from app.modules.billing.settings import BillingSettings


class FakeBillingGateway:
    """In-memory Stripe boundary: no credentials or external API calls in tests."""

    def __init__(self) -> None:
        self.price_id = "price_synthetic"
        self.signing_secret = "whsec_" + secrets.token_hex(16)
        self.verifier = StripeGateway(
            BillingSettings(
                _env_file=None,
                stripe_secret_key="sk_test_" + secrets.token_hex(16),
                stripe_webhook_secret=self.signing_secret,
                stripe_price_id=self.price_id,
            )
        )
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
        return self.verifier.verify_event(payload, signature)

    def activate(self, family_id: UUID) -> str:
        attempt_id = self.checkout_calls[-1]
        subscription_id = f"sub_{attempt_id.hex}"
        invoice_id = f"in_{attempt_id.hex}"
        end = int((datetime.now(UTC) + timedelta(days=30)).timestamp())
        self.subscriptions[subscription_id] = {
            "id": subscription_id,
            "livemode": False,
            "status": "active",
            "customer": f"cus_{family_id.hex}",
            "cancel_at_period_end": False,
            "metadata": {"family_id": str(family_id), "attempt_id": str(attempt_id)},
            "latest_invoice": invoice_id,
            "items": {
                "data": [
                    {
                        "quantity": 1,
                        "current_period_end": end,
                        "price": {
                            "id": self.price_id,
                            "currency": "pen",
                            "unit_amount": 1990,
                            "recurring": {"interval": "month", "interval_count": 1},
                        },
                    }
                ]
            },
        }
        self.invoices[invoice_id] = {
            "id": invoice_id,
            "livemode": False,
            "status": "paid",
            "amount_paid": 1990,
            "customer": f"cus_{family_id.hex}",
            "currency": "pen",
            "parent": {"subscription_details": {"subscription": subscription_id}},
            "lines": {
                "data": [
                    {
                        "amount": 1990,
                        "period": {"end": end},
                        "pricing": {"price_details": {"price": self.price_id}},
                    }
                ]
            },
        }
        return subscription_id

    def signed_event(
        self,
        event_type: str,
        obj: dict[str, Any],
        *,
        event_id: str | None = None,
    ) -> tuple[bytes, str]:
        now = int(datetime.now(UTC).timestamp())
        payload = json.dumps(
            {
                "id": event_id or f"evt_{uuid4().hex}",
                "object": "event",
                "livemode": False,
                "created": now,
                "type": event_type,
                "data": {"object": obj},
            }
        ).encode()
        digest = hmac.new(
            self.signing_secret.encode(), str(now).encode() + b"." + payload, hashlib.sha256
        ).hexdigest()
        return payload, f"t={now},v1={digest}"
