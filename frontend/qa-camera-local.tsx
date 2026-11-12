import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { SessionCamera } from "./src/components/SessionCamera";
import { listSessions, sendMessage, imageForConversation } from "./src/api/sessions";
import "./src/index.css";

// Prueba temporal: la cámara recibe una foto ilustrativa, nunca video personal.
const image = new Image();
image.src = "/images/recuerdos.jpg";
await image.decode();
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 400;
const paint = () => canvas.getContext("2d")!.drawImage(image, 280, 75, 160, 200, 0, 0, 320, 400);
paint();
const timer = setInterval(paint, 150);
Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
  getUserMedia: async () => canvas.captureStream(10),
} });
window.addEventListener("pagehide", () => clearInterval(timer));

function TestCamera() {
  const [result, setResult] = useState("Esperando captura explícita de prueba.");
  const [busy, setBusy] = useState(false);
  return <main className="mx-auto max-w-lg space-y-4 p-6">
    <h1 className="text-xl font-bold">Prueba de cámara e IA con imagen ficticia</h1>
    <p>No usa una cámara física: simula video con una foto ilustrativa del proyecto.</p>
    <button className="min-h-11 rounded border px-3" disabled={busy} onClick={async () => {
      setBusy(true); setResult("Analizando foto ilustrativa con Groq…");
      try {
        const photo = await (await fetch("/images/recuerdos.jpg")).blob();
        const page = await listSessions();
        const answer = await sendMessage(page.items[0].id, { text: "Exploremos esta foto de ejemplo.", image: await imageForConversation(photo), image_consent: true, request_id: crypto.randomUUID() }, new AbortController().signal);
        setResult(JSON.stringify(answer, null, 2));
      } catch (cause) { setResult(cause instanceof Error ? cause.message : "Error de prueba"); }
      finally { setBusy(false); }
    }}>Analizar foto ilustrativa con IA</button>
    <SessionCamera onCue={() => undefined} canFollowExpression={() => false} analyzing={busy} onAnalyzeFrame={async (frame) => {
      setBusy(true); setResult("Consultando Groq con una captura…");
      try {
        const page = await listSessions();
        const answer = await sendMessage(page.items[0].id, { text: "Miremos esta captura. Describe un detalle visible sin identificar a nadie.", image: frame, image_consent: true, request_id: crypto.randomUUID() }, new AbortController().signal);
        setResult(JSON.stringify(answer, null, 2));
      } catch (cause) { setResult(cause instanceof Error ? cause.message : "Error de prueba"); }
      finally { setBusy(false); }
    }} />
    <pre role="status" className="whitespace-pre-wrap break-words">{result}</pre>
  </main>;
}
createRoot(document.getElementById("root")!).render(<TestCamera />);
