import { useEffect, useRef, useState } from "react";
import { createGoogleChallenge, getGoogleConfig } from "../api/account";
import type { GoogleProof } from "../api/account";

interface GoogleIdentityClient {
  initialize: (options: { client_id: string; nonce: string; callback: (result: { credential: string }) => void }) => void;
  renderButton: (element: HTMLElement, options: { type: string; theme: string; size: string; text: string; locale: string; width: number }) => void;
}
type GoogleWindow = Window & { google?: { accounts: { id: GoogleIdentityClient } } };
let scriptLoad: Promise<GoogleIdentityClient> | undefined;

function loadGoogle(): Promise<GoogleIdentityClient> {
  const ready = (window as GoogleWindow).google?.accounts.id;
  if (ready) return Promise.resolve(ready);
  if (!scriptLoad) scriptLoad = new Promise<GoogleIdentityClient>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const client = (window as GoogleWindow).google?.accounts.id;
      if (client) resolve(client); else { scriptLoad = undefined; script.remove(); reject(new Error("Google no está disponible.")); }
    };
    script.onerror = () => { scriptLoad = undefined; script.remove(); reject(new Error("Google no está disponible.")); };
    document.head.appendChild(script);
  });
  return scriptLoad;
}

export function GoogleSignInButton({ disabled = false, onCredential }: { disabled?: boolean; onCredential: (proof: GoogleProof) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [state, setState] = useState<"loading" | "disabled" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { callback.current = onCredential; }, [onCredential]);
  useEffect(() => {
    if (disabled) return;
    let active = true;
    const node = container.current;
    setState("loading");
    async function initialize() {
      try {
        const config = await getGoogleConfig();
        if (!active) return;
        if (!config.enabled || !config.client_id) { setState("disabled"); return; }
        const challenge = await createGoogleChallenge();
        const client = await loadGoogle();
        if (!active || !node) return;
        client.initialize({ client_id: config.client_id, nonce: challenge.nonce,
          callback: (result) => { if (active && result.credential) callback.current({ credential: result.credential, challenge_id: challenge.challenge_id }); },
        });
        client.renderButton(node, { type: "standard", theme: "outline", size: "large", text: "continue_with", locale: "es", width: Math.min(node.clientWidth || 400, 400) });
        setState("ready");
      } catch { if (active) setState("error"); }
    }
    void initialize();
    return () => { active = false; node?.replaceChildren(); };
  }, [disabled, attempt]);

  return <div className="space-y-2">
    <div ref={container} aria-label="Acceso con Google" aria-disabled={disabled} className={disabled ? "pointer-events-none opacity-50" : "min-h-0"} />
    {(disabled || state !== "ready") && <button type="button" disabled className="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-500 disabled:cursor-not-allowed"><span aria-hidden="true" className="text-base font-bold">G</span>{state === "loading" && !disabled ? "Cargando Google…" : "Continuar con Google · Próximamente"}</button>}
    {state === "error" && <p className="text-xs text-slate-500">No pudimos cargar Google. Puedes usar tu correo y contraseña. <button type="button" disabled={disabled} onClick={() => setAttempt((value) => value + 1)} className="font-semibold underline">Volver a intentar Google</button></p>}
  </div>;
}
