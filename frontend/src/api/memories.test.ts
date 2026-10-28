import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMemory, deleteMemory, getMemory, listMemories, normalizeSongUrl, updateMemory } from "./memories";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  vi.stubGlobal("fetch", fetchMock.mockReset().mockResolvedValue(new Response("{}")));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("creates anecdotes with exact fields and Bearer authentication", async () => {
  const token = crypto.randomUUID();
  localStorage.setItem("ayni_token", token);
  await createMemory({ type: "anecdote", title: " Paseo ", text: " Un paseo. ", is_positive: true, is_sensitive: false });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.example.test/memories");
  expect(options?.method).toBe("POST");
  expect(new Headers(options?.headers).get("Authorization")).toBe(`Bearer ${token}`);
  expect(JSON.parse(options?.body as string)).toEqual({
    type: "anecdote", title: "Paseo", text: "Un paseo.", is_positive: true, is_sensitive: false,
  });
});

it("creates songs with canonical track URLs", async () => {
  await createMemory({ type: "song", title: "Canción", url: "https://open.spotify.com/intl-es/track/1234567890123456789012?si=tracking" });
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
    type: "song", title: "Canción", url: "https://open.spotify.com/track/1234567890123456789012", is_positive: false, is_sensitive: false,
  });
});

it.each([
  "https://open.spotify.com/playlist/1234567890123456789012",
  "https://youtube.com/playlist?list=abcdefghijk",
  "https://youtube.com.example.com/watch?v=abcdefghijk",
  "http://youtu.be/abcdefghijk",
])("rejects invalid song resources before sending: %s", (url) => {
  expect(() => createMemory({ type: "song", title: "Canción", url })).toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("validates title and anecdote boundaries before sending", () => {
  for (const fields of [{ title: "", text: "Texto" }, { title: "x".repeat(101), text: "Texto" }, { title: "Paseo", text: "x".repeat(5001) }]) {
    expect(() => createMemory({ type: "anecdote", ...fields })).toThrow();
  }
  expect(fetchMock).not.toHaveBeenCalled();
  expect(normalizeSongUrl("https://youtu.be/abcdefghijk?si=tracking")).toBe("https://www.youtube.com/watch?v=abcdefghijk");
});

it("uses real list, detail, patch and delete endpoints", async () => {
  const id = crypto.randomUUID();
  fetchMock.mockImplementation(async () => new Response("{}"));
  await listMemories({ include_sensitive: false, limit: 20, offset: 0 });
  await getMemory(id);
  await updateMemory(id, { title: "Paseo", is_positive: true });
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(deleteMemory(id)).resolves.toBeUndefined();
  expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
    "https://api.example.test/memories?include_sensitive=false&limit=20&offset=0",
    ...Array(3).fill(`https://api.example.test/memories/${id}`),
  ]);
  expect(fetchMock.mock.calls.map(([, options]) => options?.method ?? "GET")).toEqual(["GET", "GET", "PATCH", "DELETE"]);
});
