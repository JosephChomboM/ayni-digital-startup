import { apiFetch } from "./client";

export type ConversationTopic = "start" | "place" | "activity" | "detail" | "ease";

export interface ConversationTurn {
  question_id: string;
  question: string;
  source: "ai" | "guide";
}

export function nextConversationTurn(
  memoryId: string,
  topic: ConversationTopic,
  asked: string[],
  signal: AbortSignal,
): Promise<ConversationTurn> {
  return apiFetch<ConversationTurn>(`/sessions/conversation/${encodeURIComponent(memoryId)}`, {
    method: "POST",
    body: JSON.stringify({ topic, asked }),
    signal,
  });
}
