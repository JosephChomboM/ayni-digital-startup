import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateSession, getSession, listSessions } from "./sessions";
import { SESSION_EXPIRED_EVENT } from "./client";
beforeEach(() => { vi.stubEnv("VITE_API_URL", "http://localhost:8001"); localStorage.setItem("ayni_token", "token-de-prueba"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("envía una generación autenticada sin permitir seleccionar familia ni autor", async () => {
 const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "persisted" }), { status: 201 }));
 vi.stubGlobal("fetch", fetcher);
 expect(await generateSession()).toEqual({ id: "persisted" });
 expect(fetcher).toHaveBeenCalledWith("http://localhost:8001/sessions/generate", expect.objectContaining({ method: "POST", body: "{}", headers: expect.objectContaining({ Authorization: "Bearer token-de-prueba" }) }));
});
it("consulta el historial paginado y el detalle sin generar otra guía", async () => {
 const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}")));
 vi.stubGlobal("fetch", fetcher);
 await listSessions(10);
 await getSession("id/con espacio");
 expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["http://localhost:8001/sessions?limit=10&offset=10", "http://localhost:8001/sessions/id%2Fcon%20espacio"]);
 expect(fetcher.mock.calls.every(([, options]) => options.method === undefined)).toBe(true);
});
it("propaga el límite del servidor y una sesión vencida mediante el cliente común", async () => {
 const listener = vi.fn();
 window.addEventListener(SESSION_EXPIRED_EVENT, listener);
 try {
  vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ detail: { code: "session_limit_reached", message: "Límite alcanzado" } }), { status: 409 }))).mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ detail: { code: "unauthorized", message: "Inicia sesión" } }), { status: 401 }))));
  await expect(generateSession()).rejects.toMatchObject({ code: "session_limit_reached", status: 409 });
  await expect(listSessions()).rejects.toMatchObject({ code: "unauthorized", status: 401 });
  expect(localStorage.getItem("ayni_token")).toBeNull();
  expect(listener).toHaveBeenCalledTimes(1);
 } finally { window.removeEventListener(SESSION_EXPIRED_EVENT, listener); }
});
