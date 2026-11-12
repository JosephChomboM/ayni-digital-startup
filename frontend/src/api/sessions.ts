import { apiFetch, ApiError } from "./client";

export interface SessionSummary {
  id: string;
  elder_profile_id: string;
  created_by?: string | null;
  created_at: string;
  template_version?: string;
  duration_minutes: number;
}

export interface SessionStep {
  position?: number;
  duration_minutes?: number;
  instruction: string;
  source_memory_id?: string | null;
  memory_id: string | null;
  memory_available: boolean;
}

export interface SavedSession extends SessionSummary { steps: SessionStep[] }
export type SessionGuide = SavedSession;
export interface SessionPage { items: SessionSummary[]; total: number; limit: number; offset: number }

export interface SavedMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestion: "continue" | "slow_down" | "pause" | "change_activity";
  observations: string[];
}

export interface ChatInput {
  text: string;
  request_id: string;
  image?: string;
  image_consent?: boolean;
  cue?: "smile" | "brow";
}

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

export const generateSession = () => apiFetch<SavedSession>("/sessions/generate", { method: "POST", body: "{}" });
export const getSession = (id: string) => apiFetch<SavedSession>(route(id));
export const listSessions = (limit = 20, offset = 0) =>
  apiFetch<SessionPage>(`/sessions?limit=${limit}&offset=${offset}`);
export const getMessages = (id: string) => apiFetch<SavedMessage[]>(`${route(id)}/messages`);
export const sendMessage = (id: string, input: ChatInput, signal: AbortSignal) =>
  apiFetch<SavedMessage>(`${route(id)}/chat`, { method: "POST", body: JSON.stringify(input), signal });

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

export async function imageForConversation(source: Blob | HTMLVideoElement): Promise<string> {
  const bitmap = source instanceof Blob ? await createImageBitmap(source) : source;
  try {
    const width = bitmap instanceof HTMLVideoElement ? bitmap.videoWidth : bitmap.width;
    const height = bitmap instanceof HTMLVideoElement ? bitmap.videoHeight : bitmap.height;
    if (!width || !height) throw new Error("La imagen todavía no está lista.");
    const scale = Math.min(1, 768 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally { if (bitmap instanceof ImageBitmap) bitmap.close(); }
}
