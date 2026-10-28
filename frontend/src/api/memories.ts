import { apiFetch, ApiError } from "./client";

export type MemoryType = "anecdote" | "song";
export interface Memory {
  id: string;
  elder_profile_id: string;
  created_by: string;
  type: MemoryType;
  title: string;
  text: string | null;
  url: string | null;
  is_positive: boolean;
  is_sensitive: boolean;
  entities: Array<{ kind: "person" | "place" | "period" | "activity"; text: string }>;
  entities_status: "pending" | "completed" | "failed" | "not_applicable";
  created_at: string;
  updated_at: string;
}

type MemoryFields = { title: string; is_positive?: boolean; is_sensitive?: boolean };
export type MemoryInput = MemoryFields & (
  | { type: "anecdote"; text: string; url?: never }
  | { type: "song"; url: string; text?: never }
);
export type MemoryPatch = Partial<MemoryFields & { text: string; url: string }>;
export interface MemoryList {
  items: Memory[];
  total: number;
  limit: number;
  offset: number;
}

function boundedText(value: string, limit: number, label: string): string {
  const text = value.trim();
  if (!text || Array.from(text).length > limit) {
    throw new ApiError(`${label} debe tener entre 1 y ${limit} caracteres.`, "validation_error", 422);
  }
  return text;
}

export function normalizeSongUrl(value: string): string {
  try {
    const raw = value.trim();
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || /\s/.test(raw) || raw.length > 2048) {
      throw new Error("invalid URL");
    }
    let video: string | undefined;
    if (url.hostname === "youtu.be") video = url.pathname.replace(/^\/+|\/+$/g, "");
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      if (url.pathname === "/watch") {
        const values = url.searchParams.getAll("v");
        video = values.length === 1 ? values[0] : undefined;
      } else {
        video = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
      }
    }
    if (video && /^[A-Za-z0-9_-]{11}$/.test(video)) return `https://www.youtube.com/watch?v=${video}`;
    if (url.hostname === "open.spotify.com") {
      const track = url.pathname.match(/^\/(?:intl-[a-z]{2}\/|embed\/)?track\/([A-Za-z0-9]{22})\/?$/)?.[1];
      if (track) return `https://open.spotify.com/track/${track}`;
    }
  } catch {
    // Report a fixed message; never echo credentials or URL contents.
  }
  throw new ApiError("Pega un enlace de video de YouTube o de una canción de Spotify, sin listas de reproducción.", "song_url_invalid", 422);
}

export function createMemory(input: MemoryInput): Promise<Memory> {
  const fields = {
    title: boundedText(input.title, 100, "El título"),
    is_positive: input.is_positive ?? false,
    is_sensitive: input.is_sensitive ?? false,
  };
  const content = input.type === "anecdote"
    ? { type: "anecdote", text: boundedText(input.text, 5000, "La anécdota") }
    : { type: "song", url: normalizeSongUrl(input.url) };
  return apiFetch<Memory>("/memories", { method: "POST", body: JSON.stringify({ ...fields, ...content }) });
}

export function listMemories(query: { type?: MemoryType; include_sensitive?: boolean; limit?: number; offset?: number } = {}): Promise<MemoryList> {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) params.set(name, String(value));
  }
  return apiFetch<MemoryList>(`/memories${params.size ? `?${params}` : ""}`);
}

export function getMemory(id: string): Promise<Memory> {
  return apiFetch<Memory>(`/memories/${encodeURIComponent(id)}`);
}

export function updateMemory(id: string, changes: MemoryPatch): Promise<Memory> {
  if (!Object.keys(changes).length || (changes.text !== undefined && changes.url !== undefined)) {
    throw new ApiError("Cambia una anécdota o una canción a la vez.", "validation_error", 422);
  }
  const body = { ...changes };
  if (body.title !== undefined) body.title = boundedText(body.title, 100, "El título");
  if (body.text !== undefined) body.text = boundedText(body.text, 5000, "La anécdota");
  if (body.url !== undefined) body.url = normalizeSongUrl(body.url);
  return apiFetch<Memory>(`/memories/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteMemory(id: string): Promise<void> {
  return apiFetch<void>(`/memories/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function memoryErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "elder_profile_not_found") {
    return "Primero completa el perfil del adulto mayor para guardar o consultar sus recuerdos.";
  }
  return error instanceof Error ? error.message : "No pudimos completar la solicitud. Inténtalo de nuevo.";
}
