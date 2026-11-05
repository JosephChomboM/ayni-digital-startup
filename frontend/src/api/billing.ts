import { apiFetch } from "./client";

export interface BillingStatus {
  plan: "free" | "family";
  subscription_status: "none" | "incomplete" | "incomplete_expired" | "trialing" |
    "active" | "past_due" | "canceled" | "unpaid" | "paused";
  amount_minor: 1990;
  currency: "PEN";
  interval: "month";
  paid_until: string | null;
  cancel_at_period_end: boolean;
  test_mode: true;
}

export interface CheckoutLink {
  checkout_url: string;
  expires_at: string;
}

export function getBillingStatus(): Promise<BillingStatus> {
  return apiFetch<BillingStatus>("/billing/status");
}

export function createCheckout(): Promise<CheckoutLink> {
  return apiFetch<CheckoutLink>("/billing/checkout", { method: "POST", body: "{}" });
}

export function cancelSubscription(): Promise<BillingStatus> {
  return apiFetch<BillingStatus>("/billing/cancel", { method: "POST", body: "{}" });
}
