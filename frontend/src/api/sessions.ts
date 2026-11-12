import { apiFetch } from "./client";

export interface SessionSummary {
  id: string;
  elder_profile_id: string;
  created_at: string;
  duration_minutes: number;
}
export interface SessionStep {
  instruction: string;
  memory_id: string | null;
  memory_available: boolean;
}
export interface SavedSession extends SessionSummary { steps: SessionStep[] }
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
export const generateSession = () => apiFetch<SavedSession>("/sessions/generate", { method: "POST", body: "{}" });
export const getSession = (id: string) => apiFetch<SavedSession>(`/sessions/${encodeURIComponent(id)}`);
export const listSessions = (offset = 0) => apiFetch<{ items: SessionSummary[]; total: number; limit: number }>(`/sessions?limit=10&offset=${offset}`);
export const getMessages = (id: string) => apiFetch<SavedMessage[]>(`/sessions/${encodeURIComponent(id)}/messages`);
export const sendMessage = (id: string, input: ChatInput, signal: AbortSignal) => apiFetch<SavedMessage>(`/sessions/${encodeURIComponent(id)}/chat`, { method: "POST", body: JSON.stringify(input), signal });

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
