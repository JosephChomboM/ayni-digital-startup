import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deletePhoto, listPhotos, uploadPhoto } from "./photos";
import type { MemoryPhoto } from "./photos";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  vi.stubGlobal("fetch", fetchMock.mockReset());
  localStorage.setItem("ayni_token", "synthetic-session");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });

it("uploads multipart with Bearer and without a JSON content type", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "photo" }), { status: 201 }));
  const file = new File(["test"], "test.png", { type: "image/png" });
  await uploadPhoto("memory", file);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.example.test/memories/memory/photos");
  expect(options?.body).toBeInstanceOf(FormData);
  const body = options?.body;
  if (!(body instanceof FormData)) throw new Error("Expected multipart body");
  expect(body.get("file")).toBe(file);
  const headers = new Headers(options?.headers);
  expect(headers.get("Authorization")).toBe("Bearer synthetic-session");
  expect(headers.has("Content-Type")).toBe(false);
});

it("reads every photo page and uses the memory ID when deleting", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "one" }], total: 2, limit: 1 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "two" }], total: 2, limit: 1 })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  expect(await listPhotos("memory")).toHaveLength(2);
  expect(String(fetchMock.mock.calls[1][0])).toContain("offset=1");
  await deletePhoto({ memory_id: "memory", id: "one" } as MemoryPhoto);
  expect(fetchMock.mock.calls[2][0]).toBe("https://api.example.test/memories/memory/photos/one");
  expect(fetchMock.mock.calls[2][1]?.method).toBe("DELETE");
});

it("keeps uniform errors and clears the session on a photo 401", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: { code: "unauthorized", message: "Inicia sesión." } }), { status: 401 }));
  await expect(listPhotos("memory")).rejects.toMatchObject({ code: "unauthorized", message: "Inicia sesión." });
  expect(localStorage.getItem("ayni_token")).toBeNull();
});

it("rejects unsupported files before requesting the API", () => {
  expect(() => uploadPhoto("memory", new File(["x"], "a.svg", { type: "image/svg+xml" }))).toThrow("Usa fotos");
  expect(fetchMock).not.toHaveBeenCalled();
});
