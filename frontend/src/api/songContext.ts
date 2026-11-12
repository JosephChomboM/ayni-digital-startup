import { apiFetch } from "./client";
export interface Recording { recording_id: string; title: string; artist: string | null; year: number | null; genres: string[]; artist_genres?: string[]; version?: string; source_url: string }
export interface SongContext extends Partial<Recording> { status: "confirmed" | "needs_confirmation" | "unavailable"; channel?: string | null; candidates?: Recording[] }
export const getSongContext = (id: string, lookup = false, search = "") => apiFetch<SongContext>(`/memories/${encodeURIComponent(id)}/song-context?${new URLSearchParams({ lookup: String(lookup), ...(search.trim() ? { search: search.trim() } : {}) })}`);
export const confirmSongContext = (id: string, recordingId: string) => apiFetch<SongContext>(`/memories/${encodeURIComponent(id)}/song-context`, { method: "POST", body: JSON.stringify({ recording_id: recordingId }) });
