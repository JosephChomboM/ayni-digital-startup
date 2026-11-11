import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionGuide } from "./SessionGuide";
import { listMemories } from "../api/memories";
import type { Memory } from "../api/memories";
import { getLocalFamilyPhotos } from "../api/localMedia";
import { getFamilySessionFeedback } from "../api/sessionFeedback";
vi.mock("../api/memories", () => ({ listMemories: vi.fn() }));
vi.mock("../api/localMedia", () => ({ getLocalFamilyPhotos: vi.fn() }));
const user = { id: "u", name: "Ana", email: "ana@example.test", role: "familiar" as const, family_id: "f", created_at: "" };
beforeEach(() => {
 localStorage.clear();
 vi.mocked(listMemories).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
 vi.mocked(getLocalFamilyPhotos).mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); localStorage.clear(); });

const anecdote: Memory = {
    id: "positive", elder_profile_id: "p", created_by: user.id, type: "anecdote",
    title: "Paseo familiar", text: "Un paseo juntos", url: null,
    is_positive: true, is_sensitive: false, entities: [], entities_status: "completed",
    created_at: "", updated_at: "",
};

it("muestra en la guía solo anécdotas y canciones positivas que no sean sensibles", async () => {
  const items: Memory[] = [
    { ...anecdote, id: "neutral", title: "Anécdota sin marcar", is_positive: false },
    { ...anecdote, id: "sensitive", title: "Anécdota delicada", is_sensitive: true },
    anecdote,
    { ...anecdote, id: "song", type: "song", title: "Canción familiar", text: null, url: "https://open.spotify.com/track/1ubPOjDpZ5GtGOW8dR4NOh" },
    { ...anecdote, id: "neutral-song", type: "song", title: "Canción sin marcar", text: null, is_positive: false },
    { ...anecdote, id: "sensitive-song", type: "song", title: "Canción delicada", text: null, is_sensitive: true },
  ];
  vi.mocked(listMemories).mockResolvedValue({ items, total: items.length, limit: 50, offset: 0 });

  render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);

  expect(await screen.findByRole("option", { name: "Paseo familiar" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Canción familiar" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Anécdota sin marcar" })).toBeNull();
  expect(screen.queryByRole("option", { name: "Anécdota delicada" })).toBeNull();
  expect(screen.queryByRole("option", { name: "Canción sin marcar" })).toBeNull();
  expect(screen.queryByRole("option", { name: "Canción delicada" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Comenzar cuando estén listos" }));
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByText(/Pueden partir de “Paseo familiar”/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByText(/Reproduzcan “Canción familiar”/)).toBeInTheDocument();
});

it.each([
  { type: "anecdote" as const, is_positive: true, is_sensitive: false, allowed: true },
  { type: "anecdote" as const, is_positive: true, is_sensitive: true, allowed: false },
  { type: "anecdote" as const, is_positive: false, is_sensitive: false, allowed: false },
  { type: "anecdote" as const, is_positive: false, is_sensitive: true, allowed: false },
  { type: "song" as const, is_positive: true, is_sensitive: false, allowed: true },
  { type: "song" as const, is_positive: true, is_sensitive: true, allowed: false },
  { type: "song" as const, is_positive: false, is_sensitive: false, allowed: false },
  { type: "song" as const, is_positive: false, is_sensitive: true, allowed: false },
])("comprueba las marcas de $type: positiva=$is_positive y sensible=$is_sensitive", async ({ type, is_positive, is_sensitive, allowed }) => {
  const item: Memory = {
    ...anecdote, type, is_positive, is_sensitive,
    url: type === "song" ? "https://open.spotify.com/track/1ubPOjDpZ5GtGOW8dR4NOh" : null,
    text: type === "anecdote" ? anecdote.text : null,
  };
  vi.mocked(listMemories).mockResolvedValue({ items: [item], total: 1, limit: 50, offset: 0 });
  render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
  await screen.findByText("Aún no hay fotos guardadas aquí.");
  expect(screen.queryByRole("option", { name: item.title }) !== null).toBe(allowed);
});

it("mantiene la anécdota permitida elegida por la familia al iniciar la conversación", async () => {
  const second = { ...anecdote, id: "second", title: "Otro paseo" };
  vi.mocked(listMemories).mockResolvedValue({ items: [anecdote, second], total: 2, limit: 50, offset: 0 });
  render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
  const select = await screen.findByLabelText("Anécdota para conversar");
  fireEvent.change(select, { target: { value: second.id } });
  fireEvent.click(screen.getByRole("button", { name: "Comenzar cuando estén listos" }));
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByText(/Pueden partir de “Otro paseo”/)).toBeInTheDocument();
});

it("descarta la selección anterior cuando se vuelve a cargar contenido que ya es sensible", async () => {
  vi.mocked(listMemories).mockResolvedValueOnce({ items: [anecdote], total: 1, limit: 50, offset: 0 });
  const view = render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
  await screen.findByRole("option", { name: anecdote.title });
  view.unmount();

  vi.mocked(listMemories).mockResolvedValueOnce({ items: [{ ...anecdote, is_sensitive: true }], total: 1, limit: 50, offset: 0 });
  render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
  await screen.findByText("Aún no hay fotos guardadas aquí.");
  expect(screen.queryByRole("option", { name: anecdote.title })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Comenzar cuando estén listos" }));
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.queryByText(/Pueden partir de/)).toBeNull();
});

it("muestra el error de carga sin ofrecer recuerdos de una respuesta fallida", async () => {
  vi.mocked(listMemories).mockRejectedValue(new Error("No pudimos conectar."));
  render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos conectar.");
  await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
});
it("uses actual loaded memories, pauses progression and saves the review only locally", async () => {
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 await screen.findByText("Aún no hay fotos guardadas aquí.");
 expect(screen.getByText(/solo en este navegador/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button", { name: "Comenzar cuando estén listos" }));
 fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
 expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
 fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
 fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
 expect(screen.getByRole("heading", { name: "Conversen sin apuro" })).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
 fireEvent.click(screen.getByRole("button", { name: "A gusto" }));
 fireEvent.click(screen.getByRole("button", { name: "Cómoda" }));
 fireEvent.click(screen.getByRole("button", { name: "Guardar reseña" }));
 expect(screen.getByRole("heading", { name: "Reseña guardada en este navegador" })).toBeInTheDocument();
 expect(getFamilySessionFeedback("f")).toHaveLength(1);
 expect(getFamilySessionFeedback("another-family")).toHaveLength(0);
});
it("allows skipping feedback without creating a record", async () => {
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 await screen.findByText("Aún no hay fotos guardadas aquí.");
 fireEvent.click(screen.getByRole("button", { name: "Comenzar cuando estén listos" }));
 fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
 fireEvent.click(screen.getByRole("button", { name: "Omitir" }));
 expect(getFamilySessionFeedback("f")).toHaveLength(0);
});
