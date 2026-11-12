import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateSession, getRecordedReaction, getSession, listSessions, recordReaction } from "./sessions";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  localStorage.setItem("ayni_token", crypto.randomUUID());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });

it("generates and recovers guides with Bearer without sending ownership IDs", async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: "saved-guide" })));
  await generateSession(); await listSessions(20, 40); await getSession("saved-guide");
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "https://api.example.test/sessions/generate", "https://api.example.test/sessions?limit=20&offset=40",
    "https://api.example.test/sessions/saved-guide",
  ]);
  const options = fetchMock.mock.calls[0][1]!;
  expect(options.method).toBe("POST"); expect(options.body).toBe("{}");
  expect(new Headers(options.headers).get("Authorization")).toMatch(/^Bearer /);
});

it("records exactly one reaction and recovers its server representation", async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ reaction: "agitado" })));
  await recordReaction("guide", "agitado");
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/sessions/guide/response");
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body))).toEqual({ reaction: "agitado" });
  expect(await getRecordedReaction("guide")).toEqual({ reaction: "agitado" });
});

it("treats only response_not_found as no reaction and preserves other errors", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: { code: "response_not_found", message: "Todavía no tiene reacción." } }), { status: 404 }));
  expect(await getRecordedReaction("guide")).toBeNull();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: { code: "session_not_found", message: "No encontramos la guía." } }), { status: 404 }));
  await expect(getRecordedReaction("foreign")).rejects.toMatchObject({ code: "session_not_found" });
});

it("clears the session when recording receives HTTP 401", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: { code: "unauthorized", message: "Vuelve a iniciar sesión." } }), { status: 401 }));
  await expect(recordReaction("guide", "receptivo")).rejects.toMatchObject({ status: 401 });
  expect(localStorage.getItem("ayni_token")).toBeNull();
});
