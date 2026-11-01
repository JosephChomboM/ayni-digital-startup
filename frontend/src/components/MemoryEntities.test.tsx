import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Memory } from "../api/memories";
import { MemoryEntities } from "./MemoryEntities";

afterEach(cleanup);

const memory: Memory = {
  id: "memory", elder_profile_id: "profile", created_by: "author", type: "anecdote",
  title: "Paseo", text: "Un paseo familiar.", url: null, is_positive: true,
  is_sensitive: false, entities: [], entities_status: "completed",
  created_at: "2026-11-01T12:00:00Z", updated_at: "2026-11-01T12:00:00Z",
};

it("shows all entity kinds as plain text with a clear caveat", () => {
  render(<MemoryEntities memory={{ ...memory, entities: [
    { kind: "person", text: "Ana" }, { kind: "place", text: "Lima" },
    { kind: "period", text: "los años 70" }, { kind: "activity", text: "cocinar" },
    { kind: "person", text: "<script>alert(1)</script>" },
  ] }} />);
  fireEvent.click(screen.getByText("Detalles de la anécdota"));
  for (const label of ["Persona:", "Lugar:", "Época:", "Actividad:"]) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
  expect(screen.getByText("Los detalles se detectan automáticamente y pueden contener errores.")).toBeInTheDocument();
  expect(screen.getByText(/<script>/)).toBeInTheDocument();
  expect(document.querySelector("script")).toBeNull();
});

it.each([
  ["pending", "Estamos identificando los detalles."],
  ["failed", "Tu anécdota sigue guardada."],
  ["completed", "No se identificaron personas"],
] as const)("distinguishes %s from other processing states", (status, message) => {
  render(<MemoryEntities memory={{ ...memory, entities_status: status }} />);
  expect(screen.getByText((text) => text.includes(message))).toBeInTheDocument();
});

it("does not show anecdote processing on songs", () => {
  const { container } = render(<MemoryEntities memory={{ ...memory, type: "song", entities_status: "not_applicable" }} />);
  expect(container).toBeEmptyDOMElement();
});
