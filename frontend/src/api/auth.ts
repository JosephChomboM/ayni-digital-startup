export interface User {
  id: string;
  email: string;
  name: string;
  family_id: string;
  role: "cuidador_principal" | "familiar";
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token?: string;
  consent?: {
    text_version: string;
    accepted_at: string;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export async function login(credentials: { email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) throw new Error("Error en las credenciales");
  return res.json();
}

export async function register(data: {
  email: string;
  password: string;
  name: string;
  family_name: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Error al registrar el usuario");
  return res.json();
}

export const loginCaregiver = login;
export const registerCaregiver = register;

export async function getMe(): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/me`);
  if (!res.ok) throw new Error("No autenticado");
  return res.json();
}

export const getCaregiverProfile = getMe;
