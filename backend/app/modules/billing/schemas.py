from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class EmptyBillingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BillingStatusResponse(BaseModel):
    plan: Literal["free", "family"]
    subscription_status: Literal[
        "none",
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
    ]
    amount_minor: Literal[1990] = 1990
    currency: Literal["PEN"] = "PEN"
    interval: Literal["month"] = "month"
    paid_until: datetime | None = None
    cancel_at_period_end: bool = False
    test_mode: Literal[True] = True


class CheckoutResponse(BaseModel):
    checkout_url: str
    expires_at: datetime


class WebhookResponse(BaseModel):
    received: Literal[True] = True
