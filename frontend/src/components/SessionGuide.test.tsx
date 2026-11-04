import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ResponseRegistry } from "./ResponseRegistry";
import { SessionGuide } from "./SessionGuide";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("allows the user to start, pause, resume, and finish the session guide", () => {
  vi.useFakeTimers();
  render(<SessionGuide />);

  fireEvent.click(screen.getByRole("button", { name: /generar sesión de hoy/i }));
  expect(screen.getByText(/organizando los recuerdos/i)).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(700));
  expect(screen.getByText("Sesión de hoy")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /pausar/i }));
  expect(screen.getByText("En pausa")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
  expect(screen.getByText("04:32")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /terminar sesión/i }));
  expect(screen.getByRole("button", { name: /generar sesión de hoy/i })).toBeInTheDocument();
});

it("lets the caregiver select and confirm a family response", () => {
  vi.useFakeTimers();
  render(<ResponseRegistry />);

  const agitated = screen.getByRole("button", { name: /agitado/i });
  fireEvent.click(agitated);
  expect(agitated).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: /guardar registro/i }));
  act(() => vi.advanceTimersByTime(700));
  expect(screen.getByRole("button", { name: /registro guardado/i })).toBeDisabled();
});
