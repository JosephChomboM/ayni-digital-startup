import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cancelSubscription, createCheckout, getBillingStatus } from "./billing";
import { ApiError, SESSION_EXPIRED_EVENT } from "./client";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  localStorage.setItem("ayni_token", "synthetic-test-token");
  vi.stubGlobal("fetch", fetchMock.mockReset());
});
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("uses billing routes, Bearer auth and empty mutation bodies", async () => {
  fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
  await getBillingStatus();
  await createCheckout();
  await cancelSubscription();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "https://api.example.test/billing/status", "https://api.example.test/billing/checkout",
    "https://api.example.test/billing/cancel",
  ]);
  expect(fetchMock.mock.calls[1][1]).toMatchObject({
    method: "POST", body: "{}", headers: { Authorization: "Bearer synthetic-test-token" },
  });
});

it("preserves detail code and message", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({
    detail: { code: "billing_not_configured", message: "Los pagos de prueba no están disponibles." },
  }), { status: 503 }));
  await expect(createCheckout()).rejects.toMatchObject({
    code: "billing_not_configured", message: "Los pagos de prueba no están disponibles.",
  });
});

it("clears the token and requests login on a 401", async () => {
  const expired = vi.fn();
  window.addEventListener(SESSION_EXPIRED_EVENT, expired);
  try {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      detail: { code: "unauthorized", message: "Vuelve a iniciar sesión." },
    }), { status: 401 }));
    await expect(getBillingStatus()).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem("ayni_token")).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
  } finally { window.removeEventListener(SESSION_EXPIRED_EVENT, expired); }
});
