import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";
import { getElderProfile, getMyFamily } from "../api/families";
import { listMemories } from "../api/memories";
import { getLocalFamilyPhotos } from "../api/localMedia";
import { ApiError } from "../api/client";

vi.mock("../api/localMedia", () => ({ getLocalFamilyPhotos: vi.fn() }));
vi.mock("../api/families", () => ({ getElderProfile: vi.fn(), getMyFamily: vi.fn() }));
vi.mock("../api/memories", () => ({ listMemories: vi.fn() }));
const profile = { id: "p", family_id: "f", name: "Elena", birth_decade: 1950, interests: ["música"], created_at: "", updated_at: "" };
const actions = () => ({ onStartSession: vi.fn(), onViewMemories: vi.fn(), onViewProfile: vi.fn(), canManageFamily: true });
beforeEach(() => {
  vi.mocked(getLocalFamilyPhotos).mockResolvedValue([]);
  vi.mocked(getMyFamily).mockResolvedValue({ id: "f", name: "Familia de prueba", created_at: "" });
  vi.mocked(getElderProfile).mockResolvedValue(profile);
  vi.mocked(listMemories).mockResolvedValue({ items: [], total: 7, limit: 1, offset: 0 });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("uses the real memory total instead of counting profile interests", async () => {
  const props = actions();
  render(<HomePage {...props} />);
  expect(await screen.findByText(/7 recuerdos disponibles/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Preparar una sesión/ }));
  expect(props.onStartSession).toHaveBeenCalledOnce();
  expect(screen.getByText(/no se sincronizan/)).toBeInTheDocument();
});

it("guides a caregiver to the missing profile before a first session", async () => {
  vi.mocked(getElderProfile).mockRejectedValue(new ApiError("No existe", "elder_profile_not_found", 404));
  vi.mocked(listMemories).mockRejectedValue(new ApiError("No existe", "elder_profile_not_found", 404));
  const props = actions();
  render(<HomePage {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: /Completar perfil familiar/ }));
  expect(props.onViewProfile).toHaveBeenCalledOnce();
  expect(props.onStartSession).not.toHaveBeenCalled();
});

it("does not pretend an outage means zero memories and supports retry", async () => {
  vi.mocked(listMemories).mockRejectedValueOnce(new ApiError("Sin conexión", "network_error", 0));
  render(<HomePage {...actions()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos consultar");
  expect(screen.queryByText(/0 recuerdos disponibles/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
  expect(await screen.findByText(/7 recuerdos disponibles/)).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("respects invited relatives' read-only profile access", async () => {
  vi.mocked(getElderProfile).mockRejectedValue(new ApiError("No existe", "elder_profile_not_found", 404));
  render(<HomePage {...actions()} canManageFamily={false} />);
  expect(await screen.findByRole("button", { name: /Ver perfil familiar/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Completar perfil familiar/ })).toBeNull();
});

it("includes locally stored photos without mistaking the first API page for the total", async () => {
  vi.mocked(getLocalFamilyPhotos).mockResolvedValue([{} as Awaited<ReturnType<typeof getLocalFamilyPhotos>>[number]]);
  render(<HomePage {...actions()} currentUser={{ id: "u", name: "Ana", email: "ana@example.test", role: "familiar", family_id: "f", created_at: "" }} />);
  expect(await screen.findByText(/8 recuerdos disponibles/)).toBeInTheDocument();
});

it("keeps a neutral heading even if the stored group name contains an accidental secret", async () => {
  const accidentalValue = crypto.randomUUID();
  vi.mocked(getMyFamily).mockResolvedValue({ id: "f", name: accidentalValue, created_at: "" });
  render(<HomePage {...actions()} />);
  expect(await screen.findByRole("heading", { name: "Tu espacio familiar" })).toBeInTheDocument();
  expect(screen.queryByText(accidentalValue)).not.toBeInTheDocument();
});
