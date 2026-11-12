import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionGuide } from "./SessionGuide";
import { ApiError } from "../api/client";
import { getMemory } from "../api/memories";
import { listPhotos } from "../api/photos";
import { generateSession, getRecordedReaction, getSession, listSessions, recordReaction } from "../api/sessions";
import type { SessionResponse } from "../api/sessions";
import { nextConversationTurn } from "../api/conversation";
import type { FaceCue } from "./sessionSignals";

vi.mock("../api/sessions", () => ({ generateSession: vi.fn(), getRecordedReaction: vi.fn(), getSession: vi.fn(), listSessions: vi.fn(), recordReaction: vi.fn() }));
vi.mock("../api/memories", () => ({ getMemory: vi.fn(), memoryErrorMessage: (error: Error) => error.message }));
vi.mock("../api/photos", () => ({ listPhotos: vi.fn() }));

vi.mock("../api/conversation", () => ({ nextConversationTurn: vi.fn() }));
vi.mock("./SessionCamera", () => ({
  SessionCamera: ({ onCue }: { onCue: (cue: FaceCue) => void }) =>
    <button type="button" onClick={() => onCue("away")}>Simular salida de cuadro</button>,
}));
const user = { id: "u", name: "Persona de prueba", email: "persona@example.test", role: "familiar" as const, family_id: "f", created_at: "2026-11-11T12:00:00Z" };
const guide = { id: "saved-guide", elder_profile_id: "p", created_by: "u", created_at: "2026-11-11T12:00:00Z", template_version: "1.0", duration_minutes: 15, steps: [
  { position: 1, duration_minutes: 2, instruction: "Busca un lugar tranquilo.", memory_id: null, source_memory_id: null, memory_available: false },
  { position: 2, duration_minutes: 10, instruction: "Lean la anécdota juntos.", memory_id: "memory", source_memory_id: "memory", memory_available: true },
  { position: 3, duration_minutes: 3, instruction: "Agradece el momento compartido.", memory_id: null, source_memory_id: null, memory_available: false },
] };
const response: SessionResponse = { id: "saved-response", session_id: guide.id, elder_profile_id: "p", created_by: "u", reaction: "receptivo", occurred_at: guide.created_at, created_at: guide.created_at };

