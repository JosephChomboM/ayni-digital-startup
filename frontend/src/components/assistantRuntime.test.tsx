import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { captureScreen, performAction } from "./assistantRuntime";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 20, height: 20 }] as unknown as DOMRectList);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("fills a React controlled field and executes the existing form handler", () => {
  const saved = vi.fn();
  function Form() {
    const [name, setName] = useState("");
    return <div className="app-shell"><form onSubmit={event => { event.preventDefault(); saved(name); }}>
      <label>Nombre del recuerdo<input value={name} onChange={event => setName(event.target.value)} /></label>
      <button>Guardar recuerdo</button>
    </form></div>;
  }
  render(<Form />);
  const first = captureScreen();
  const input = first.screen.controls.find(item => item.kind === "fill")!;
  act(() => { performAction({ action: "fill", target: input.id, value: "Paseo por Lima", message: "" }, first); });
  const second = captureScreen();
  const button = second.screen.controls.find(item => item.kind === "click")!;
  performAction({ action: "click", target: button.id, value: "", message: "" }, second);
  expect(saved).toHaveBeenCalledWith("Paseo por Lima");
});

it("excludes credentials, disabled controls and assistant controls; flags destructive actions", () => {
  render(<div className="app-shell"><label>Contraseña<input type="password" defaultValue="test-secret" /></label>
    <button disabled>Guardar</button><button>Eliminar cuenta</button>
    <div data-ayni-assistant><button>Enviar petición</button></div>
  </div>);
  const { screen: snapshot } = captureScreen();
  expect(snapshot.controls).toHaveLength(1);
  expect(snapshot.controls[0]).toMatchObject({ label: "Eliminar cuenta", confirmation: true });
  expect(JSON.stringify(snapshot)).not.toContain("test-secret");
  expect(snapshot.text).not.toContain("Enviar petición");
});

it("rejects stale targets and restricts interaction to the open modal", () => {
  render(<div className="app-shell"><button>Perfil</button></div>);
  const previous = captureScreen();
  render(<div role="dialog" aria-modal="true"><button>Cancelar</button></div>);
  const button = previous.screen.controls[0];
  expect(() => performAction({ action: "click", target: button.id, value: "", message: "" }, previous)).toThrow(/pantalla cambió/);
  expect(captureScreen().screen.controls.map(item => item.label)).toEqual(["Cancelar"]);
});

it("selects an existing memory by value and rejects invented values", () => {
  render(<div className="app-shell"><label>Recuerdo<select defaultValue=""><option value="">Elige</option><option value="memory-1">Paseo</option></select></label></div>);
  const snapshot = captureScreen();
  const control = snapshot.screen.controls[0];
  expect(control.options).toContainEqual({ value: "memory-1", label: "Paseo" });
  performAction({ action: "select", target: control.id, value: "memory-1", message: "" }, snapshot);
  expect(screen.getByLabelText("Recuerdo")).toHaveValue("memory-1");
  expect(() => performAction({ action: "select", target: control.id, value: "other", message: "" }, snapshot)).toThrow(/opción/);
});
