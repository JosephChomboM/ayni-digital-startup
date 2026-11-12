import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { createVoiceActivity } from "./voiceActivity";
import { ApiError } from "../api/client";

const LIMIT_MS = 30_000;
const SAMPLE_RATE = 16_000;
const formats = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];

export type DictationState = "idle" | "permission" | "listening" | "recording" | "loading" | "transcribing";

interface Capture {
  stream?: MediaStream;
  recorder?: MediaRecorder;
  timer?: number;
  meter?: number;
  audio?: AudioContext;
  transcription?: AbortController;
  speechOffset?: number;
  lastSpeechOffset?: number;
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
  capture.transcription?.abort();
  window.clearTimeout(capture.timer);
  window.clearInterval(capture.meter);
  void capture.audio?.close().catch(() => undefined);
  if (capture.recorder && capture.recorder.state !== "inactive") {
    capture.recorder.onstop = null;
    capture.recorder.stop();
  }
  capture.stream?.getTracks().forEach((track) => track.stop());
}

export function useSessionDictation(onTranscript: (text: string) => void, enabled: boolean,
  cloud?: (recording: Blob, signal: AbortSignal) => Promise<string>) {
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = useRef<Capture | null>(null);
  const worker = useRef<Worker | null>(null);
  const callback = useRef(onTranscript);
  const cloudCallback = useRef(cloud);
  const timeout = useRef<number | undefined>(undefined);

  useEffect(() => { callback.current = onTranscript; }, [onTranscript]);
  useEffect(() => { cloudCallback.current = cloud; }, [cloud]);

  const discard = useCallback(() => {
    const capture = active.current;
    active.current = null;
    release(capture);

    window.clearTimeout(timeout.current);
  }, []);

  const cancel = useCallback(() => {
    if (active.current?.recorder?.state === "inactive") {
      worker.current?.terminate();
      worker.current = null;
    }
    discard();
    setState("idle");
  }, [discard]);

  useEffect(() => {
    function hide() { if (document.hidden) cancel(); }
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      discard();
      worker.current?.terminate();
      worker.current = null;
    };
  }, [cancel, discard]);

  function stop() {
    const capture = active.current;
    if (capture?.recorder?.state !== "recording") return;
    window.clearTimeout(capture.timer);
    window.clearInterval(capture.meter);
    capture.recorder.stop();
    capture.stream?.getTracks().forEach((track) => track.stop());
    setState("transcribing");
  }

  function fail(message: string) {
    worker.current?.terminate();
    worker.current = null;
    cancel();
    setError(message);
  }

  function askToRepeat() {
    discard();
    setState("idle");
    setNotice("No te entendí bien. ¿Puedes repetirlo un poco más cerca del micrófono?");
  }

  async function start() {
    if (active.current || state !== "idle" || document.hidden) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador no ofrece acceso al micrófono. Puedes escribir tu respuesta.");
      return;
    }
    const capture: Capture = {};
    active.current = capture;
    setState("permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (active.current !== capture) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      capture.stream = stream;
      const audio = new AudioContext();
      capture.audio = audio;
      await audio.resume();
      if (active.current !== capture) return;
      const analyser = audio.createAnalyser();
      audio.createMediaStreamSource(stream).connect(analyser);
      const waveform = new Float32Array(analyser.fftSize);
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
          const recording = new Blob(chunks, { type: recorder.mimeType });
          const decoded = await monoSamples(recording);
          // Preserve consonants on either side while removing long waits before
          // the first word and after the last one from local transcription.
          const firstSample = Math.floor(Math.max(0, (capture.speechOffset ?? 0) - 600) * SAMPLE_RATE / 1000);
          const lastSample = capture.lastSpeechOffset === undefined ? decoded.length :
            Math.ceil((capture.lastSpeechOffset + 700) * SAMPLE_RATE / 1000);
          const samples = decoded.subarray(firstSample, lastSample).slice();
          if (active.current !== capture) return;
          const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
          if (samples.length < SAMPLE_RATE * 0.4 || rms < 0.0015) {
            askToRepeat();
            return;
          }

          if (cloudCallback.current) {
            capture.transcription = new AbortController();
            const signal = AbortSignal.any([capture.transcription.signal, AbortSignal.timeout(8_000)]);
            try {
              const text = await cloudCallback.current(recording, signal);
              if (active.current !== capture) return;
              if (!text.trim()) { askToRepeat(); return; }
              discard();
              setState("idle");
              setNotice("");
              callback.current(text);
              return;
            } catch (cause) {
              if (active.current !== capture) return;
              if (cause instanceof ApiError && cause.code === "audio_not_understood") {
                askToRepeat();
                return;
              }
              // The local recognizer can still use this recording if the
              // network or enhanced dictation service is unavailable.
            }
          }
          const gain = Math.min(8, 0.08 / Math.max(rms, 0.0015));
          if (gain > 1) for (let index = 0; index < samples.length; index++) samples[index] = Math.max(-1, Math.min(1, samples[index] * gain));

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
              if (data.text) { setNotice(""); callback.current(data.text); }
              else askToRepeat();
            }
          };
          timeout.current = window.setTimeout(failure, 120_000);
          transcriber.postMessage({ samples }, [samples.buffer]);
        } catch {
          if (active.current === capture) fail("No pude leer la grabación. Puedes escribir tu respuesta.");
        }
      };
      recorder.start(250);
      const detectVoice = createVoiceActivity();
      let idleSince = performance.now();
      capture.meter = window.setInterval(() => {
        if (recorder.state !== "recording") return;
        analyser.getFloatTimeDomainData(waveform);
        const rms = Math.sqrt(waveform.reduce((sum, sample) => sum + sample * sample, 0) / waveform.length);
        const now = performance.now();
        const voice = detectVoice(rms, now);
        if (voice.started) capture.speechOffset = now - idleSince;
        if (voice.lastSpeech !== null) capture.lastSpeechOffset = voice.lastSpeech - idleSince;
        if (voice.started) { setState("recording"); capture.timer = window.setTimeout(stop, LIMIT_MS); }
        if (voice.ended) stop();
        if (!voice.active) {
          // Reset silent recordings periodically to bound memory. Each blob
          // submitted to Whisper starts with a complete container header.
          if (now - idleSince > 7000) {
            const onstop = recorder.onstop;
            recorder.onstop = () => {
              if (active.current !== capture) return;
              chunks.length = 0;
              recorder.onstop = onstop;
              recorder.start(250);
              idleSince = performance.now();
            };
            recorder.stop();
          }
        }
      }, 50);
      setState("listening");
    } catch (reason) {
      if (active.current !== capture) return;
      fail(reason instanceof DOMException && reason.name === "NotAllowedError"
        ? "El micrófono está bloqueado. Puedes permitirlo en el navegador o escribir."
        : "No pude abrir el micrófono. Comprueba que esté conectado o escribe tu respuesta.");
    }
  }

  const openMic = useEffectEvent(start);
  const [visible, setVisible] = useState(!document.hidden);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!enabled || !visible) {
      cancel();
      return;
    }
    if (state !== "idle" || error) return;
    // Keep Ayni's last syllable out of the next recording.
    const delay = window.setTimeout(openMic, 750);
    return () => window.clearTimeout(delay);
  }, [enabled, visible, state, error, cancel]);

  return { state, error, notice, cancel, finish: stop, retry: () => setError("") };
}
