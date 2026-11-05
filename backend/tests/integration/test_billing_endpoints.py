from collections.abc import Iterator
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.billing.router import get_billing_gateway
from app.modules.billing.service import BillingService
from tests.integration.billing_helpers import FakeBillingGateway

pytestmark = pytest.mark.integration


@pytest.fixture
def gateway() -> FakeBillingGateway:
    return FakeBillingGateway()


@pytest.fixture
def client(gateway: FakeBillingGateway) -> Iterator[TestClient]:
    previous = app.dependency_overrides.get(get_billing_gateway)
    app.dependency_overrides[get_billing_gateway] = lambda: gateway
    try:
        with TestClient(app) as instance:
            yield instance
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_billing_gateway, None)
        else:
            app.dependency_overrides[get_billing_gateway] = previous


def headers(account: SimpleNamespace) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(account.user_id)}"}


def activate(gateway: FakeBillingGateway, account: SimpleNamespace) -> None:
    with Session(engine) as session:
        service = BillingService(session, gateway)
        service.create_checkout(account.user_id)
        subscription_id = gateway.activate(account.family_id)
        invoice_id = gateway.subscriptions[subscription_id]["latest_invoice"]
        service.handle_webhook(*gateway.signed_event("invoice.paid", gateway.invoices[invoice_id]))


def test_status_returns_free_plan(client: TestClient, caregiver_account: SimpleNamespace) -> None:
    response = client.get("/billing/status", headers=headers(caregiver_account))
    assert response.status_code == 200
    assert response.json()["plan"] == "free" and response.json()["test_mode"] is True


def test_status_requires_bearer_token(client: TestClient) -> None:
    response = client.get("/billing/status")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthorized"


def test_status_is_scoped_to_authenticated_family(
    client: TestClient,
    gateway: FakeBillingGateway,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    activate(gateway, caregiver_account)
    assert client.get("/billing/status", headers=headers(family_member)).json()["plan"] == "family"
    assert (
        client.get("/billing/status", headers=headers(other_caregiver_account)).json()["plan"]
        == "free"
    )


def test_checkout_returns_provider_url(
    client: TestClient,
    caregiver_account: SimpleNamespace,
) -> None:
    response = client.post("/billing/checkout", json={}, headers=headers(caregiver_account))
    assert response.status_code == 200
    assert response.json()["checkout_url"].startswith("https://checkout.stripe.com/")
    assert "expires_at" in response.json()


def test_checkout_rejects_client_supplied_price(
    client: TestClient,
    caregiver_account: SimpleNamespace,
) -> None:
    response = client.post(
        "/billing/checkout", json={"amount_minor": 1}, headers=headers(caregiver_account)
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"
    assert isinstance(response.json()["detail"]["message"], str)


def test_checkout_rejects_family_member(client: TestClient, family_member: SimpleNamespace) -> None:
    response = client.post("/billing/checkout", json={}, headers=headers(family_member))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"


def test_cancel_returns_scheduled_end(
    client: TestClient,
    gateway: FakeBillingGateway,
    caregiver_account: SimpleNamespace,
) -> None:
    activate(gateway, caregiver_account)
    response = client.post("/billing/cancel", json={}, headers=headers(caregiver_account))
    assert response.status_code == 200
    assert response.json()["cancel_at_period_end"] is True
    assert response.json()["plan"] == "family"


def test_cancel_without_subscription_returns_not_found(
    client: TestClient,
    caregiver_account: SimpleNamespace,
) -> None:
    response = client.post("/billing/cancel", json={}, headers=headers(caregiver_account))
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "subscription_not_found"


def test_cancel_rejects_family_member(client: TestClient, family_member: SimpleNamespace) -> None:
    response = client.post("/billing/cancel", json={}, headers=headers(family_member))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"


def test_signed_webhook_accepts_payment_without_user_token(
    client: TestClient,
    gateway: FakeBillingGateway,
    caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session:
        BillingService(session, gateway).create_checkout(caregiver_account.user_id)
    subscription_id = gateway.activate(caregiver_account.family_id)
    invoice_id = gateway.subscriptions[subscription_id]["latest_invoice"]
    payload, signature = gateway.signed_event("invoice.paid", gateway.invoices[invoice_id])
    response = client.post(
        "/billing/webhook", content=payload, headers={"Stripe-Signature": signature}
    )
    assert response.status_code == 200 and response.json() == {"received": True}
    assert (
        client.get("/billing/status", headers=headers(caregiver_account)).json()["plan"] == "family"
    )


def test_webhook_rejects_invalid_signature(client: TestClient) -> None:
    response = client.post(
        "/billing/webhook", content=b"{}", headers={"Stripe-Signature": "invalid"}
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_webhook_signature"
