from types import SimpleNamespace

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.billing.errors import BillingError
from app.modules.billing.gateway import StripeGateway
from app.modules.billing.service import BillingService
from app.modules.billing.settings import BillingSettings
from tests.integration.billing_helpers import FakeBillingGateway

pytestmark = pytest.mark.integration


def test_checkout_reuses_pending_url_and_does_not_activate_plan(
    caregiver_account: SimpleNamespace,
) -> None:
    gateway = FakeBillingGateway()
    with Session(engine) as session:
        service = BillingService(session, gateway)
        first = service.create_checkout(caregiver_account.user_id)
        second = service.create_checkout(caregiver_account.user_id)
        assert first == second
        assert service.get_status(caregiver_account.user_id).plan == "free"
    assert len(gateway.checkout_calls) == 1


def test_member_cannot_start_checkout(family_member: SimpleNamespace) -> None:
    with Session(engine) as session, pytest.raises(BillingError) as error:
        BillingService(session, FakeBillingGateway()).create_checkout(family_member.user_id)
    assert error.value.code == "forbidden"


def test_checkout_without_stripe_configuration_returns_unavailable(
    caregiver_account: SimpleNamespace,
) -> None:
    gateway = StripeGateway(BillingSettings(_env_file=None))
    with Session(engine) as session, pytest.raises(BillingError) as error:
        BillingService(session, gateway).create_checkout(caregiver_account.user_id)
    assert error.value.code == "billing_not_configured"
