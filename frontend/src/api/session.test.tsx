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

function completeLogin(): void {
  fireEvent.change(screen.getByLabelText("Correo Electrónico"), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "test-password-123" } });
  fireEvent.submit(screen.getByLabelText("Contraseña").closest("form")!);
}

function successfulLogin(): Response {
  return new Response(JSON.stringify({ access_token: "new-session-token", token_type: "bearer", user }));
}

it.each(["success", "cancel", "marker"])("recupera el plan tras una sesión vencida con retorno %s", async (source) => {
  if (source === "marker") sessionStorage.setItem("ayni_checkout_return", "settings:plan");
  else window.history.replaceState({}, "", `/?billing=${source}`);
  fetchMock.mockResolvedValueOnce(unauthorized());
  render(<App />);
  await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" });
  expect(localStorage.getItem("ayni_token")).toBeNull();

  fetchMock.mockResolvedValueOnce(successfulLogin());
  completeLogin();

  expect(await screen.findByRole("heading", { name: "Tu plan familiar" })).toBeInTheDocument();
  expect(localStorage.getItem("ayni_token")).toBe("new-session-token");
  expect(sessionStorage.getItem("ayni_checkout_return")).toBeNull();
  const [url, options] = fetchMock.mock.calls.at(-1)!;
  expect(url).toBe("https://api.example.test/auth/login");
  expect(options?.headers).not.toHaveProperty("Authorization");
  expect(JSON.parse(options?.body as string)).toEqual({ email: user.email, password: "test-password-123" });
});

it("conserva el retorno al plan si falla el acceso y permite reintentar", async () => {
  sessionStorage.setItem("ayni_checkout_return", "settings:plan");
  fetchMock.mockResolvedValueOnce(unauthorized());
  render(<App />);
  await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" });

  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  completeLogin();
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos conectar.");
  expect(sessionStorage.getItem("ayni_checkout_return")).toBe("settings:plan");
  expect(localStorage.getItem("ayni_token")).toBeNull();

  fetchMock.mockResolvedValueOnce(successfulLogin());
  completeLogin();
  expect(await screen.findByRole("heading", { name: "Tu plan familiar" })).toBeInTheDocument();
  expect(sessionStorage.getItem("ayni_checkout_return")).toBeNull();
});

it("rechaza una respuesta de acceso sin token y conserva el destino pendiente", async () => {
  sessionStorage.setItem("ayni_checkout_return", "settings:plan");
  fetchMock.mockResolvedValueOnce(unauthorized());
  render(<App />);
  await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" });
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ user, token_type: "bearer" })));
  completeLogin();
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar tu sesión.");
  expect(localStorage.getItem("ayni_token")).toBeNull();
  expect(sessionStorage.getItem("ayni_checkout_return")).toBe("settings:plan");
  expect(screen.queryByRole("heading", { name: "Tu plan familiar" })).toBeNull();
});

it("abre el inicio después de acceder si no hay un retorno de pago pendiente", async () => {
  fetchMock.mockResolvedValueOnce(unauthorized());
  render(<App />);
  await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" });
  fetchMock.mockResolvedValueOnce(successfulLogin());
  completeLogin();
  await screen.findByRole("button", { name: "Cerrar sesión" });
  expect(screen.queryByRole("heading", { name: "Tu plan familiar" })).toBeNull();
});

it("ignora una respuesta antigua de sesión recibida después de un 401", async () => {
  let resolveSession!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveSession = resolve; }));
  render(<App />);
  fetchMock.mockResolvedValueOnce(unauthorized());
  await act(async () => {
    await expect(apiFetch("/memories")).rejects.toMatchObject({ status: 401 });
  });
  await screen.findByRole("heading", { name: "Qué bueno verte de nuevo" });
  await act(async () => {
    resolveSession(new Response(JSON.stringify({ user, consent: {} })));
  });
  expect(screen.getByRole("heading", { name: "Qué bueno verte de nuevo" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  expect(localStorage.getItem("ayni_token")).toBeNull();
});
