import { apiFetch } from "./client";
import type { Reaction } from "./sessions";

export interface FamilyReactions {
  history: { session_id: string; occurred_at: string; reaction: Reaction }[];
  summary: { total: number; counts: Record<Reaction, number>; start: string; end: string; disclaimer: string };
  pause: { should_pause: boolean; message: string | null; disclaimer: string };
}

export const getFamilyReactions = () => apiFetch<FamilyReactions>("/insights/reactions");
