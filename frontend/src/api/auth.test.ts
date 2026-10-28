import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConsent, getMe, login, logout, register } from "./auth";
import { ApiError } from "./client";
import type { RegisterPayload } from "./auth";

const user = {
  id: "8be88d30-4e52-47a6-9db6-5d0ed982acc9",
  family_id: "47a34d55-28da-47dc-afc6-53d0307adc85",
  email: "persona@example.com", name: "Persona de prueba", role: "cuidador_principal",
  created_at: "2026-10-27T00:00:00Z",
};
const consent = { text_version: "1.0", accepted_at: "2026-10-27T00:00:00Z" };
const fetchMock = vi.fn<typeof fetch>();

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.example.test/");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("families authentication API", () => {
  it("reads consent and notice from the public endpoint", async () => {
    const texts = { text_version: "1.0", text: "Texto recibido.", onboarding_notice: "Aviso recibido." };
    fetchMock.mockResolvedValue(response(texts));
    await expect(getConsent()).resolves.toEqual(texts);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/auth/consent");
  });

  it("registers either a family or an invitation with consent and without storing a token", async () => {
    const base = {
      name: "Persona de prueba", email: " PERSONA@EXAMPLE.COM ", password: crypto.randomUUID(),
      consent: { accepted: true as const, text_version: "1.0" },
    };
    const bodies: RegisterPayload[] = [
      { ...base, family_name: "Familia de prueba" },
      { ...base, invitation_token: crypto.randomUUID() },
    ];
    for (const body of bodies) {
      fetchMock.mockResolvedValue(response({ user, family: { id: user.family_id }, consent }, 201));
      await register(body);
      const [url, options] = fetchMock.mock.calls.at(-1)!;
      expect(url).toBe("https://api.example.test/auth/register");
      expect(options?.method).toBe("POST");
      expect(JSON.parse(options?.body as string)).toEqual({ ...body, email: "persona@example.com" });
      expect(localStorage.getItem("ayni_token")).toBeNull();
    }
  });

  it("stores access_token after login and preserves password whitespace", async () => {
    const token = crypto.randomUUID();
    const password = crypto.randomUUID() + "  ";
    fetchMock.mockResolvedValue(response({ user, access_token: token, token_type: "bearer", expires_in: 1800 }));
    await login({ email: " PERSONA@EXAMPLE.COM ", password });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/auth/login");
    expect(JSON.parse(options?.body as string)).toEqual({ email: "persona@example.com", password });
    expect(localStorage.getItem("ayni_token")).toBe(token);
  });

  it("loads /users/me with Authorization Bearer", async () => {
    const token = crypto.randomUUID();
    localStorage.setItem("ayni_token", token);
    fetchMock.mockResolvedValue(response({ user, consent }));
    await expect(getMe()).resolves.toEqual({ user, consent });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/users/me");
    expect(new Headers(options?.headers).get("Authorization")).toBe(`Bearer ${token}`);
  });

  it("clears rejected sessions and preserves the server error code and message", async () => {
    localStorage.setItem("ayni_token", crypto.randomUUID());
    fetchMock.mockResolvedValue(response({ detail: { code: "unauthorized", message: "Vuelve a iniciar sesión." } }, 401));
    await expect(getMe()).rejects.toMatchObject({
      code: "unauthorized", message: "Vuelve a iniciar sesión.", status: 401,
    });
    expect(localStorage.getItem("ayni_token")).toBeNull();
  });

  it("does not accept login responses without a real access_token", async () => {
    fetchMock.mockResolvedValue(response({ user }));
    await expect(login({ email: user.email, password: crypto.randomUUID() })).rejects.toMatchObject({
      code: "invalid_response",
    });
    expect(localStorage.getItem("ayni_token")).toBeNull();
  });

  it("retains structured registration validation errors", async () => {
    fetchMock.mockResolvedValue(response({ detail: { code: "consent_required", message: "Acepta el consentimiento." } }, 422));
    const operation = register({
      email: user.email, name: user.name, password: crypto.randomUUID(), family_name: "Familia",
      consent: { accepted: true, text_version: "1.0" },
    });
    await expect(operation).rejects.toBeInstanceOf(ApiError);
    await expect(operation).rejects.toMatchObject({ code: "consent_required", message: "Acepta el consentimiento.", status: 422 });
  });

  it("logout removes the token and getMe avoids an anonymous session request", async () => {
    localStorage.setItem("ayni_token", crypto.randomUUID());
    logout();
    await expect(getMe()).rejects.toMatchObject({ code: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
