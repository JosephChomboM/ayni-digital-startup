import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BillingPanel } from "../components/BillingPanel";
import type { BillingStatus } from "./billing";

const fetchMock = vi.fn<typeof fetch>();
let status: BillingStatus;
let role: string;
let checkoutError: boolean;
function json(body: unknown, code = 200) { return new Response(JSON.stringify(body), { status: code }); }
beforeEach(() => {
  role = "cuidador_principal";
  checkoutError = false;
  status = { plan: "free", subscription_status: "none", amount_minor: 1990, currency: "PEN",
    interval: "month", paid_until: null, cancel_at_period_end: false, test_mode: true };
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  localStorage.setItem("ayni_token", "synthetic-test-token");
  vi.stubGlobal("fetch", fetchMock.mockReset().mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/users/me") return json({ user: { id: "synthetic-user", family_id: "synthetic-family", email: "persona@example.test", name: "Persona de prueba", role, created_at: "2026-11-04T00:00:00Z" }, consent: {} });
    if (path === "/billing/status") return json(status);
    if (path === "/billing/checkout") return checkoutError
      ? json({ detail: { code: "billing_not_configured", message: "Los pagos no están disponibles." } }, 503)
      : json({ checkout_url: "https://checkout.stripe.com/c/pay/synthetic", expires_at: "2030-01-01T00:00:00Z" });
    if (path === "/billing/cancel") return json({ ...status, cancel_at_period_end: true });
    throw new Error(`Unexpected test route: ${path}`);
  }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("opens test Checkout and keeps the plan free until confirmation", async () => {
  const redirect = vi.fn();
  render(<BillingPanel onCheckout={redirect} />);
  fireEvent.click(await screen.findByRole("button", { name: "Suscribirme" }));
  await vi.waitFor(() => expect(redirect).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/synthetic"));
  expect(await screen.findByText((_, element) => element?.tagName === "P" && element.textContent?.includes("Plan actual: Gratis") === true)).toBeInTheDocument();
  expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent?.includes("S/ 19.90 al mes") === true)).toBeInTheDocument();
});

it("shows the backend error without simulating a successful payment", async () => {
  checkoutError = true;
  const redirect = vi.fn();
  render(<BillingPanel onCheckout={redirect} />);
  fireEvent.click(await screen.findByRole("button", { name: "Suscribirme" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Los pagos no están disponibles.");
  expect(screen.getByRole("alert")).toHaveAttribute("data-error-code", "billing_not_configured");
  expect(redirect).not.toHaveBeenCalled();
});

it("shows a family member the plan without management actions", async () => {
  role = "familiar";
  render(<BillingPanel />);
  await screen.findByText((_, element) => element?.tagName === "P" && element.textContent?.includes("Plan actual: Gratis") === true);
  expect(screen.queryByRole("button", { name: "Suscribirme" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cancelar suscripción" })).not.toBeInTheDocument();
});

it("confirms cancellation and preserves the paid family plan", async () => {
  status = { ...status, plan: "family", subscription_status: "active", paid_until: "2030-01-01T00:00:00Z" };
  render(<BillingPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar suscripción" }));
  fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));
  expect(await screen.findByText((_, element) => element?.tagName === "P" && element.textContent?.includes("Plan actual: Familia") === true)).toBeInTheDocument();
  expect(screen.getByText("La renovación se canceló correctamente. Conservas el acceso hasta el final del periodo pagado.")).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/billing/cancel"))).toHaveLength(1);
});
