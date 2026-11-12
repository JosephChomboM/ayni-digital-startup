import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionGuide } from "./SessionGuide";
import { listMemories } from "../api/memories";
import { getLocalFamilyPhotos } from "../api/localMedia";
import { getFamilySessionFeedback } from "../api/sessionFeedback";
import { nextConversationTurn } from "../api/conversation";
import type { FaceCue } from "./sessionSignals";
vi.mock("../api/memories", () => ({ listMemories: vi.fn() }));
vi.mock("../api/localMedia", () => ({ getLocalFamilyPhotos: vi.fn() }));
vi.mock("../api/conversation", () => ({ nextConversationTurn: vi.fn() }));
vi.mock("./SessionCamera", () => ({
 SessionCamera: ({ onCue }: { onCue: (cue: FaceCue) => void }) =>
   <button type="button" onClick={() => onCue("away")}>Simular salida de cuadro</button>,
}));
const user = { id: "u", name: "Ana", email: "ana@example.test", role: "familiar" as const, family_id: "f", created_at: "" };
const memory = {
 id: "memory", elder_profile_id: "profile", created_by: "u", type: "anecdote" as const,
 title: "El paseo", text: "Caminamos por el parque.", url: null,
 is_positive: true, is_sensitive: false, entities: [], entities_status: "completed" as const,
 created_at: "", updated_at: "",
};
beforeEach(() => {
 localStorage.clear();
 vi.mocked(listMemories).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
 vi.mocked(getLocalFamilyPhotos).mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
it("uses actual loaded memories, pauses progression and saves the review only locally", async () => {
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 await screen.findByText("Aún no hay fotos guardadas aquí.");
 expect(screen.getByText(/solo en este navegador/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button", { name: "Comenzar cuando estén listos" }));
 fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
 expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
 fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
 fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
 expect(screen.getByRole("heading", { name: "Conversen sin apuro" })).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
 fireEvent.click(screen.getByRole("button", { name: "A gusto" }));
 fireEvent.click(screen.getByRole("button", { name: "Cómoda" }));
 fireEvent.click(screen.getByRole("button", { name: "Guardar reseña" }));
 expect(screen.getByRole("heading", { name: "Reseña guardada en este navegador" })).toBeInTheDocument();
 expect(getFamilySessionFeedback("f")).toHaveLength(1);
 expect(getFamilySessionFeedback("another-family")).toHaveLength(0);
});
it("allows skipping feedback without creating a record", async () => {
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 await screen.findByText("Aún no hay fotos guardadas aquí.");
 fireEvent.click(screen.getByRole("button", { name: "Comenzar cuando estén listos" }));
 fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
 fireEvent.click(screen.getByRole("button", { name: "Omitir" }));
 expect(getFamilySessionFeedback("f")).toHaveLength(0);
});

it("aborts a pending turn and releases the camera panel when framing pauses the guide", async () => {
 vi.mocked(listMemories).mockResolvedValue({ items: [memory], total: 1, limit: 50, offset: 0 });
 vi.mocked(nextConversationTurn)
   .mockResolvedValueOnce({ question_id: "first", question: "¿Qué parte quieres contar?", source: "ai" })
   .mockImplementationOnce(() => new Promise(() => {}));
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 await screen.findByRole("combobox", { name: "Anécdota para conversar" });
 fireEvent.click(screen.getByRole("button", { name: "Comenzar cuando estén listos" }));
 fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
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
 vi.mocked(listMemories).mockResolvedValue({ items: [memory], total: 1, limit: 50, offset: 0 });
 vi.mocked(nextConversationTurn).mockResolvedValue({
   question_id: "first", question: "¿Qué parte quieres contar?", source: "ai",
 });
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 await screen.findByRole("combobox", { name: "Anécdota para conversar" });
 fireEvent.click(screen.getByRole("button", { name: "Comenzar cuando estén listos" }));
 fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
 fireEvent.click(screen.getByRole("button", { name: "Conversar" }));
 fireEvent.click(await screen.findByRole("button", { name: "Responder por voz" }));
 await waitFor(() => expect(recognition.start).toHaveBeenCalledOnce());
 expect(recognition!.processLocally).toBe(true);
 act(() => recognition.onresult?.({ results: [[{ transcript: "Quiero descansar un rato" }]] }));
 expect(screen.getByText("Claro, tomemos una pausa.")).toBeInTheDocument();
 expect(recognition!.abort).toHaveBeenCalledOnce();
 expect(nextConversationTurn).toHaveBeenCalledOnce();
});
