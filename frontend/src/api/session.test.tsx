import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../App";
import { apiFetch, SESSION_EXPIRED_EVENT } from "./client";

vi.mock("../pages/HomePage", () => ({ HomePage: () => null }));

const fetchMock = vi.fn<typeof fetch>();
const user = { id: crypto.randomUUID(), family_id: crypto.randomUUID(), role: "familiar" };

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("ayni_token", crypto.randomUUID());
});

afterEach(() => {
  cleanup();
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
  expect(screen.getByRole("heading", { name: "Bienvenido de nuevo" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  expect(localStorage.getItem("ayni_token")).toBeNull();
});

it("opens login when the initial stored session has expired", async () => {
  fetchMock.mockResolvedValue(unauthorized());
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Bienvenido de nuevo" })).toBeInTheDocument();
  expect(localStorage.getItem("ayni_token")).toBeNull();
});
