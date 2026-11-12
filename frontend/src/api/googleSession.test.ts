import { expect, it, vi } from "vitest";
import { apiFetch, SESSION_EXPIRED_EVENT } from "./client";
it("conserva el formulario de Google ante credenciales rechazadas sin una sesión previa", async () => {
 vi.stubEnv("VITE_API_URL", "http://localhost:8000"); localStorage.removeItem("ayni_token");
 const expired=vi.fn(); window.addEventListener(SESSION_EXPIRED_EVENT,expired);
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({status:401,ok:false,json:async()=>({detail:{code:"invalid_google_credential",message:"Vuelve a verificar tu cuenta"}})}));
 try { await expect(apiFetch("/auth/google/login",{method:"POST"})).rejects.toMatchObject({code:"invalid_google_credential"}); expect(expired).not.toHaveBeenCalled(); }
 finally {window.removeEventListener(SESSION_EXPIRED_EVENT,expired);vi.unstubAllGlobals();vi.unstubAllEnvs();}
});
