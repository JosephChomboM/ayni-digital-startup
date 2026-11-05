import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UploadModule } from "../components/UploadModule";
const photoStore = vi.hoisted(() => ({ items: [] as Array<Record<string, unknown>> }));
vi.mock("../api/localMedia", () => ({
  getLocalFamilyPhotos: vi.fn(async () => [...photoStore.items]),
  saveLocalFamilyPhoto: vi.fn(async (photo: Record<string, unknown>) => { photoStore.items.push(photo); }),
  deleteLocalFamilyPhoto: vi.fn(async (id: string) => { photoStore.items = photoStore.items.filter((photo) => photo.id !== id); }),
}));
import type { User } from "./auth";
import type { Memory } from "./memories";

const fetchMock = vi.fn<typeof fetch>();
let actor: User;
let records: Memory[];
let profile: Record<string, unknown> | null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function memory(fields: Partial<Memory> = {}): Memory {
  return {
    id: crypto.randomUUID(), elder_profile_id: crypto.randomUUID(), created_by: actor.id,
    type: "anecdote", title: "Un paseo", text: "Un paseo en familia.", url: null,
    is_positive: false, is_sensitive: false, entities: [], entities_status: "pending",
    created_at: "2026-10-27T00:00:00Z", updated_at: "2026-10-27T00:00:00Z", ...fields,
  };
}

async function backend(input: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const method = options?.method ?? "GET";
  if (url.pathname === "/users/me") return json({ user: actor, consent: {} });
  if (url.pathname === "/families/me/elder-profile") {
    if (method === "PUT") profile = { id: crypto.randomUUID(), family_id: actor.family_id, ...JSON.parse(options?.body as string) };
    return profile ? json(profile) : json({ detail: { code: "elder_profile_not_found", message: "Falta el perfil." } }, 404);
  }
  if (url.pathname === "/families/me/members") return json({ items: [actor] });
  if (url.pathname === "/families/me/invitations") return json({ items: [] });
  if (url.pathname === "/memories" && method === "POST") {
    const body = JSON.parse(options?.body as string) as Partial<Memory>;
    const created = memory({ ...body, text: body.text ?? null, url: body.url ?? null });
    records.unshift(created);
    return json(created, 201);
  }
  if (url.pathname === "/memories") {
    const query = (url.searchParams.get("q") ?? "").toLocaleLowerCase();
    const items = records.filter((item) =>
      (url.searchParams.get("include_sensitive") === "true" || !item.is_sensitive) &&
      [item.title, item.text ?? "", ...item.entities.map((entity) => entity.text)]
        .some((text) => text.toLocaleLowerCase().includes(query)));
    const offset = Number(url.searchParams.get("offset") ?? 0);
    return json({ items: items.slice(offset, offset + 20), total: items.length, limit: 20, offset });
  }
  const index = records.findIndex((item) => url.pathname === `/memories/${item.id}`);
  if (index < 0) return json({ detail: { code: "memory_not_found", message: "No encontramos este recuerdo." } }, 404);
  if (method === "DELETE") { records.splice(index, 1); return new Response(null, { status: 204 }); }
  if (method === "PATCH") Object.assign(records[index], JSON.parse(options?.body as string));
  return json(records[index]);
}

