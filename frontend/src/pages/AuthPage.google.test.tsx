import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthPage } from "./AuthPage";
import { ApiError } from "../api/client";
import { getConsent, login, register } from "../api/auth";
import { loginWithGoogle, registerWithGoogle, updateMyProfile } from "../api/account";
import type { GoogleProof } from "../api/account";

const proof = { credential: "synthetic-credential", challenge_id: "synthetic-challenge" };
const password = crypto.randomUUID();
vi.mock("../components/GoogleSignInButton", () => ({ GoogleSignInButton: ({ disabled, onCredential }: { disabled: boolean; onCredential: (proof: GoogleProof) => void }) => <button type="button" disabled={disabled} onClick={() => onCredential({ credential: "synthetic-credential", challenge_id: "synthetic-challenge" })}>Continuar con Google</button> }));
vi.mock("../api/auth", () => ({ getConsent: vi.fn(), login: vi.fn(), register: vi.fn() }));
vi.mock("../api/account", () => ({ loginWithGoogle: vi.fn(), registerWithGoogle: vi.fn(), updateMyProfile: vi.fn() }));
const user = { id: "u", family_id: "f", role: "cuidador_principal" as const, name: "Persona Prueba", email: "verified@example.com", created_at: "2026-11-11T12:00:00Z" };
const session = { user, access_token: crypto.randomUUID(), token_type: "bearer" as const, expires_in: 1800 };

beforeEach(() => {
  vi.mocked(getConsent).mockResolvedValue({ text_version: "1.0", text: "Texto exacto del servidor.", onboarding_notice: "Aviso exacto del servidor." });
  vi.mocked(loginWithGoogle).mockRejectedValue(new ApiError("Completa tu registro.", "google_account_not_registered", 404));
  vi.mocked(registerWithGoogle).mockResolvedValue({ user, family: { id: "f", name: "Familia Prueba", created_at: user.created_at }, consent: { text_version: "1.0", accepted_at: user.created_at } });
  vi.mocked(login).mockResolvedValue(session);
  vi.mocked(updateMyProfile).mockResolvedValue({ user, consent: { text_version: "1.0", accepted_at: user.created_at } });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

async function fillGoogleRegistration() {
  fireEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));
  await screen.findByText(/Usaremos el correo de tu cuenta de Google/);
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Persona" } });
  fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Prueba" } });
  fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "+51 900 000 000" } });
  fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: "Lima" } });
  fireEvent.change(screen.getByLabelText("Distrito"), { target: { value: "Surco" } });
  fireEvent.change(screen.getByLabelText("Nombre del grupo familiar"), { target: { value: "Familia Prueba" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: password } });
  fireEvent.click(await screen.findByRole("checkbox", { name: /Acepto el consentimiento mostrado/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Acepto el tratamiento de mis datos personales/ }));
}

it("uses an existing linked Google session without registering again", async () => {
  vi.mocked(loginWithGoogle).mockResolvedValue(session);
  const onSuccess = vi.fn(); render(<AuthPage initialMode="login" onBack={vi.fn()} onSuccess={onSuccess} />);
  fireEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(user));
  expect(registerWithGoogle).not.toHaveBeenCalled(); expect(login).not.toHaveBeenCalled();
});

it("requires explicit consent and creates the Google account before normal login and profile save", async () => {
  const onSuccess = vi.fn(); render(<AuthPage initialMode="login" onBack={vi.fn()} onSuccess={onSuccess} />);
  await fillGoogleRegistration();
  fireEvent.submit(screen.getByLabelText("Contraseña").closest("form")!);
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(user));
  expect(registerWithGoogle).toHaveBeenCalledWith(expect.objectContaining({ ...proof, family_name: "Familia Prueba", consent: { accepted: true, text_version: "1.0" } }));
  expect(vi.mocked(registerWithGoogle).mock.calls[0][0]).not.toHaveProperty("email");
  expect(login).toHaveBeenCalledWith({ email: user.email, password });
  expect(updateMyProfile).toHaveBeenCalledWith({ phone: "+51 900 000 000", city: "Lima", district: "Surco" });
  expect(register).not.toHaveBeenCalled();
});

it("does not automatically link an existing password account by email", async () => {
  vi.mocked(loginWithGoogle).mockRejectedValue(new ApiError("Inicia sesión y vincula Google desde tu cuenta.", "google_link_required", 409));
  const onSuccess = vi.fn(); render(<AuthPage initialMode="login" onBack={vi.fn()} onSuccess={onSuccess} />);
  fireEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("vincula Google");
  expect(onSuccess).not.toHaveBeenCalled(); expect(registerWithGoogle).not.toHaveBeenCalled();
});

it("reports a profile save failure after registration without claiming that contact data was saved", async () => {
  vi.mocked(updateMyProfile).mockRejectedValue(new ApiError("Sin conexión", "network_error", 0));
  const onSuccess = vi.fn(); render(<AuthPage initialMode="login" onBack={vi.fn()} onSuccess={onSuccess} />);
  await fillGoogleRegistration(); fireEvent.submit(screen.getByLabelText("Contraseña").closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("no pudimos guardar tus datos de contacto");
  expect(onSuccess).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continuar y completar mis datos después" }));
  expect(onSuccess).toHaveBeenCalledWith(user); expect(registerWithGoogle).toHaveBeenCalledOnce();
});
