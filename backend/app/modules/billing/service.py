from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.billing.errors import BillingError, provider_unavailable
from app.modules.billing.gateway import BillingGateway, StripeGateway
from app.modules.billing.models import Subscription
from app.modules.billing.repository import BillingRepository
from app.modules.billing.schemas import BillingStatusResponse, CheckoutResponse, WebhookResponse
from app.modules.billing.webhooks import BillingWebhookProcessor
from app.modules.families.service import FamiliesService


class BillingService:
    def __init__(self, session: Session, gateway: BillingGateway | None = None) -> None:
        self.gateway = gateway or StripeGateway()
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

    @staticmethod
    def _existing_subscription() -> BillingError:
        return BillingError(
            code="subscription_already_exists",
            message="Tu familia ya tiene una suscripción. Revisa su estado antes de continuar.",
            status_code=409,
        )

    def create_checkout(self, actor_id: UUID) -> CheckoutResponse:
        family_id = self._context(actor_id, caregiver_only=True)
        with self.session.begin():
            subscription = self.repository.lock_subscription(family_id)
            if subscription.stripe_subscription_id and subscription.status not in {
                "canceled",
                "incomplete_expired",
                "none",
            }:
                raise self._existing_subscription()
            attempt = self.repository.pending_checkout(family_id)
            now = datetime.now(UTC)
            if attempt is not None:
                if attempt.expires_at and attempt.expires_at <= now:
                    if attempt.stripe_session_id:
                        remote = self.gateway.get_checkout(attempt.stripe_session_id)
                        if remote.get("status") == "complete":
                            raise self._existing_subscription()
                        if remote.get("status") != "expired":
                            raise provider_unavailable()
                        attempt.status = "expired"
                        attempt = None
                    else:
                        remote = self.gateway.find_checkout(
                            subscription.stripe_customer_id or "",
                            attempt.id,
                        )
                        if remote and remote.get("status") == "complete":
                            raise self._existing_subscription()
                        if remote and remote.get("status") == "open":
                            link = self._checkout_link(remote)
                            attempt.stripe_session_id = str(remote["id"])
                            attempt.checkout_url = link.checkout_url
                            attempt.expires_at = link.expires_at
                            attempt.status = "open"
                            return link
                        if remote and remote.get("status") != "expired":
                            raise provider_unavailable()
                        attempt.status = "expired"
                        attempt = None
                elif attempt.checkout_url and attempt.expires_at:
                    return CheckoutResponse(
                        checkout_url=attempt.checkout_url,
                        expires_at=attempt.expires_at,
                    )
            if not subscription.stripe_customer_id:
                subscription.stripe_customer_id = self.gateway.create_customer(family_id)
            if attempt is None:
                attempt = self.repository.create_checkout(family_id, now + timedelta(hours=23))
            attempt_id, customer_id = attempt.id, subscription.stripe_customer_id
        # Persist the retry key before contacting Stripe. Failed calls can safely be retried.
        remote = self.gateway.create_checkout(customer_id, family_id, attempt_id)
        link = self._checkout_link(remote)
        with self.session.begin():
            self.repository.lock_subscription(family_id)
            attempt = self.repository.get_checkout(attempt_id, family_id)
            if attempt is None:
                raise provider_unavailable()
            attempt.stripe_session_id = str(remote["id"])
            attempt.checkout_url = link.checkout_url
            attempt.expires_at = link.expires_at
            if attempt.status == "preparing":
                attempt.status = "open"
            return CheckoutResponse(
                checkout_url=attempt.checkout_url, expires_at=attempt.expires_at
            )

    def handle_webhook(self, payload: bytes, signature: str) -> WebhookResponse:
        return BillingWebhookProcessor(self.session, self.gateway).process(payload, signature)

    def cancel_subscription(self, actor_id: UUID) -> BillingStatusResponse:
        family_id = self._context(actor_id, caregiver_only=True)
        with self.session.begin():
            subscription = self.repository.get_subscription(family_id)
            if subscription is None or not subscription.stripe_subscription_id:
                raise BillingError(
                    code="subscription_not_found",
                    message="Tu familia todavía no tiene una suscripción.",
                    status_code=404,
                )
            subscription = self.repository.lock_subscription(family_id)
            if subscription.cancel_at_period_end or subscription.status == "canceled":
                return self._status(subscription)
            remote = self.gateway.cancel_subscription(subscription.stripe_subscription_id)
            if (
                remote.get("id") != subscription.stripe_subscription_id
                or remote.get("customer") != subscription.stripe_customer_id
                or not remote.get("cancel_at_period_end")
            ):
                raise provider_unavailable()
            subscription.cancel_at_period_end = True
            # The verified paid period remains available until its original end date.
            return self._status(subscription)

    @staticmethod
    def _checkout_link(remote: dict[str, object]) -> CheckoutResponse:
        try:
            url = urlsplit(str(remote.get("url", "")))
            expires_at = datetime.fromtimestamp(int(str(remote["expires_at"])), UTC)
            if (
                url.scheme != "https"
                or url.hostname != "checkout.stripe.com"
                or url.username
                or url.password
                or expires_at <= datetime.now(UTC)
            ):
                raise provider_unavailable()
        except (KeyError, ValueError, TypeError, OverflowError, OSError):
            raise provider_unavailable() from None
        return CheckoutResponse(checkout_url=str(remote["url"]), expires_at=expires_at)
