from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.billing.models import Subscription
from app.modules.billing.repository import BillingRepository
from app.modules.billing.schemas import BillingStatusResponse
from app.modules.families.service import FamiliesService


class BillingError(ApplicationError):
    """A public error raised by billing."""


class BillingService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = BillingRepository(session)
        self.families = FamiliesService(session)

    def _context(self, actor_id: UUID, *, caregiver_only: bool = False) -> UUID:
        user = self.families.get_current_user(actor_id).user
        if caregiver_only and user.role != "cuidador_principal":
            raise BillingError(
                code="forbidden",
                message="Solo quien cuida principalmente puede gestionar el plan.",
                status_code=403,
            )
        return user.family_id

    @staticmethod
    def _status(subscription: Subscription | None) -> BillingStatusResponse:
        if subscription is None:
            return BillingStatusResponse(plan="free", subscription_status="none")
        paid = (
            subscription.status in {"active", "past_due"}
            and subscription.paid_until is not None
            and subscription.paid_until > datetime.now(UTC)
        )
        return BillingStatusResponse(
            plan="family" if paid else "free",
            subscription_status=subscription.status,
            paid_until=subscription.paid_until,
            cancel_at_period_end=subscription.cancel_at_period_end,
        )

    def get_status(self, actor_id: UUID) -> BillingStatusResponse:
        family_id = self._context(actor_id)
        with self.session.begin():
            return self._status(self.repository.get_subscription(family_id))
