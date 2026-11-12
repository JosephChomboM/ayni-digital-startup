import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReactionHistory } from "./ReactionHistory";
import { getFamilyReactions } from "../api/insights";

vi.mock("../api/insights", () => ({ getFamilyReactions: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const data = { history: [{ session_id: "s", occurred_at: "2026-11-12T12:00:00Z", reaction: "agitado" as const }], summary: { total: 1, counts: { receptivo: 0, emocionado: 0, indiferente: 0, agitado: 1 }, start: "", end: "", disclaimer: "Esto no es un diagnóstico. Es un registro de actividades familiares." }, pause: { should_pause: true, message: "Te sugerimos pausar las actividades.", disclaimer: "" } };

it("muestra conteos, historial y la alerta recibida del backend", async () => {
  vi.mocked(getFamilyReactions).mockResolvedValue(data);
  render(<ReactionHistory familyId="f" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Te sugerimos pausar");
  expect(screen.getByText("Agitado: 1")).toBeInTheDocument();
  expect(screen.getByText(data.summary.disclaimer)).toBeInTheDocument();
  expect(screen.getByText(/Indiferente no cuenta/)).toBeInTheDocument();
});

it("no transforma errores de API en ausencia de alertas y permite reintentar", async () => {
  vi.mocked(getFamilyReactions).mockRejectedValueOnce(new Error()).mockResolvedValueOnce({ ...data, history: [], summary: { ...data.summary, total: 0 }, pause: { ...data.pause, should_pause: false } });
  render(<ReactionHistory familyId="f" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("No hay datos disponibles para evaluar");
  fireEvent.click(screen.getByRole("button", { name: "Reintentar resumen" }));
  await screen.findByText("Todavía no hay reacciones registradas.");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
