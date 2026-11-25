import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PageAssistant } from "./PageAssistant";
import { assistantTurn } from "../api/assistant";

vi.mock("../api/assistant", () => ({ assistantTurn: vi.fn(), assistantSpeech: vi.fn().mockRejectedValue(new Error("no audio")) }));
vi.mock("./useSessionDictation", () => ({ useSessionDictation: () => ({ state: "idle", error: "" }) }));
vi.mock("./sessionSignals", () => ({ speakLocally: () => false }));

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 20, height: 20 }] as unknown as DOMRectList);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.mocked(assistantTurn).mockReset(); });

it("waits for human confirmation before a destructive action", async () => {
  const remove = vi.fn();
  vi.mocked(assistantTurn).mockImplementation(async (_text, snapshot) => ({ message: "Voy a eliminar el recuerdo.", action: "click", target: snapshot.controls.find(item => item.label === "Eliminar recuerdo")!.id, value: "" }));
  render(<><div className="app-shell"><button onClick={remove}>Eliminar recuerdo</button></div><PageAssistant open onOpenChange={vi.fn()} /></>);
  fireEvent.click(screen.getByRole("button", { name: "Empezar con Ayni" }));
  fireEvent.change(screen.getByLabelText("Qué quieres hacer"), { target: { value: "Elimina el recuerdo" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar petición" }));
  await screen.findByRole("button", { name: "Confirmar acción" });
  expect(remove).not.toHaveBeenCalled();
  vi.mocked(assistantTurn).mockResolvedValue({ message: "La página muestra el resultado.", action: "done", target: "", value: "" });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar acción" }));
  expect(remove).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.getByLabelText("Qué quieres hacer")).toBeEnabled(), { timeout: 2000 });
});

it("ignores a provider response received after cancellation", async () => {
  const navigate = vi.fn();
  let resolve: (value: Awaited<ReturnType<typeof assistantTurn>>) => void = () => {};
  let target = "";
  vi.mocked(assistantTurn).mockImplementation((_text, snapshot) => {
    target = snapshot.controls[0].id;
    return new Promise(done => { resolve = done; });
  });
  render(<><div className="app-shell"><button onClick={navigate}>Recuerdos</button></div><PageAssistant open onOpenChange={vi.fn()} /></>);
  fireEvent.click(screen.getByRole("button", { name: "Empezar con Ayni" }));
  fireEvent.change(screen.getByLabelText("Qué quieres hacer"), { target: { value: "Abre mis recuerdos" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar petición" }));
  fireEvent.click(screen.getByRole("button", { name: "Detener petición" }));
  resolve({ action: "click", target, value: "", message: "Abro recuerdos." });
  await waitFor(() => expect(screen.getByLabelText("Qué quieres hacer")).toBeEnabled());
  expect(navigate).not.toHaveBeenCalled();
});

it("resumes a failed step without repeating an already executed save", async () => {
  const save = vi.fn();
  vi.mocked(assistantTurn)
    .mockImplementationOnce(async (_text, snapshot) => ({ action: "click", target: snapshot.controls[0].id, value: "", message: "Guardo el perfil." }))
    .mockRejectedValueOnce(new Error("Límite temporal. Reintenta el paso."))
    .mockResolvedValueOnce({ action: "done", target: "", value: "", message: "El perfil está guardado." });
  render(<><div className="app-shell"><button onClick={save}>Guardar perfil</button></div><PageAssistant open onOpenChange={vi.fn()} /></>);
  fireEvent.click(screen.getByRole("button", { name: "Empezar con Ayni" }));
  fireEvent.change(screen.getByLabelText("Qué quieres hacer"), { target: { value: "Guarda el perfil" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar petición" }));
  fireEvent.click(await screen.findByRole("button", { name: "Reintentar paso pendiente" }, { timeout: 2000 }));
  await screen.findByText("El perfil está guardado.");
  expect(save).toHaveBeenCalledOnce();
  const resumed = vi.mocked(assistantTurn).mock.calls[2];
  expect(resumed[1].controls).toEqual([]);
  expect(resumed[1].completed_controls[0].label).toBe("Guardar perfil");
  expect(resumed[3]).toHaveLength(1);
});
