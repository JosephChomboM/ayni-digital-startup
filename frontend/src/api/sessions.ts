import { apiFetch } from "./client";

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

export interface SessionDetail extends SessionSummary {
  steps: SessionStep[];
}

export interface SessionHistory {
  items: SessionSummary[];
  total: number;
  limit: number;
  offset: number;
}

export function generateSession(): Promise<SessionDetail> {
  return apiFetch<SessionDetail>("/sessions/generate", { method: "POST", body: "{}" });
}

export function listSessions(offset = 0): Promise<SessionHistory> {
  return apiFetch<SessionHistory>(`/sessions?limit=10&offset=${offset}`);
}

export function getSession(id: string): Promise<SessionDetail> {
  return apiFetch<SessionDetail>(`/sessions/${encodeURIComponent(id)}`);
}
