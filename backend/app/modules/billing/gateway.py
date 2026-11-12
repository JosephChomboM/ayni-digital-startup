from typing import Any, Protocol
from uuid import UUID

import stripe

from app.modules.billing.errors import BillingError, provider_unavailable
from app.modules.billing.settings import BillingSettings, get_billing_settings


class BillingGateway(Protocol):
    @property
    def price_id(self) -> str: ...

    def create_customer(self, family_id: UUID) -> str: ...
    def create_checkout(
        self, customer_id: str, family_id: UUID, attempt_id: UUID
    ) -> dict[str, Any]: ...
    def get_checkout(self, session_id: str) -> dict[str, Any]: ...
    def find_checkout(self, customer_id: str, attempt_id: UUID) -> dict[str, Any] | None: ...
    def get_subscription(self, subscription_id: str) -> dict[str, Any]: ...
    def get_invoice(self, invoice_id: str) -> dict[str, Any]: ...
    def cancel_subscription(self, subscription_id: str) -> dict[str, Any]: ...
    def expire_checkout(self, session_id: str) -> dict[str, Any]: ...
    def delete_customer(self, customer_id: str) -> dict[str, Any]: ...
    def verify_event(self, payload: bytes, signature: str) -> dict[str, Any]: ...


class StripeGateway:
    def __init__(self, settings: BillingSettings | None = None) -> None:
        self.settings = settings or get_billing_settings()

    @property
    def price_id(self) -> str:
        return self.settings.stripe_price_id

    def _client(self) -> stripe.StripeClient:
        self.settings.require()
        return stripe.StripeClient(
            self.settings.stripe_secret_key.get_secret_value(),
            max_network_retries=1,
            http_client=stripe.HTTPXClient(allow_sync_methods=True, timeout=10),
        )

    def create_customer(self, family_id: UUID) -> str:
        try:
            result = self._client().v1.customers.create(
                {"metadata": {"family_id": str(family_id)}},
                options={"idempotency_key": f"ayni-family-{family_id}"},
            )
            if result.to_dict().get("livemode") is not False:
                raise provider_unavailable()
            return result.id
        except stripe.StripeError:
            raise provider_unavailable() from None

    def create_checkout(
        self,
        customer_id: str,
        family_id: UUID,
        attempt_id: UUID,
    ) -> dict[str, Any]:
        self.settings.require(checkout=True)
        try:
            client = self._client()
            price = client.v1.prices.retrieve(self.settings.stripe_price_id).to_dict()
            recurring = price.get("recurring") or {}
            if (
                price.get("livemode") is not False
                or not price.get("active")
                or price.get("currency") != "pen"
                or price.get("unit_amount") != 1990
                or recurring.get("interval") != "month"
                or recurring.get("interval_count") != 1
                or recurring.get("usage_type") != "licensed"
            ):
                raise BillingError(
                    code="billing_not_configured",
                    message="Los pagos de prueba todavía no están disponibles.",
                    status_code=503,
                )
            metadata = {"family_id": str(family_id), "attempt_id": str(attempt_id)}
            result = client.v1.checkout.sessions.create(
                {
                    "mode": "subscription",
                    "customer": customer_id,
                    "line_items": [{"price": self.settings.stripe_price_id, "quantity": 1}],
                    "metadata": metadata,
                    "subscription_data": {"metadata": metadata},
                    "success_url": self.settings.billing_success_url,
                    "cancel_url": self.settings.billing_cancel_url,
                },
                options={"idempotency_key": f"ayni-checkout-{attempt_id}"},
            )
            return self._test_object(result)
        except stripe.StripeError:
            raise provider_unavailable() from None

    @staticmethod
    def _test_object(result: Any) -> dict[str, Any]:
        if result.to_dict().get("livemode") is not False:
            raise provider_unavailable()
        return result.to_dict()

    def get_checkout(self, session_id: str) -> dict[str, Any]:
        try:
            return self._test_object(self._client().v1.checkout.sessions.retrieve(session_id))
        except stripe.StripeError:
            raise provider_unavailable() from None

    def find_checkout(self, customer_id: str, attempt_id: UUID) -> dict[str, Any] | None:
        try:
            sessions = self._client().v1.checkout.sessions.list(
                {
                    "customer": customer_id,
                    "limit": 100,
                }
            )
            for checkout in sessions.auto_paging_iter():
                data = self._test_object(checkout)
                if (data.get("metadata") or {}).get("attempt_id") == str(attempt_id):
                    return data
            return None
        except stripe.StripeError:
            raise provider_unavailable() from None

    def get_subscription(self, subscription_id: str) -> dict[str, Any]:
        try:
            return self._test_object(self._client().v1.subscriptions.retrieve(subscription_id))
        except stripe.StripeError:
            raise provider_unavailable() from None

    def get_invoice(self, invoice_id: str) -> dict[str, Any]:
        try:
            return self._test_object(self._client().v1.invoices.retrieve(invoice_id))
        except stripe.StripeError:
            raise provider_unavailable() from None

    def cancel_subscription(self, subscription_id: str) -> dict[str, Any]:
        try:
            return self._test_object(
                self._client().v1.subscriptions.update(
                    subscription_id,
                    {"cancel_at_period_end": True},
                )
            )
        except stripe.StripeError:
            raise provider_unavailable() from None

    def expire_checkout(self, session_id: str) -> dict[str, Any]:
        try:
            client = self._client()
            current = self._test_object(client.v1.checkout.sessions.retrieve(session_id))
            if current.get("status") != "open":
                return current
            return self._test_object(client.v1.checkout.sessions.expire(session_id))
        except stripe.StripeError:
            raise provider_unavailable() from None

    def delete_customer(self, customer_id: str) -> dict[str, Any]:
        try:
            client = self._client()
            current = client.v1.customers.retrieve(customer_id).to_dict()
            if current.get("deleted") is True:
                return current
            if current.get("livemode") is not False:
                raise provider_unavailable()
            return client.v1.customers.delete(customer_id).to_dict()
        except stripe.StripeError:
            raise provider_unavailable() from None

    def verify_event(self, payload: bytes, signature: str) -> dict[str, Any]:
        self.settings.require(webhook=True)
        try:
            event = stripe.Webhook.construct_event(
                payload,
                signature,
                self.settings.stripe_webhook_secret.get_secret_value(),
            )
        except stripe.SignatureVerificationError:
            raise BillingError(
                code="invalid_webhook_signature",
                message="Firma de pago no válida.",
                status_code=400,
            ) from None
        except (ValueError, UnicodeDecodeError, TypeError, KeyError, AttributeError):
            raise BillingError(
                code="invalid_webhook_payload",
                message="El aviso de pago no es válido.",
                status_code=400,
            ) from None
        if event.to_dict().get("livemode") is not False:
            raise BillingError(
                code="invalid_webhook_payload",
                message="Solo se aceptan pagos de prueba.",
                status_code=400,
            )
        return event.to_dict()
