import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, ApiError } from "./client";

describe("client.ts - apiFetch", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "http://localhost:8000");
  });

  it("lanza ApiError si VITE_API_URL no está configurada", async () => {
    vi.stubEnv("VITE_API_URL", "");
    await expect(apiFetch("/test")).rejects.toThrow(ApiError);
  });

  it("maneja respuesta 204 sin intentar leer JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 204,
      ok: true,
    }));

    const result = await apiFetch<void>("/test");
    expect(result).toBeUndefined();
  });

  it("conserva message, code y status en ApiError al recibir error HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({
        detail: {
          code: "invalid_credentials",
          message: "El correo o la contraseña no son correctos.",
        },
      }),
    }));

    try {
      await apiFetch("/auth/login");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("invalid_credentials");
      expect(apiErr.status).toBe(401);
      expect(apiErr.message).toBe("El correo o la contraseña no son correctos.");
    }
  });
});

