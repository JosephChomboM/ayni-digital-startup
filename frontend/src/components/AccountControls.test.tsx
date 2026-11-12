import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountControls } from "./AccountControls";
import { deleteMyAccount, linkGoogle, updateMyProfile } from "../api/account";
import { ApiError, SESSION_EXPIRED_EVENT } from "../api/client";
import type { User } from "../api/auth";
import type { GoogleProof } from "../api/account";

vi.mock("../api/account", () => ({ deleteMyAccount: vi.fn(), linkGoogle: vi.fn(), updateMyProfile: vi.fn() }));
vi.mock("./GoogleSignInButton", () => ({ GoogleSignInButton: ({ disabled, onCredential }: { disabled: boolean; onCredential: (proof: GoogleProof) => void }) => <button type="button" disabled={disabled} onClick={() => onCredential({ credential: "synthetic-credential", challenge_id: "synthetic-challenge" })}>Vincular con Google</button> }));
const user: User = { id: "u", name: "Persona de prueba", email: "persona@example.com", role: "cuidador_principal", family_id: "f", created_at: "2026-11-11T12:00:00Z", phone: null, city: null, district: null };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); });

it("saves profile fields through the API and updates the signed-in identity", async () => {
  const updated = { ...user, name: "Nombre actualizado", city: "Lima" };
  vi.mocked(updateMyProfile).mockResolvedValue({ user: updated, consent: { text_version: "1.0", accepted_at: user.created_at } });
  const onUpdated = vi.fn(); render(<AccountControls user={user} onUpdated={onUpdated} />);
  fireEvent.change(screen.getByLabelText("Nombre de tu cuenta"), { target: { value: "Nombre actualizado" } });
  fireEvent.change(screen.getByLabelText("Ciudad de residencia"), { target: { value: "Lima" } });
  fireEvent.submit(screen.getByRole("form", { name: "Editar mis datos" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Tus datos se guardaron");
  expect(updateMyProfile).toHaveBeenCalledWith({ name: "Nombre actualizado", phone: null, city: "Lima", district: null });
  expect(onUpdated).toHaveBeenCalledWith(updated);
});

it("requires password before linking Google and sends explicit proof", async () => {
  vi.mocked(linkGoogle).mockResolvedValue(undefined);
  render(<AccountControls user={user} />);
  expect(screen.getByRole("button", { name: "Vincular con Google" })).toBeDisabled();
  const password = crypto.randomUUID();
  fireEvent.change(screen.getByLabelText("Contraseña para vincular Google"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Vincular con Google" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Google quedó vinculada");
  expect(linkGoogle).toHaveBeenCalledWith({ credential: "synthetic-credential", challenge_id: "synthetic-challenge" }, password);
  expect(screen.getByLabelText("Contraseña para vincular Google")).toHaveValue("");
});

it("explains family-wide caregiver deletion and retries failures without claiming success", async () => {
  vi.mocked(deleteMyAccount).mockRejectedValueOnce(new ApiError("No pudimos acceder a las fotos. Inténtalo de nuevo.", "photo_storage_unavailable", 503)).mockResolvedValueOnce(undefined);
  const ended = vi.fn(); window.addEventListener(SESSION_EXPIRED_EVENT, ended);
  try {
    render(<AccountControls user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar eliminación de cuenta" }));
    expect(screen.getByText(/Se eliminarán toda tu familia/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar eliminación" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Entiendo qué datos se eliminarán/ }));
    fireEvent.change(screen.getByLabelText("Escribe ELIMINAR"), { target: { value: "ELIMINAR" } });
    const password = crypto.randomUUID();
    fireEvent.change(screen.getByLabelText("Contraseña para eliminar la cuenta"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos acceder a las fotos");
    expect(ended).not.toHaveBeenCalled(); expect(sessionStorage.getItem("ayni_account_deleted")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    await waitFor(() => expect(ended).toHaveBeenCalledOnce());
    expect(sessionStorage.getItem("ayni_account_deleted")).toBe("1");
    expect(deleteMyAccount).toHaveBeenLastCalledWith(password, "ELIMINAR");
  } finally { window.removeEventListener(SESSION_EXPIRED_EVENT, ended); }
});

it("tells members that other family accounts remain and never deletes on opening", () => {
  render(<AccountControls user={{ ...user, role: "familiar" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Revisar eliminación de cuenta" }));
  expect(screen.getByText(/Los demás integrantes conservarán su cuenta/)).toBeInTheDocument();
  expect(deleteMyAccount).not.toHaveBeenCalled();
});
