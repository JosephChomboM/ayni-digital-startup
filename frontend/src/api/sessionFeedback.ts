export type SessionFeeling = "content" | "calm" | "tired" | "no_answer";
export type SessionExperience = "comfortable" | "mixed" | "paused";

export interface SessionFeedback {
  id: string;
  family_id: string;
  user_id: string;
  user_name: string;
  feeling: SessionFeeling;
  experience: SessionExperience;
  note: string;
  duration_seconds: number;
  created_at: string;
}

const STORAGE_KEY = "ayni-session-feedback-v1";

function readAll(): SessionFeedback[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed as SessionFeedback[] : [];
  } catch { return []; }
}

export function getFamilySessionFeedback(familyId: string): SessionFeedback[] {
  return readAll().filter((item) => item.family_id === familyId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function saveSessionFeedback(feedback: SessionFeedback): void {
  const all = readAll().filter((item) => item.id !== feedback.id);
  all.push(feedback);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(-200)));
}
