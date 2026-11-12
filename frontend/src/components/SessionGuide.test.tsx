import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionGuide } from "./SessionGuide";
import { generateSession, getSession, listSessions } from "../api/sessions";
import type { SessionDetail } from "../api/sessions";
import { getMemory } from "../api/memories";
import { ApiError } from "../api/client";
import { getFamilySessionFeedback } from "../api/sessionFeedback";
vi.mock("../api/sessions", () => ({ generateSession: vi.fn(), getSession: vi.fn(), listSessions: vi.fn() }));
vi.mock("../api/memories", () => ({ getMemory: vi.fn() }));
const user = { id: "u", name: "Ana", email: "ana@example.test", role: "familiar" as const, family_id: "f", created_at: "" };
const guide: SessionDetail = {
 id: "saved-guide", elder_profile_id: "profile", created_by: "u", created_at: "2026-11-11T15:00:00Z", template_version: "1.0", duration_minutes: 15,
 steps: [
  { position: 1, duration_minutes: 2, instruction: "Introducción guardada en el servidor", source_memory_id: null, memory_id: null, memory_available: false },
  { position: 2, duration_minutes: 10, instruction: "Conversen sobre el recuerdo guardado", source_memory_id: "m", memory_id: "m", memory_available: true },
  { position: 3, duration_minutes: 3, instruction: "Cierren a su ritmo", source_memory_id: null, memory_id: null, memory_available: false },
 ],
};
beforeEach(() => {
 vi.mocked(listSessions).mockResolvedValue({ items: [guide], total: 1, limit: 10, offset: 0 });
 vi.mocked(generateSession).mockResolvedValue(guide);
 vi.mocked(getSession).mockResolvedValue(guide);
 vi.mocked(getMemory).mockResolvedValue({ id: "m", elder_profile_id: "profile", type: "anecdote", title: "El paseo", text: "Contenido familiar permitido", is_positive: true, is_sensitive: false } as Awaited<ReturnType<typeof getMemory>>);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); localStorage.clear(); });
async function mount() {
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 await screen.findByRole("button", { name: "Abrir guía" });
}
it("genera en el backend y utiliza sus pasos, duración y contenido", async () => {
 await mount();
 expect(generateSession).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button", { name: "Generar y comenzar guía" }));
 await screen.findByText(guide.steps[0].instruction);
 expect(generateSession).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
 await screen.findByText("Contenido familiar permitido");
 expect(getMemory).toHaveBeenCalledWith("m");
 fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
 expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
 fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
 fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
 expect(screen.getByText("Cierren a su ritmo")).toBeInTheDocument();
});
it("recupera la misma guía después de desmontar la pantalla sin generar otra", async () => {
 await mount();
 fireEvent.click(screen.getByRole("button", { name: "Abrir guía" }));
 await screen.findByText(guide.steps[0].instruction);
 cleanup();
 await mount();
 fireEvent.click(screen.getByRole("button", { name: "Abrir guía" }));
 await screen.findByText(guide.steps[0].instruction);
 expect(getSession).toHaveBeenCalledTimes(2);
 expect(getSession).toHaveBeenLastCalledWith("saved-guide");
 expect(generateSession).not.toHaveBeenCalled();
});
it.each(["session_limit_reached", "no_eligible_memories"])("muestra %s sin inventar una guía ni ocultar el historial", async (code) => {
 vi.mocked(generateSession).mockRejectedValue(new ApiError("Mensaje del servidor", code, 409));
 await mount();
 fireEvent.click(screen.getByRole("button", { name: "Generar y comenzar guía" }));
 expect(await screen.findByRole("alert")).toHaveTextContent("Mensaje del servidor");
 expect(screen.queryByText(guide.steps[0].instruction)).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button", { name: "Abrir guía" }));
 await screen.findByText(guide.steps[0].instruction);
});
it("no solicita un recuerdo que el historial marca como retirado", async () => {
 vi.mocked(getSession).mockResolvedValue({ ...guide, steps: [{ ...guide.steps[1], memory_id: null, memory_available: false }] });
 await mount();
 fireEvent.click(screen.getByRole("button", { name: "Abrir guía" }));
 await screen.findByText(/Este recuerdo ya no está disponible/);
 expect(getMemory).not.toHaveBeenCalled();
});
it.each(["sensible", "no positivo", "otra familia", "borrado"])("oculta contenido que cambió a %s al recuperar el paso", async (kind) => {
 if (kind === "borrado") vi.mocked(getMemory).mockRejectedValue(new ApiError("No disponible", "memory_not_found", 404));
 else vi.mocked(getMemory).mockResolvedValue({ id: "m", elder_profile_id: kind === "otra familia" ? "other" : "profile", title: "Contenido restringido", text: "No mostrar", type: "anecdote", is_positive: kind !== "no positivo", is_sensitive: kind === "sensible" } as Awaited<ReturnType<typeof getMemory>>);
 await mount();
 fireEvent.click(screen.getByRole("button", { name: "Abrir guía" }));
 await screen.findByText(guide.steps[0].instruction);
 fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
 await screen.findByText(/Este recuerdo ya no está disponible/);
 expect(screen.queryByText("No mostrar")).not.toBeInTheDocument();
});
it("permite reintentar el historial cuando falla la red", async () => {
 vi.mocked(listSessions).mockRejectedValueOnce(new Error("Sin conexión"));
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 await screen.findByText("Sin conexión");
 fireEvent.click(screen.getByRole("button", { name: "Reintentar historial" }));
 await screen.findByRole("button", { name: "Abrir guía" });
});
it("pagina el historial sin perder el desplazamiento del servidor", async () => {
 vi.mocked(listSessions).mockResolvedValue({ items: [guide], total: 11, limit: 10, offset: 0 });
 await mount();
 fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
 await waitFor(() => expect(listSessions).toHaveBeenLastCalledWith(10));
 await screen.findByRole("button", { name: "Abrir guía" });
 expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled();
});
it("conserva la reseña local y permite volver al historial sin gastar cupo", async () => {
 await mount();
 fireEvent.click(screen.getByRole("button", { name: "Abrir guía" }));
 await screen.findByText(guide.steps[0].instruction);
 fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
 fireEvent.click(screen.getByRole("button", { name: "A gusto" }));
 fireEvent.click(screen.getByRole("button", { name: "Cómoda" }));
 fireEvent.click(screen.getByRole("button", { name: "Guardar reseña" }));
 await screen.findByText("Reseña guardada en este navegador");
 expect(getFamilySessionFeedback("f")).toHaveLength(1);
 fireEvent.click(screen.getByRole("button", { name: "Volver a la guía" }));
 await screen.findByRole("button", { name: "Abrir guía" });
 expect(generateSession).not.toHaveBeenCalled();
});
it("no conserva una guía de la familia anterior al cambiar de cuenta", async () => {
 const view = render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 await screen.findByRole("button", { name: "Abrir guía" });
 fireEvent.click(screen.getByRole("button", { name: "Abrir guía" }));
 await screen.findByText(guide.steps[0].instruction);
 vi.mocked(listSessions).mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
 view.rerender(<SessionGuide currentUser={{ ...user, id: "other", family_id: "other" }} onOpenMemories={vi.fn()} />);
 await screen.findByText("Todavía no hay guías guardadas.");
 expect(screen.queryByText(guide.steps[0].instruction)).not.toBeInTheDocument();
});
