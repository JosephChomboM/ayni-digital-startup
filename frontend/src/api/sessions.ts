import { apiFetch, ApiError } from "./client";

export interface SessionSummary {
  id: string;
  elder_profile_id: string;
  created_by: string | null;
  created_at: string;
  template_version: string;
  duration_minutes: number;
}

export interface SessionStep {
  position: number;
  duration_minutes: number;
  instruction: string;
  source_memory_id: string | null;
  memory_id: string | null;
  memory_available: boolean;
}

export interface SessionGuide extends SessionSummary { steps: SessionStep[] }
export interface SessionPage { items: SessionSummary[]; total: number; limit: number; offset: number }
export type Reaction = "receptivo" | "emocionado" | "indiferente" | "agitado";
export interface SessionResponse {
  id: string;
  session_id: string;
  elder_profile_id: string;
  created_by: string | null;
  reaction: Reaction;
  occurred_at: string;
  created_at: string;
}

const route = (id: string) => `/sessions/${encodeURIComponent(id)}`;

export function generateSession(): Promise<SessionGuide> {
  return apiFetch("/sessions/generate", { method: "POST", body: "{}" });
}

export function listSessions(limit = 20, offset = 0): Promise<SessionPage> {
  return apiFetch(`/sessions?limit=${limit}&offset=${offset}`);
}

export function getSession(id: string): Promise<SessionGuide> { return apiFetch(route(id)); }

export function recordReaction(id: string, reaction: Reaction): Promise<SessionResponse> {
  return apiFetch(`${route(id)}/response`, { method: "POST", body: JSON.stringify({ reaction }) });
}

export async function getRecordedReaction(id: string): Promise<SessionResponse | null> {
  try { return await apiFetch<SessionResponse>(`${route(id)}/response`); }
  catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.code === "response_not_found") return null;
    throw error;
  }
}
