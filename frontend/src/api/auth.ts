import { apiFetch, ApiError } from "./client";

export interface User {
  id: string;
  email: string;
  name: string;
  family_id: string;
  role: "cuidador_principal" | "familiar";
  created_at: string;
}

export interface ConsentText {
  text_version: string;
  text: string;
  onboarding_notice: string;
}

export interface CurrentUserResponse {
  user: User;
  consent: {
    text_version: string;
    accepted_at: string;
  };
}

export interface RegisterResponse extends CurrentUserResponse {
  family: { id: string; name: string; created_at: string };
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
}

export function getConsent(): Promise<ConsentText> {
  return apiFetch<ConsentText>("/auth/consent");
}

export function logout(): void {
  localStorage.removeItem("ayni_token");
}

export async function login(credentials: { email: string; password: string }): Promise<LoginResponse> {
  logout();
  const response = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ ...credentials, email: credentials.email.trim().toLowerCase() }),
  });
  if (
    typeof response.access_token !== "string" || !response.access_token.trim() ||
    response.token_type !== "bearer" || !response.user?.id
  ) {
    throw new ApiError("No pudimos iniciar tu sesión. Inténtalo de nuevo.", "invalid_response", 200);
  }
  localStorage.setItem("ayni_token", response.access_token);
  return response;
}

export async function register(data: {
  email: string;
  password: string;
  name: string;
  family_name: string;
}): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...data, email: data.email.trim().toLowerCase() }),
  });
}

export const loginCaregiver = login;
export const registerCaregiver = register;

export async function getMe(): Promise<CurrentUserResponse> {
  if (!localStorage.getItem("ayni_token")) {
    throw new ApiError("Inicia sesión para continuar.", "unauthorized", 401);
  }
  try {
    const response = await apiFetch<CurrentUserResponse>("/users/me");
    if (!response.user?.id) {
      throw new ApiError("No pudimos comprobar tu sesión.", "invalid_response", 200);
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) logout();
    throw error;
  }
}

export const getCaregiverProfile = getMe;
