import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionGuide } from "./SessionGuide";
import { listMemories } from "../api/memories";
import { getLocalFamilyPhotos } from "../api/localMedia";
import { getFamilySessionFeedback } from "../api/sessionFeedback";
import { nextConversationTurn } from "../api/conversation";
import type { FaceCue } from "./sessionSignals";

const speech = vi.hoisted(() => ({
  receive: undefined as ((text: string) => void) | undefined,
  cancel: vi.fn(),
  enabled: false,
}));
vi.mock("../api/memories", () => ({ listMemories: vi.fn() }));
vi.mock("../api/localMedia", () => ({ getLocalFamilyPhotos: vi.fn() }));
vi.mock("../api/conversation", () => ({ nextConversationTurn: vi.fn() }));
vi.mock("./useSessionDictation", () => ({
  useSessionDictation: (receive: (text: string) => void, enabled: boolean) => {
    speech.enabled = enabled;
    speech.receive = receive;
    return { state: "idle", error: "", retry: vi.fn(), cancel: speech.cancel };
  },
}));
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
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  speech.receive = undefined;
  localStorage.clear();
});

async function begin() {
  render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Empezar con Ayni" }));
}

it("greets immediately without a saved memory and keeps feedback local", async () => {
  await begin();
  expect(screen.getByText(/Hola, soy Ayni/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Apagar cámara" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
  expect(screen.getByRole("textbox", { name: "Tu respuesta" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByRole("textbox", { name: "Tu respuesta" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
  fireEvent.click(screen.getByRole("button", { name: "A gusto" }));
  fireEvent.click(screen.getByRole("button", { name: "Cómoda" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar reseña" }));
  expect(getFamilySessionFeedback("f")).toHaveLength(1);
  expect(getFamilySessionFeedback("another-family")).toHaveLength(0);
});

it("sends only the topic of a typed reply and keeps the preview active when the face leaves the frame", async () => {
  vi.mocked(listMemories).mockResolvedValue({ items: [memory], total: 1, limit: 50, offset: 0 });
  vi.mocked(nextConversationTurn).mockImplementation(() => new Promise(() => {}));
  await begin();
  fireEvent.change(screen.getByRole("textbox", { name: "Tu respuesta" }), { target: { value: "Fuimos al parque con mi hermana" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
  const [memoryId, topic, asked, signal] = vi.mocked(nextConversationTurn).mock.calls[0];
  expect([memoryId, topic, asked]).toEqual(["memory", "place", []]);
  fireEvent.click(screen.getByRole("button", { name: "Simular salida de cuadro" }));
  expect(signal.aborted).toBe(false);
  expect(screen.getByRole("button", { name: "Simular salida de cuadro" })).toBeInTheDocument();
  expect(screen.getByRole("log")).toHaveTextContent("Fuimos al parque con mi hermana");
  fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
  expect(signal.aborted).toBe(true);
  expect(screen.queryByRole("button", { name: "Simular salida de cuadro" })).not.toBeInTheDocument();
  expect(speech.enabled).toBe(false);
});

it("routes a transcribed request to pause through the same conversation", async () => {
  await begin();
  expect(speech.enabled).toBe(true);
  act(() => speech.receive?.("Quiero descansar un rato"));
  expect(screen.getByText(/Claro, hagamos una pausa/)).toBeInTheDocument();
  expect(speech.cancel).toHaveBeenCalled();
  expect(nextConversationTurn).not.toHaveBeenCalled();
});


it("starts in text mode without requesting devices and retains earlier turns", async () => {
  render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Empezar sin cámara ni micrófono" }));
  expect(speech.enabled).toBe(false);
  expect(screen.getByRole("button", { name: "Activar cámara" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Tu respuesta" }), { target: { value: "Fuimos al parque" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
  const log = screen.getByRole("log");
  expect(log).toHaveTextContent("Hola, soy Ayni");
  expect(log).toHaveTextContent("Fuimos al parque");
  expect(log).toHaveTextContent("¿Qué detalle de ese lugar");
});
