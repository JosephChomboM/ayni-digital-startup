from types import SimpleNamespace

from app.modules.billing.gateway import StripeGateway


class Remote:
    def __init__(self, **data: object) -> None:
        self.data = data

    def to_dict(self) -> dict[str, object]:
        return self.data


def test_delete_customer_is_retryable_and_checks_test_mode(monkeypatch) -> None:
    calls = []
    customers = SimpleNamespace(
        retrieve=lambda value: Remote(id=value, livemode=False),
        delete=lambda value: calls.append(value) or Remote(id=value, deleted=True),
    )
    gateway = StripeGateway()
    monkeypatch.setattr(
        gateway, "_client", lambda: SimpleNamespace(v1=SimpleNamespace(customers=customers))
    )
    assert gateway.delete_customer("cus_synthetic") == {"id": "cus_synthetic", "deleted": True}
    customers.retrieve = lambda value: Remote(id=value, deleted=True)
    assert gateway.delete_customer("cus_synthetic")["deleted"] is True
    assert calls == ["cus_synthetic"]


def test_expire_checkout_preserves_completed_or_expired_sessions(monkeypatch) -> None:
    calls = []
    sessions = SimpleNamespace(
        retrieve=lambda value: Remote(id=value, livemode=False, status="open"),
        expire=lambda value: (
            calls.append(value) or Remote(id=value, livemode=False, status="expired")
        ),
    )
    gateway = StripeGateway()
    monkeypatch.setattr(
        gateway,
        "_client",
        lambda: SimpleNamespace(v1=SimpleNamespace(checkout=SimpleNamespace(sessions=sessions))),
    )
    assert gateway.expire_checkout("cs_synthetic")["status"] == "expired"
    sessions.retrieve = lambda value: Remote(id=value, livemode=False, status="complete")
    assert gateway.expire_checkout("cs_synthetic")["status"] == "complete"
    assert calls == ["cs_synthetic"]
