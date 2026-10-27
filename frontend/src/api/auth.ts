import { apiFetch } from "./client";

export interface ConsentResponse {
  text_version: string;
  text: string;
  onboarding_notice: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  family_id: string;
  role: "cuidador_principal" | "familiar";
  created_at: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  family_name?: string;
  invitation_token?: string;
  consent: {
    accepted: boolean;
    text_version: string;
  };
}

export interface RegisterResponse {
  user: User;
  family: { id: string; name: string; created_at: string };
  consent: { text_version: string; accepted_at: string };
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export async function getConsent(): Promise<ConsentResponse> {
  return apiFetch<ConsentResponse>("/auth/consent");
}

export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(): Promise<{ user: User; consent: { text_version: string; accepted_at: string } }> {
  return apiFetch<{ user: User; consent: { text_version: string; accepted_at: string } }>("/users/me");
}

