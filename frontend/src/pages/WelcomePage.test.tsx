import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WelcomePage } from "./WelcomePage";

afterEach(cleanup);

it("conecta la invitación principal al registro y mantiene el acceso existente", () => {
  const register = vi.fn();
  const login = vi.fn();
  render(<WelcomePage onRegisterClick={register} onLoginClick={login}/>);
  fireEvent.click(screen.getByRole("button", { name: "Empezar nuestra historia" }));
  expect(register).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  expect(login).toHaveBeenCalledOnce();
});

it("permite explorar los ejemplos sin presentarlos como una conversación real", () => {
  render(<WelcomePage/>);
  fireEvent.click(screen.getByRole("button", { name: "Canciones" }));
  expect(screen.getByRole("heading", { name: "Una canción puede traer muchos recuerdos" })).toBeInTheDocument();
  expect(screen.getByText("Música que despierta recuerdos")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Canciones" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
  expect(screen.getByRole("navigation", { name: "Menú móvil" })).toBeInTheDocument();
});
