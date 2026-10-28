import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "./AuthPage";

const texts = {
  text_version: "1.0", text: "Texto exacto recibido del servidor.",
  onboarding_notice: "Aviso exacto recibido del servidor.",
};
const user = {
  id: "8be88d30-4e52-47a6-9db6-5d0ed982acc9", family_id: "47a34d55-28da-47dc-afc6-53d0307adc85",
  email: "persona@example.com", name: "Persona de prueba", role: "cuidador_principal",
  created_at: "2026-10-27T00:00:00Z",
};
const fetchMock = vi.fn<typeof fetch>();
let token: string;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function successfulResponse(url: string): Response {
  if (url.endsWith("/auth/consent")) return json(texts);
  if (url.endsWith("/auth/register")) return json({
    user, family: { id: user.family_id }, consent: { text_version: "1.0", accepted_at: user.created_at },
  }, 201);
  if (url.endsWith("/auth/login")) return json({ user, access_token: token, token_type: "bearer", expires_in: 1800 });
  throw new Error("Ruta de prueba inesperada.");
}

beforeEach(() => {
  token = crypto.randomUUID();
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  fetchMock.mockReset().mockImplementation(async (input) => successfulResponse(String(input)));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function fillCredentials(password: string = crypto.randomUUID()): void {
  fireEvent.change(screen.getByLabelText("Correo Electrónico"), { target: { value: "persona@example.com" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: password } });
}

async function fillRegistration(): Promise<void> {
  await screen.findByRole("checkbox");
  fireEvent.change(screen.getByLabelText("Tu Nombre Completo"), { target: { value: user.name } });
  fireEvent.change(screen.getByLabelText("Nombre del Grupo Familiar"), { target: { value: "Familia de prueba" } });
  fillCredentials();
  fireEvent.click(screen.getByRole("checkbox"));
}

function submit(): void {
  fireEvent.submit(screen.getByLabelText("Contraseña").closest("form")!);
}

function posts(): Array<[string, Record<string, unknown>]> {
  return fetchMock.mock.calls.filter(([, options]) => options?.method === "POST").map(([url, options]) => [
    String(url), JSON.parse(options?.body as string) as Record<string, unknown>,
  ]);
}

describe("AuthPage families contract", () => {
  it("shows server consent verbatim and registers before logging in", async () => {
    const onSuccess = vi.fn();
    render(<AuthPage onBack={vi.fn()} onSuccess={onSuccess} />);
    await fillRegistration();
    expect(screen.getByText(texts.text).textContent).toBe(texts.text);
    expect(screen.getByText(texts.onboarding_notice).textContent).toBe(texts.onboarding_notice);
    submit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(user));
    expect(posts().map(([url]) => url)).toEqual([
      "https://api.example.test/auth/register", "https://api.example.test/auth/login",
    ]);
    expect(posts()[0][1]).toMatchObject({
      name: user.name, family_name: "Familia de prueba", email: user.email,
      consent: { accepted: true, text_version: "1.0" },
    });
    expect(posts()[0][1]).not.toHaveProperty("invitation_token");
    expect(localStorage.getItem("ayni_token")).toBe(token);
  });

  it("registers with an invitation instead of family_name", async () => {
    const onSuccess = vi.fn();
    render(<AuthPage onBack={vi.fn()} onSuccess={onSuccess} />);
    await fillRegistration();
    const invitation = crypto.randomUUID();
    fireEvent.change(screen.getByLabelText("Forma de registro"), { target: { value: "invitation" } });
    fireEvent.change(screen.getByLabelText("Código de invitación"), { target: { value: invitation } });
    submit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(posts()[0][1]).toMatchObject({ invitation_token: invitation, consent: { accepted: true, text_version: "1.0" } });
    expect(posts()[0][1]).not.toHaveProperty("family_name");
  });

  it.each(["register", "login"] as const)("rejects short passwords before submitting %s", async (mode) => {
    const onSuccess = vi.fn();
    render(<AuthPage initialMode={mode} onBack={vi.fn()} onSuccess={onSuccess} />);
    if (mode === "register") await fillRegistration();
    fillCredentials("corta");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("minlength", "10");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("al menos 10 caracteres");
    expect(posts()).toHaveLength(0);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("does not submit registration without explicit acceptance", async () => {
    render(<AuthPage onBack={vi.fn()} onSuccess={vi.fn()} />);
    await fillRegistration();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Crear Cuenta de Cuidador" })).toBeDisabled();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("acepta el consentimiento");
    expect(posts()).toHaveLength(0);
  });

  it("shows login errors without offering preview access", async () => {
    fetchMock.mockResolvedValue(json({ detail: { code: "invalid_credentials", message: "El correo o la contraseña no son correctos." } }, 401));
    const onSuccess = vi.fn();
    render(<AuthPage initialMode="login" onBack={vi.fn()} onSuccess={onSuccess} />);
    fillCredentials();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("El correo o la contraseña no son correctos.");
    expect(screen.queryByRole("button", { name: /vista previa|ingresar directo|demostración/i })).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem("ayni_token")).toBeNull();
  });

  it("retries login without registering again after the account was created", async () => {
    let loginAttempts = 0;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/login") && ++loginAttempts === 1) {
        return json({ detail: { code: "invalid_credentials", message: "Vuelve a iniciar sesión." } }, 401);
      }
      return successfulResponse(url);
    });
    const onSuccess = vi.fn();
    render(<AuthPage onBack={vi.fn()} onSuccess={onSuccess} />);
    await fillRegistration();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Vuelve a iniciar sesión.");
    expect(screen.getByRole("status")).toHaveTextContent("Tu cuenta ya está creada");
    expect(onSuccess).not.toHaveBeenCalled();
    submit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(user));
    expect(posts().filter(([url]) => url.endsWith("/auth/register"))).toHaveLength(1);
    expect(posts().filter(([url]) => url.endsWith("/auth/login"))).toHaveLength(2);
  });

  it("blocks registration when consent cannot load and supports retry", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network unavailable"));
    render(<AuthPage onBack={vi.fn()} onSuccess={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos conectar");
    expect(screen.getByRole("button", { name: "Crear Cuenta de Cuidador" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Volver a cargar el consentimiento" }));
    expect(await screen.findByRole("checkbox")).not.toBeChecked();
    expect(screen.getByText(texts.text)).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });
});
