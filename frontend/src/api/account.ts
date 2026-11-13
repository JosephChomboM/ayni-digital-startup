import { apiFetch, ApiError } from "./client";
import { logout } from "./auth";
import type { CurrentUserResponse, LoginResponse, RegisterResponse } from "./auth";

export interface GoogleConfig { enabled: boolean; client_id: string | null }
export interface GoogleChallenge { challenge_id: string; nonce: string; expires_at: string }
export interface GoogleProof { credential: string; challenge_id: string }
export type GoogleRegistration = GoogleProof & {
  name: string; password: string; consent: { accepted: true; text_version: string };
} & ({ family_name: string; invitation_token?: never } | { invitation_token: string; family_name?: never });
export interface ProfileChanges { name?: string; phone?: string | null; city?: string | null; district?: string | null }

export function getGoogleConfig(): Promise<GoogleConfig> { return apiFetch("/auth/google/config", { signal: AbortSignal.timeout(90_000) }); }
export function createGoogleChallenge(): Promise<GoogleChallenge> {
  return apiFetch("/auth/google/challenge", { method: "POST", signal: AbortSignal.timeout(90_000) });
}

export async function loginWithGoogle(proof: GoogleProof): Promise<LoginResponse> {
  logout();
  const result = await apiFetch<LoginResponse>("/auth/google/login", { method: "POST", body: JSON.stringify(proof), signal: AbortSignal.timeout(90_000) });
  if (!result.access_token?.trim() || result.token_type !== "bearer" || !result.user?.id) {
    throw new ApiError("No pudimos comprobar tu acceso con Google.", "invalid_response", 200);
  }
  localStorage.setItem("ayni_token", result.access_token);
  // El backend ya verificó Google y emitió la sesión de Ayni.
  // Una segunda consulta no debe deshacer un acceso que acaba de completarse.
  return result;
}

function requirePassword(password: string): void {
  if (Array.from(password).length < 10) throw new ApiError("La contraseña debe tener al menos 10 caracteres.", "validation_error", 422);
}

export function registerWithGoogle(data: GoogleRegistration): Promise<RegisterResponse> {
  requirePassword(data.password);
  return apiFetch("/auth/google/register", { method: "POST", body: JSON.stringify(data) });
}

export function linkGoogle(proof: GoogleProof, password: string): Promise<void> {
  requirePassword(password);
  return apiFetch("/auth/google/link", { method: "POST", body: JSON.stringify({ ...proof, password }) });
}

export function updateMyProfile(changes: ProfileChanges): Promise<CurrentUserResponse> {
  return apiFetch("/users/me", { method: "PATCH", body: JSON.stringify(changes) });
}

export async function deleteMyAccount(password: string, confirmation: string): Promise<void> {
  requirePassword(password);
  if (confirmation !== "ELIMINAR") throw new ApiError("Escribe ELIMINAR para confirmar.", "validation_error", 422);
  await apiFetch<void>("/users/me", { method: "DELETE", body: JSON.stringify({ password, confirmation }) });
  logout();
}
