import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Memory } from "../api/memories";
import { MemoryChecklist } from "./MemoryChecklist";

afterEach(cleanup);
const memory: Memory = {
  id: "one", elder_profile_id: "profile", created_by: "user", type: "anecdote",
  title: "El paseo", text: "Un paseo", url: null, is_positive: true, is_sensitive: false,
  entities_status: "pending", entities: [], created_at: "", updated_at: "",
};
const memories = [memory, { ...memory, id: "two", title: "La canción", type: "song" as const },
  { ...memory, id: "secret", title: "Tema delicado", is_sensitive: true },
  { ...memory, id: "neutral", title: "Sin confirmar", is_positive: false },
  { ...memory, id: "deleted", title: "Eliminándose", deletion_pending: true }];

it("searches and selects eligible memories without including sensitive or deleting ones", () => {
  const onChange = vi.fn();
  render(<MemoryChecklist memories={memories} selected={["one"]} onChange={onChange} />);
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  expect(screen.getByText("1 recuerdo seleccionado")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "CANCIÓN" } });
  expect(screen.queryByRole("checkbox", { name: /El paseo/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: /La canción/ }));
  expect(onChange).toHaveBeenCalledWith(["one", "two"]);
});

it("all includes every eligible memory even when the search hides some of them", () => {
  render(<MemoryChecklist memories={memories} selected={[]} all onChange={vi.fn()} />);
  expect(screen.getByText("2 recuerdos seleccionados")).toBeInTheDocument();
  for (const checkbox of screen.getAllByRole("checkbox")) {
    expect(checkbox).toBeChecked(); expect(checkbox).toBeDisabled();
  }
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no existe" } });
  expect(screen.getByText("No hay recuerdos con ese título.")).toBeInTheDocument();
  expect(screen.getByText("2 recuerdos seleccionados")).toBeInTheDocument();
});
