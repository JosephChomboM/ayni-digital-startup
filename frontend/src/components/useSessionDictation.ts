import { useCallback, useEffect, useRef, useState } from "react";

const LIMIT_MS = 18_000;
const SAMPLE_RATE = 16_000;
const formats = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];

export type DictationState = "idle" | "permission" | "recording" | "loading" | "transcribing";

interface Capture {
  stream?: MediaStream;
  recorder?: MediaRecorder;
  timer?: number;
}

async function monoSamples(recording: Blob) {
  const audio = new AudioContext();
  try {
    const decoded = await audio.decodeAudioData(await recording.arrayBuffer());
    const render = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE)), SAMPLE_RATE);
    const source = render.createBufferSource();
    source.buffer = decoded;
    source.connect(render.destination);
    source.start();
    const buffer = await render.startRendering();
    return buffer.getChannelData(0);
  } finally {
    await audio.close();
  }
}

function release(capture: Capture | null) {
  if (!capture) return;
  window.clearTimeout(capture.timer);
  if (capture.recorder && capture.recorder.state !== "inactive") {
    capture.recorder.onstop = null;
    capture.recorder.stop();
  }
  capture.stream?.getTracks().forEach((track) => track.stop());
}

export function useSessionDictation(onTranscript: (text: string) => void) {
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState("");
  const active = useRef<Capture | null>(null);
  const worker = useRef<Worker | null>(null);
  const callback = useRef(onTranscript);
  const timeout = useRef<number | undefined>(undefined);

  useEffect(() => { callback.current = onTranscript; }, [onTranscript]);

  const reset = useCallback(() => {
    const capture = active.current;
    active.current = null;
    release(capture);
    worker.current?.terminate();
    worker.current = null;
    window.clearTimeout(timeout.current);
  }, []);

  const cancel = useCallback(() => {
    reset();
    setState("idle");
  }, [reset]);

  useEffect(() => {
    function hide() { if (document.hidden) cancel(); }
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      reset();
    };
  }, [cancel, reset]);

  function stop() {
    const capture = active.current;
    if (capture?.recorder?.state !== "recording") return;
    window.clearTimeout(capture.timer);
    capture.recorder.stop();
    capture.stream?.getTracks().forEach((track) => track.stop());
    setState("transcribing");
  }

  function fail(message: string) {
    cancel();
    setError(message);
  }

  async function start() {
    if (active.current || state !== "idle") return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador no ofrece acceso al micrófono. Puedes escribir tu respuesta.");
      return;
    }
    const capture: Capture = {};
    active.current = capture;
    setState("permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (active.current !== capture) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      capture.stream = stream;
      const mimeType = formats.find((format) => MediaRecorder.isTypeSupported(format));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      capture.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      recorder.onerror = () => {
        if (active.current === capture) fail("El micrófono se interrumpió. Puedes volver a intentarlo o escribir.");
      };
      recorder.onstop = async () => {
        if (active.current !== capture) return;
        try {
          const samples = await monoSamples(new Blob(chunks, { type: recorder.mimeType }));
          if (active.current !== capture) return;
          const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
          if (samples.length < SAMPLE_RATE * 0.4 || rms < 0.004) {
            fail("No escuché una respuesta. Acércate al micrófono o escribe lo que querías decir.");
            return;
          }

          worker.current ??= new Worker(new URL("../workers/sessionSpeech.ts", import.meta.url), { type: "module" });
          const transcriber = worker.current;
          const failure = () => fail("No pude preparar la voz en este dispositivo. Puedes escribir o volver a intentarlo.");
          transcriber.onerror = failure;
          transcriber.onmessage = ({ data }: MessageEvent<{ kind: string; text?: string }>) => {
            if (active.current !== capture) return;
            if (data.kind === "loading") setState("loading");
            if (data.kind === "transcribing") setState("transcribing");
            if (data.kind === "error") failure();
            if (data.kind === "result") {
              window.clearTimeout(timeout.current);
              active.current = null;
              release(capture);
              setState("idle");
              if (data.text) callback.current(data.text);
              else setError("No pude entenderte. Puedes intentarlo otra vez o escribir.");
            }
          };
          timeout.current = window.setTimeout(failure, 120_000);
          transcriber.postMessage({ samples }, [samples.buffer]);
        } catch {
          if (active.current === capture) fail("No pude leer la grabación. Puedes escribir tu respuesta.");
        }
      };
      recorder.start();
      capture.timer = window.setTimeout(stop, LIMIT_MS);
      setState("recording");
    } catch (reason) {
      if (active.current !== capture) return;
      fail(reason instanceof DOMException && reason.name === "NotAllowedError"
        ? "El micrófono está bloqueado. Puedes permitirlo en el navegador o escribir."
        : "No pude abrir el micrófono. Comprueba que esté conectado o escribe tu respuesta.");
    }
  }

  return { state, error, start, stop, cancel };
}
