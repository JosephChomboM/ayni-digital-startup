import { apiFetch } from "./client";

export interface PageControl {
  id: string;
  label: string;
  kind: "click" | "fill" | "select";
  value: string;
  options: { value: string; label: string }[];
  confirmation: boolean;
}

export interface PageScreen { page: string; text: string; controls: PageControl[]; completed_controls: PageControl[] }
export interface AssistantMessage { role: "user" | "assistant"; content: string }
export interface PageDecision {
  message: string;
  action: "done" | "click" | "fill" | "select" | "scroll" | "wait";
  target: string;
  value: string;
}

export const assistantTurn = (instruction: string, screen: PageScreen, history: AssistantMessage[], results: string[], signal: AbortSignal) =>
  apiFetch<PageDecision>("/assistant/turn", { method: "POST", body: JSON.stringify({ instruction, screen, history, results }), signal });

export const assistantSpeech = (_id: string, text: string, signal: AbortSignal) =>
  apiFetch<Blob>("/assistant/voice", { method: "POST", body: JSON.stringify({ text }), signal }, "blob");
