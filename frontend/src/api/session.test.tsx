import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../App";
import { apiFetch, SESSION_EXPIRED_EVENT } from "./client";

vi.mock("../pages/HomePage", () => ({ HomePage: () => null }));
vi.mock("../components/BillingPanel", () => ({ BillingPanel: () => <p>Estado del plan de prueba</p> }));

const fetchMock = vi.fn<typeof fetch>();
const user = { id: crypto.randomUUID(), family_id: crypto.randomUUID(), role: "familiar", name: "Ana Prueba", email: "ana@example.test" };

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("ayni_token", crypto.randomUUID());
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function unauthorized(): Response {
  return new Response(JSON.stringify({ detail: { code: "unauthorized", message: "Vuelve a iniciar sesión." } }), { status: 401 });
}

it("clears the token and announces any HTTP 401, even with an invalid error body", async () => {
  const expired = vi.fn();
  window.addEventListener(SESSION_EXPIRED_EVENT, expired);
  try {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));
    await expect(apiFetch("/memories")).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem("ayni_token")).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
  } finally {
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }
});

it("returns an authenticated app directly to login after an API 401", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ user, consent: {} })));
  render(<App />);
  await screen.findByRole("button", { name: "Cerrar sesión" });
  fetchMock.mockResolvedValue(unauthorized());
  await act(async () => {
    await expect(apiFetch("/memories")).rejects.toMatchObject({ code: "unauthorized" });
  });
  expect(screen.getByRole("heading", { name: "Qué bueno verte de nuevo" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  expect(localStorage.getItem("ayni_token")).toBeNull();
});

it("opens login when the initial stored session has expired", async () => {
  fetchMock.mockResolvedValue(unauthorized());
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" })).toBeInTheDocument();
  expect(localStorage.getItem("ayni_token")).toBeNull();
});

it.each(["success", "cancel"])("returns Stripe %s redirects to the plan screen", async (result) => {
  window.history.replaceState({}, "", `/?billing=${result}`);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ user, consent: {} })));
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Tu plan familiar" })).toBeInTheDocument();
  expect(screen.getByText("Estado del plan de prueba")).toBeInTheDocument();
});

it("shows the signed-in identity and distinguishes the account from the accompanied person's profile", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ user, consent: {} })));
  render(<App />);
  const accountButton = await screen.findByRole("button", { name: "Abrir mi cuenta" });
  expect(accountButton).toHaveTextContent("Ana Prueba");
  expect(accountButton).toHaveTextContent("Familiar invitado");
  fireEvent.click(accountButton);
  expect(screen.getByRole("heading", { name: "Mi cuenta" })).toBeInTheDocument();
  expect(screen.getByText("ana@example.test")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ver persona y familia" })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Cerrar sesión" }).at(-1)!);
  expect(localStorage.getItem("ayni_token")).toBeNull();
  expect(screen.queryByRole("button", { name: "Abrir mi cuenta" })).not.toBeInTheDocument();
});

it("restores the plan after checkout using the session return marker", async () => {
  sessionStorage.setItem("ayni_checkout_return", "settings:plan");
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ user, consent: {} })));
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Tu plan familiar" })).toBeInTheDocument();
  expect(sessionStorage.getItem("ayni_checkout_return")).toBeNull();
});

it("returns to login with a truthful confirmation after successful account deletion", async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ user, consent: {}, enabled: false, client_id: null })));
  render(<App />);
  await screen.findByRole("button", { name: "Cerrar sesión" });
  sessionStorage.setItem("ayni_account_deleted", "1");
  localStorage.removeItem("ayni_token");
  act(() => { window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)); });
  expect(await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" })).toBeInTheDocument();
  expect(screen.getByText("Tu cuenta y los datos correspondientes se eliminaron correctamente.")).toBeInTheDocument();
  expect(sessionStorage.getItem("ayni_account_deleted")).toBeNull();
});