beforeEach(() => {
  localStorage.clear();
  vi.mocked(listSessions).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  vi.mocked(generateSession).mockResolvedValue(guide);
  vi.mocked(getSession).mockResolvedValue(guide);
  vi.mocked(getRecordedReaction).mockResolvedValue(null);
  vi.mocked(recordReaction).mockResolvedValue(response);
  vi.mocked(listPhotos).mockResolvedValue([]);
  vi.mocked(getMemory).mockResolvedValue({ id: "memory", elder_profile_id: "p", created_by: "u", type: "anecdote", title: "Paseo en familia", text: "Un paseo agradable.", url: null, is_positive: true, is_sensitive: false, entities: [], entities_status: "completed", created_at: guide.created_at, updated_at: guide.created_at });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

async function begin() {
  render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Comenzar cuando estén listos" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await screen.findByText("Busca un lugar tranquilo.");
}

it("uses persisted steps and confirms a reaction only after the server saves it", async () => {
  let resolveSave!: (value: SessionResponse) => void;
  vi.mocked(recordReaction).mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
  await begin();
  expect(generateSession).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
  expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByText("Un paseo agradable.");
  fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
  expect(screen.getByRole("button", { name: "Guardar reacción" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Receptivo" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar reacción" }));
  expect(recordReaction).toHaveBeenCalledWith(guide.id, "receptivo");
  expect(screen.queryByRole("heading", { name: "Reacción guardada en tu familia" })).not.toBeInTheDocument();
  await act(async () => resolveSave(response));
  expect(await screen.findByRole("heading", { name: "Reacción guardada en tu familia" })).toBeInTheDocument();
  expect(localStorage.length).toBe(0);
});

it("shows the API error and permits retry without pretending a guide was generated", async () => {
  vi.mocked(generateSession).mockRejectedValue(new ApiError("Ya preparaste tu guía de esta semana.", "session_limit_reached", 409));
  render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Comenzar cuando estén listos" });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("Ya preparaste tu guía de esta semana.");
  expect(screen.queryByRole("button", { name: "Terminar" })).not.toBeInTheDocument();
  expect(recordReaction).not.toHaveBeenCalled();
});

it("recovers an existing guide and reaction without consuming another generation", async () => {
  vi.mocked(listSessions).mockResolvedValue({ items: [guide], total: 1, limit: 20, offset: 0 });
  vi.mocked(getRecordedReaction).mockResolvedValue(response);
  render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Abrir guía" }));
  await screen.findByText("Busca un lugar tranquilo.");
  fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
  expect(await screen.findByRole("heading", { name: "Reacción guardada en tu familia" })).toBeInTheDocument();
  expect(generateSession).not.toHaveBeenCalled(); expect(recordReaction).not.toHaveBeenCalled();
});

it("keeps the reaction form open with the error when save fails", async () => {
  vi.mocked(recordReaction).mockRejectedValue(new ApiError("No pudimos guardar. Inténtalo de nuevo.", "service_unavailable", 503));
  await begin(); fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
  fireEvent.click(screen.getByRole("button", { name: "Agitado" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar reacción" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos guardar.");
  expect(screen.getByRole("button", { name: "Guardar reacción" })).toBeEnabled();
  expect(screen.queryByRole("heading", { name: "Reacción guardada en tu familia" })).not.toBeInTheDocument();
});

it("aborts a pending turn and releases the camera panel when framing pauses the guide", async () => {
 vi.mocked(nextConversationTurn)
   .mockResolvedValueOnce({ question_id: "first", question: "¿Qué parte quieres contar?", source: "ai" })
   .mockImplementationOnce(() => new Promise(() => {}));
 await begin();
 fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
 await screen.findByText("Un paseo agradable.");
 expect(nextConversationTurn).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button", { name: "Conversar" }));
 expect(await screen.findByText("Pregunta elegida por IA")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button", { name: "Activar cámara" }));
 fireEvent.click(screen.getByRole("button", { name: "El lugar" }));
 const [memoryId, topic, asked, signal] = vi.mocked(nextConversationTurn).mock.calls[1];
 expect([memoryId, topic, asked]).toEqual(["memory", "place", ["first"]]);
 fireEvent.click(screen.getByRole("button", { name: "Simular salida de cuadro" }));
 expect(signal.aborted).toBe(true);
 expect(screen.queryByRole("region", { name: "Conversar con Ayni" })).not.toBeInTheDocument();
 expect(screen.getByText(/salió del cuadro/)).toBeInTheDocument();
 expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
});

it("acts on a spoken request to rest without submitting the transcript", async () => {
 let recognition: FakeRecognition;
 class FakeRecognition {
   static available = vi.fn().mockResolvedValue("available");
   processLocally = false;
   lang = "";
   start = vi.fn();
   abort = vi.fn();
   onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
   constructor() { recognition = this; }
 }
 vi.stubGlobal("SpeechRecognition", FakeRecognition);
 vi.mocked(nextConversationTurn).mockResolvedValue({
   question_id: "first", question: "¿Qué parte quieres contar?", source: "ai",
 });
 await begin();
 fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
 await screen.findByText("Un paseo agradable.");
 fireEvent.click(screen.getByRole("button", { name: "Conversar" }));
 fireEvent.click(await screen.findByRole("button", { name: "Responder por voz" }));
 await waitFor(() => expect(recognition.start).toHaveBeenCalledOnce());
 expect(recognition!.processLocally).toBe(true);
 act(() => recognition.onresult?.({ results: [[{ transcript: "Quiero descansar un rato" }]] }));
 expect(screen.getByText("Claro, tomemos una pausa.")).toBeInTheDocument();
 expect(recognition!.abort).toHaveBeenCalledOnce();
 expect(nextConversationTurn).toHaveBeenCalledOnce();
});
