import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { createGoogleChallenge, getGoogleConfig } from "../api/account";

vi.mock("../api/account", () => ({ createGoogleChallenge: vi.fn(), getGoogleConfig: vi.fn() }));
beforeEach(() => { vi.mocked(getGoogleConfig).mockResolvedValue({ enabled: false, client_id: null }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

it("keeps Google disabled without server configuration and never loads the SDK", async () => {
  render(<GoogleSignInButton onCredential={vi.fn()} />);
  expect(await screen.findByRole("button", { name: /Próximamente/ })).toBeDisabled();
  expect(createGoogleChallenge).not.toHaveBeenCalled();
  expect(document.querySelector('script[src="https://accounts.google.com/gsi/client"]')).toBeNull();
});

it("initializes the official button with a server nonce and returns the opaque proof", async () => {
  const proof = { credential: crypto.randomUUID(), challenge_id: crypto.randomUUID() };
  const nonce = crypto.randomUUID(); let callback!: (data: { credential: string }) => void;
  const initialize = vi.fn((options) => { callback = options.callback; });
  vi.stubGlobal("google", { accounts: { id: { initialize, renderButton: (element: HTMLElement) => {
    const button = document.createElement("button"); button.textContent = "Continuar con Google";
    button.onclick = () => callback({ credential: proof.credential }); element.appendChild(button);
  } } } });
  vi.mocked(getGoogleConfig).mockResolvedValue({ enabled: true, client_id: "ayni-test.apps.googleusercontent.com" });
  vi.mocked(createGoogleChallenge).mockResolvedValue({ challenge_id: proof.challenge_id, nonce, expires_at: "2026-11-11T12:05:00Z" });
  const onCredential = vi.fn(); render(<GoogleSignInButton onCredential={onCredential} />);
  const button = await screen.findByRole("button", { name: "Continuar con Google" });
  await waitFor(() => expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: "ayni-test.apps.googleusercontent.com", nonce })));
  fireEvent.click(button); expect(onCredential).toHaveBeenCalledWith(proof);
});

it("offers a clear retry when configuration cannot be loaded", async () => {
  vi.mocked(getGoogleConfig).mockRejectedValue(new Error("Sin conexión"));
  render(<GoogleSignInButton onCredential={vi.fn()} />);
  expect(await screen.findByRole("button", { name: "Volver a intentar Google" })).toBeEnabled();
});
