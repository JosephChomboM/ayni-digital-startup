import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createGoogleChallenge, deleteMyAccount, getGoogleConfig, linkGoogle, loginWithGoogle, registerWithGoogle, updateMyProfile } from "./account";

const fetchMock = vi.fn<typeof fetch>();
const user = { id: crypto.randomUUID(), email: "persona@example.com", name: "Persona de prueba", role: "familiar", family_id: crypto.randomUUID(), created_at: "2026-11-11T12:00:00Z", phone: null, city: null, district: null };
const proof = { credential: crypto.randomUUID(), challenge_id: crypto.randomUUID() };
beforeEach(() => { vi.stubEnv("VITE_API_URL", "https://api.example.test"); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });

it("loads public Google configuration and a nonce without storing credentials", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ enabled: false, client_id: null })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ challenge_id: proof.challenge_id, nonce: crypto.randomUUID(), expires_at: "2026-11-11T12:05:00Z" }), { status: 201 }));
  expect(await getGoogleConfig()).toEqual({ enabled: false, client_id: null });
  expect((await createGoogleChallenge()).challenge_id).toBe(proof.challenge_id);
  expect(fetchMock.mock.calls[1][1]?.method).toBe("POST"); expect(localStorage.length).toBe(0);
});

it("exchanges Google proof for an Ayni token and verifies the session with users/me", async () => {
  const token = crypto.randomUUID();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ user, access_token: token, token_type: "bearer", expires_in: 1800 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ user, consent: { text_version: "1.0", accepted_at: user.created_at } })));
  expect((await loginWithGoogle(proof)).user).toEqual(user);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["https://api.example.test/auth/google/login", "https://api.example.test/users/me"]);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(proof);
  expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("Authorization")).toBe(`Bearer ${token}`);
  expect(localStorage.getItem("ayni_token")).toBe(token);
});

it("registers with Google consent and family mode without assuming a returned token", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ user, family: { id: user.family_id }, consent: {} }), { status: 201 }));
  await registerWithGoogle({ ...proof, name: user.name, password: crypto.randomUUID(), family_name: "Familia de prueba", consent: { accepted: true, text_version: "1.0" } });
  const data = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(data.consent).toEqual({ accepted: true, text_version: "1.0" });
  expect(data.family_name).toBe("Familia de prueba"); expect(data).not.toHaveProperty("email");
  expect(localStorage.getItem("ayni_token")).toBeNull();
});

it("links Google only using the existing Bearer session and a password", async () => {
  const token = crypto.randomUUID(); localStorage.setItem("ayni_token", token);
  const password = crypto.randomUUID();
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await linkGoogle(proof, password);
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/auth/google/link");
  expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization")).toBe(`Bearer ${token}`);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ ...proof, password });
});

it("persists profile changes with PATCH and accepts nullable contact fields", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ user, consent: {} })));
  const result = await updateMyProfile({ phone: null, city: "Lima", district: null });
  expect(result.user.phone).toBeNull();
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/users/me");
  expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH");
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ phone: null, city: "Lima", district: null });
});

it("retains the token after failed deletion and clears it only after confirmed success", async () => {
  const token = crypto.randomUUID(); localStorage.setItem("ayni_token", token);
  const password = crypto.randomUUID();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: { code: "photo_storage_unavailable", message: "Vuelve a intentar el borrado." } }), { status: 503 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(deleteMyAccount(password, "ELIMINAR")).rejects.toMatchObject({ code: "photo_storage_unavailable" });
  expect(localStorage.getItem("ayni_token")).toBe(token);
  await deleteMyAccount(password, "ELIMINAR");
  expect(localStorage.getItem("ayni_token")).toBeNull();
  expect(fetchMock.mock.calls[1][1]?.method).toBe("DELETE");
});

it("rejects weak passwords or missing confirmation before sending deletion", async () => {
  await expect(deleteMyAccount("short", "ELIMINAR")).rejects.toMatchObject({ code: "validation_error" });
  await expect(deleteMyAccount(crypto.randomUUID(), "NO")).rejects.toMatchObject({ code: "validation_error" });
  expect(fetchMock).not.toHaveBeenCalled();
});