beforeEach(() => {
  actor = {
    id: crypto.randomUUID(), family_id: crypto.randomUUID(), email: "persona@example.com",
    name: "Persona de prueba", role: "cuidador_principal", created_at: "2026-10-27T00:00:00Z",
  };
  records = [];
  photoStore.items = [];
  profile = null;
  localStorage.setItem("ayni_token", crypto.randomUUID());
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  vi.stubGlobal("fetch", fetchMock.mockReset().mockImplementation(backend));
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test-photo") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function postCalls() {
  return fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
}

it("searches through the API, resets pagination and can clear the search", async () => {
  records = Array.from({ length: 101 }, (_, index) => memory({ title: `Recuerdo ${index}` }));
  records[0] = memory({ title: "Vacaciones", entities: [{ kind: "place", text: "Lima" }] });
  render(<UploadModule />);
  fireEvent.click(await screen.findByRole("button", { name: "Siguiente" }));
  await screen.findByText("Recuerdo 100");
  fireEvent.change(screen.getByLabelText("Buscar recuerdos"), { target: { value: " Lima " } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await screen.findByText("Vacaciones");
  expect(screen.queryByText("Recuerdo 100")).toBeNull();
  expect(fetchMock.mock.calls.some(([url]) => {
    const parsed = new URL(String(url));
    return parsed.searchParams.get("q") === "Lima" && parsed.searchParams.get("offset") === "0";
  })).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
  await screen.findByText("Recuerdo 1");
  expect(screen.getByLabelText("Buscar recuerdos")).toHaveValue("");
});

it("distinguishes no search results from an API failure", async () => {
  render(<UploadModule />);
  await screen.findByText("Todavía no hay recuerdos para mostrar.");
  fireEvent.change(screen.getByLabelText("Buscar recuerdos"), { target: { value: "Ausente" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await screen.findByText("No encontramos recuerdos con esa búsqueda.");
  fetchMock.mockImplementation(async (input, options) => new URL(String(input)).searchParams.has("q")
    ? json({ detail: { code: "unavailable", message: "No pudimos buscar." } }, 503)
    : backend(input, options));
  fireEvent.change(screen.getByLabelText("Buscar recuerdos"), { target: { value: "Otro" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos buscar.");
  expect(screen.queryByText("No encontramos recuerdos con esa búsqueda.")).toBeNull();
});

it("saves an anecdote with title, text and both explicit marks", async () => {
  render(<UploadModule />);
  fireEvent.change(screen.getByLabelText("Título del recuerdo"), { target: { value: "Un paseo" } });
  fireEvent.change(screen.getByLabelText("Una anécdota especial"), { target: { value: "Paseamos en familia." } });
  fireEvent.click(screen.getByLabelText("Es un recuerdo bonito"));
  fireEvent.click(screen.getByLabelText("Es un tema delicado"));
  fireEvent.click(screen.getByRole("button", { name: "Guardar anécdota" }));
  expect(await screen.findByRole("heading", { name: "¡Se guardó correctamente!" })).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveTextContent("Recuerdo guardado.");
  expect(JSON.parse(postCalls()[0][1]?.body as string)).toEqual({
    type: "anecdote", title: "Un paseo", text: "Paseamos en familia.", is_positive: true, is_sensitive: true,
  });
  expect(screen.getByLabelText("Título del recuerdo")).toHaveValue("");
});

it.each([
  ["https://youtu.be/abcdefghijk", "https://www.youtube.com/watch?v=abcdefghijk"],
  ["https://open.spotify.com/track/1234567890123456789012", "https://open.spotify.com/track/1234567890123456789012"],
])("saves an actual song link: %s", async (url, normalized) => {
  render(<UploadModule />);
  fireEvent.click(screen.getByRole("tab", { name: "Canción" }));
  fireEvent.change(screen.getByLabelText("Título del recuerdo"), { target: { value: "Canción familiar" } });
  fireEvent.change(screen.getByLabelText(/Canción de YouTube o Spotify/), { target: { value: url } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar canción" }));
  expect(await screen.findByRole("heading", { name: "¡Se guardó correctamente!" })).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveTextContent("Recuerdo guardado.");
  expect(JSON.parse(postCalls()[0][1]?.body as string)).toEqual({
    type: "song", title: "Canción familiar", url: normalized, is_positive: false, is_sensitive: false,
  });
});

it.each([
  "https://open.spotify.com/playlist/1234567890123456789012",
  "https://youtube.com/playlist?list=abcdefghijk",
])("rejects playlists before the POST: %s", async (url) => {
  render(<UploadModule />);
  fireEvent.click(screen.getByRole("tab", { name: "Canción" }));
  fireEvent.change(screen.getByLabelText("Título del recuerdo"), { target: { value: "Canción" } });
  fireEvent.change(screen.getByLabelText(/Canción de YouTube o Spotify/), { target: { value: url } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar canción" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("sin listas de reproducción");
  expect(postCalls()).toHaveLength(0);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it.each([
  ["elder_profile_not_found", "Falta el perfil.", "Primero completa el perfil del adulto mayor"],
  ["validation_error", "Revisa los datos enviados.", "Revisa los datos enviados."],
])("shows the server error or profile instruction: %s", async (code, message, expected) => {
  fetchMock.mockImplementation(async (input, options) => options?.method === "POST"
    ? json({ detail: { code, message } }, code === "elder_profile_not_found" ? 404 : 422)
    : backend(input, options));
  render(<UploadModule />);
  fireEvent.change(screen.getByLabelText("Título del recuerdo"), { target: { value: "Un paseo" } });
  fireEvent.change(screen.getByLabelText("Una anécdota especial"), { target: { value: "Un paseo." } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar anécdota" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(expected);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByLabelText("Una anécdota especial")).toHaveValue("Un paseo.");
});

it("saves selected photos with an anecdote and clears the selection after confirmation", async () => {
  render(<UploadModule />);
  await screen.findByText("Todavía no hay recuerdos para mostrar.");
  const file = new File(["image"], "foto-familiar.jpg", { type: "image/jpeg" });
  fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
  expect(await screen.findByText("1 foto seleccionada; se guardarán junto con el recuerdo.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Título del recuerdo"), { target: { value: "Un paseo" } });
  fireEvent.change(screen.getByLabelText("Una anécdota especial"), { target: { value: "Paseamos en familia." } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar anécdota" }));
  fireEvent.click(await screen.findByRole("button", { name: "OK" }));
  expect(await screen.findByText("Las fotos seleccionadas se adjuntan al guardar el recuerdo.")).toBeInTheDocument();
  expect(screen.getByText("foto-familiar.jpg")).toBeInTheDocument();
  expect(photoStore.items).toHaveLength(1);
});

it("loads actual contributions, hides sensitive records and respects member permissions", async () => {
  actor.role = "familiar";
  records = [memory({ title: "Compartido", created_by: crypto.randomUUID() }), memory({ title: "Delicado", is_sensitive: true })];
  render(<UploadModule />);
  await screen.findByText("Compartido");
  expect(screen.queryByText("Delicado")).toBeNull();
  expect(screen.queryByRole("button", { name: "Editar Compartido" })).toBeNull();
  fireEvent.click(screen.getByLabelText("Mostrar temas delicados"));
  await screen.findByText("Delicado");
  expect(screen.getByRole("button", { name: "Editar Delicado" })).toBeEnabled();
});

it("reads, edits and deletes through real detail, PATCH and DELETE routes", async () => {
  const original = memory();
  records = [original];
  render(<UploadModule />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar Un paseo" }));
  await waitFor(() => expect(screen.getByLabelText("Título del recuerdo")).toHaveValue("Un paseo"));
  fireEvent.change(screen.getByLabelText("Título del recuerdo"), { target: { value: "Paseo actualizado" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("Cambios guardados.");
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  fireEvent.click(await screen.findByRole("button", { name: "Eliminar Paseo actualizado" }));
  await screen.findByText("Recuerdo eliminado.");
  await screen.findByText("Todavía no hay recuerdos para mostrar.");
  expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith(original.id) && (options?.method ?? "GET") === "GET")).toBe(true);
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(true);
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(true);
});

it("opens the existing profile and family screen so the caregiver can complete the prerequisite", async () => {
  render(<UploadModule />);
  fireEvent.click(screen.getByRole("button", { name: "Perfil y familia" }));
  const name = await screen.findByPlaceholderText("Ej. Mamá Elena");
  fireEvent.change(name, { target: { value: "Perfil de prueba" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar Perfil" }));
  await screen.findByText(/Perfil guardado correctamente/);
  const call = fetchMock.mock.calls.find(([, options]) => options?.method === "PUT");
  expect(String(call?.[0])).toBe("https://api.example.test/families/me/elder-profile");
  expect(JSON.parse(call?.[1]?.body as string)).toMatchObject({ name: "Perfil de prueba", interests: [] });
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/families/me/members"))).toBe(true);
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/families/me/invitations"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Volver a recuerdos" }));
  expect(screen.getByLabelText("Título del recuerdo")).toBeInTheDocument();
});
