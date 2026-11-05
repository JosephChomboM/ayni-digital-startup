from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.billing.models import CheckoutAttempt, Subscription, WebhookEvent


class BillingRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_subscription(self, family_id: UUID) -> Subscription | None:
        return self.session.get(Subscription, family_id)

    def lock_subscription(self, family_id: UUID) -> Subscription:
        self.session.execute(
            insert(Subscription).values(family_id=family_id).on_conflict_do_nothing()
        )
        return self.session.scalars(
            select(Subscription).where(Subscription.family_id == family_id).with_for_update()
        ).one()

    def pending_checkout(self, family_id: UUID) -> CheckoutAttempt | None:
        return self.session.scalar(
            select(CheckoutAttempt)
            .where(
                CheckoutAttempt.family_id == family_id,
                CheckoutAttempt.status.in_(["preparing", "open"]),
            )
            .order_by(CheckoutAttempt.created_at.desc(), CheckoutAttempt.id.desc())
            .limit(1)
        )

    def create_checkout(self, family_id: UUID, expires_at: datetime) -> CheckoutAttempt:
        attempt = CheckoutAttempt(family_id=family_id, expires_at=expires_at)
        self.session.add(attempt)
        self.session.flush()
        return attempt

    def get_checkout(self, attempt_id: UUID, family_id: UUID) -> CheckoutAttempt | None:
        return self.session.scalar(
            select(CheckoutAttempt).where(
                CheckoutAttempt.id == attempt_id, CheckoutAttempt.family_id == family_id
            )
        )

    def find_subscription(self, stripe_subscription_id: str) -> Subscription | None:
        return self.session.scalar(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_subscription_id
            )
        )

    def event_processed(self, event_id: str) -> bool:
        return self.session.get(WebhookEvent, event_id) is not None

    def record_event(
        self,
        *,
        event_id: str,
        family_id: UUID,
        event_type: str,
        object_id: str,
        occurred_at: datetime,
    ) -> None:
        self.session.add(
            WebhookEvent(
                stripe_event_id=event_id,
                family_id=family_id,
                event_type=event_type,
                stripe_object_id=object_id,
                occurred_at=occurred_at,
            )
        )
        self.session.flush()
