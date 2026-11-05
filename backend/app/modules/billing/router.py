from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.db import get_db
from app.modules.billing.gateway import BillingGateway, StripeGateway
from app.modules.billing.schemas import (
    BillingStatusResponse,
    CheckoutResponse,
    EmptyBillingRequest,
    WebhookResponse,
)
from app.modules.billing.service import BillingService
from app.modules.families.service import get_authenticated_user_id

router = APIRouter(prefix="/billing", tags=["billing"])


def get_billing_gateway() -> BillingGateway:
    return StripeGateway()


def get_billing_service(
    db: Annotated[Session, Depends(get_db)],
    gateway: Annotated[BillingGateway, Depends(get_billing_gateway)],
) -> BillingService:
    return BillingService(db, gateway)


ServiceDep = Annotated[BillingService, Depends(get_billing_service)]
ActorDep = Annotated[UUID, Depends(get_authenticated_user_id)]


@router.get("/status", response_model=BillingStatusResponse)
def get_status(service: ServiceDep, actor_id: ActorDep) -> BillingStatusResponse:
    return service.get_status(actor_id)


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    data: EmptyBillingRequest,
    service: ServiceDep,
    actor_id: ActorDep,
) -> CheckoutResponse:
    return service.create_checkout(actor_id)


@router.post("/cancel", response_model=BillingStatusResponse)
def cancel_subscription(
    data: EmptyBillingRequest,
    service: ServiceDep,
    actor_id: ActorDep,
) -> BillingStatusResponse:
    return service.cancel_subscription(actor_id)


@router.post("/webhook", response_model=WebhookResponse)
async def webhook(
    request: Request,
    service: ServiceDep,
    stripe_signature: Annotated[str, Header(alias="Stripe-Signature")] = "",
) -> WebhookResponse:
    payload = await request.body()
    return await run_in_threadpool(service.handle_webhook, payload, stripe_signature)
