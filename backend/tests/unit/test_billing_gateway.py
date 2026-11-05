import hashlib
import hmac
import secrets
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
import stripe
from pydantic import SecretStr

from app.modules.billing.errors import BillingError
from app.modules.billing.gateway import StripeGateway
from app.modules.billing.settings import BillingSettings


def settings() -> BillingSettings:
    return BillingSettings(
        _env_file=None,
        stripe_secret_key=SecretStr("sk_test_" + secrets.token_hex(16)),
        stripe_webhook_secret=SecretStr("whsec_" + secrets.token_hex(16)),
        stripe_price_id="price_synthetic",
        billing_success_url="https://ayni.example.com/?billing=success",
        billing_cancel_url="https://ayni.example.com/?billing=cancel",
    )


def test_checkout_uses_fixed_monthly_price_and_same_retry_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    gateway = StripeGateway(settings())
    create = Mock(
        return_value=stripe.StripeObject.construct_from(
            {
                "id": "cs_test_synthetic",
                "livemode": False,
            },
            None,
        )
    )
    price = {
        "livemode": False,
        "active": True,
        "currency": "pen",
        "unit_amount": 1990,
        "recurring": {"interval": "month", "interval_count": 1, "usage_type": "licensed"},
    }
    client = SimpleNamespace(
        v1=SimpleNamespace(
            prices=SimpleNamespace(
                retrieve=Mock(side_effect=lambda _: stripe.StripeObject.construct_from(price, None))
            ),
            checkout=SimpleNamespace(sessions=SimpleNamespace(create=create)),
        )
    )
    monkeypatch.setattr(gateway, "_client", lambda: client)
    family_id, attempt_id = uuid4(), uuid4()
    gateway.create_checkout("cus_synthetic", family_id, attempt_id)
    params = create.call_args.args[0]
    assert params["mode"] == "subscription"
    # Current Checkout API selects payment methods from Dashboard configuration.
    assert "payment_method_types" not in params
    assert params["line_items"] == [{"price": "price_synthetic", "quantity": 1}]
    assert params["metadata"] == {"family_id": str(family_id), "attempt_id": str(attempt_id)}
    assert create.call_args.kwargs["options"]["idempotency_key"] == f"ayni-checkout-{attempt_id}"
    price["recurring"]["interval"] = "year"
    with pytest.raises(BillingError) as error:
        gateway.create_checkout("cus_synthetic", family_id, attempt_id)
    assert error.value.code == "billing_not_configured"
    assert create.call_count == 1


def test_live_key_is_rejected_before_network_request() -> None:
    config = settings()
    config.stripe_secret_key = type(config.stripe_secret_key)("sk_live_synthetic")
    with pytest.raises(BillingError) as error:
        StripeGateway(config).create_customer(uuid4())
    assert error.value.code == "billing_not_configured"


def test_signed_malformed_payload_returns_uniform_error() -> None:
    config = settings()
    payload = b"[]"
    now = str(int(datetime.now(UTC).timestamp()))
    digest = hmac.new(
        config.stripe_webhook_secret.get_secret_value().encode(),
        now.encode() + b"." + payload,
        hashlib.sha256,
    ).hexdigest()
    with pytest.raises(BillingError) as error:
        StripeGateway(config).verify_event(payload, f"t={now},v1={digest}")
    assert error.value.code == "invalid_webhook_payload"
