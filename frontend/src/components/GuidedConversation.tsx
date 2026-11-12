import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AudioLines, Bot, Camera, Mic, MicOff, Pause, Play, Send, Square, VideoOff, Volume2, VolumeX } from "lucide-react";
import { ApiError } from "../api/client";
import { getMessages, sendMessage, imageForConversation, clearScene, transcribeAudio } from "../api/sessions";
import type { ChatInput } from "../api/sessions";
import { SessionCamera } from "./SessionCamera";
import { interpretReply, preferredVoiceURI, requestsVisualContext, saveVoicePreference, spanishVoiceLabel, spanishVoices, speakLocally } from "./sessionSignals";
import type { FaceCue, SessionActivity } from "./sessionSignals";
import { useSessionDictation } from "./useSessionDictation";
import { Button } from "./ui/button";

export const SESSION_GREETING = "Hola, soy Ayni. Qué gusto acompañarte. ¿Qué recuerdo te gustaría compartir hoy?";

interface GuidedConversationProps {
  sessionId: string;
  activeMemoryId?: string;
  memoryOptions?: { id: string; title: string }[];
  onSelectMemory?: (id: string) => void;
  photo?: Blob;
  withDevices: boolean;
  title: string;
  elapsed: string;
  paused: boolean;
  activity: ReactNode;
  onPause: (message: string) => void;
  onResume: () => void;
  onNextActivity: (preferred?: SessionActivity) => string;
  onFinish: (speak: boolean) => void;
}

export function GuidedConversation({
  sessionId, activeMemoryId, memoryOptions, onSelectMemory, photo, withDevices, title, elapsed, paused, activity, onPause, onResume, onNextActivity, onFinish,
}: GuidedConversationProps) {
  const [liveScene, setLiveScene] = useState(withDevices);
  const cameraCapture = useRef<(() => Promise<string>) | null>(null);
  const [sceneNotice, setSceneNotice] = useState("");
  const [cloudVoice, setCloudVoice] = useState(false);
  const [reviewVoice, setReviewVoice] = useState(false);
  const [voices, setVoices] = useState(() => spanishVoices(window.speechSynthesis?.getVoices() ?? []));
  const [voiceURI, setVoiceURI] = useState(preferredVoiceURI);
  const [failedTurns, setFailedTurns] = useState(0);
  const [line, setLine] = useState(SESSION_GREETING);
  const [messages, setMessages] = useState<{ id: number; from: "ayni" | "you"; text: string }[]>([]);
  const nextMessage = useRef(0);
  const transcript = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const append = (from: "ayni" | "you", text: string) => {
    const id = nextMessage.current++;
    setMessages((items) => [...items.slice(-49), { id, from, text }]);
  };
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [sound, setSound] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [camera, setCamera] = useState(withDevices);
  const [mic, setMic] = useState(withDevices);
  const [visible, setVisible] = useState(!document.hidden);
  const [voiceNotice, setVoiceNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const [aiError, setAiError] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [suggestion, setSuggestion] = useState("continue");
  const [observations, setObservations] = useState<string[]>([]);
  const lastAttempt = useRef<ChatInput | null>(null);
  const greetingId = useRef(crypto.randomUUID());
  const lastTurnAt = useRef(0);
  const lastExpressionAt = useRef(-Infinity);
  const waitingForVoice = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  function speak(text: string) {
    if (!sound || document.hidden) return;
    if (!speakLocally(text, setSpeaking, voiceURI)) {
      setSpeaking(false);
      waitingForVoice.current = text;
      setVoiceNotice("Puedes leer mis mensajes aquí. Este dispositivo no tiene una voz local en español.");
    } else {
      setSpeaking(true);
      waitingForVoice.current = null;
      setVoiceNotice("");
    }
  }

  function show(text: string) {
    lastTurnAt.current = performance.now();
    setLine(text);
    append("ayni", text);
    speak(text);
  }

  function cancelTurn() {
    request.current?.abort();
    request.current = null;
    setPending(false);
  }

  async function follow(text: string, image?: string, cue?: "smile" | "brow", retry?: ChatInput) {
    if (paused || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setAiError("");
    setRecovering(false);
    lastAttempt.current = retry ?? { text, request_id: crypto.randomUUID(), use_scene: false, ...(activeMemoryId ? { active_memory_id: activeMemoryId } : {}), ...(image ? { image, image_consent: true } : {}), ...(cue ? { cue } : {}) };
    try {
      if (!retry?.image && !image && !cue && requestsVisualContext(text)) {
        if (camera && liveScene && cameraCapture.current) {
          try { image = await cameraCapture.current(); }
          catch { /* The camera may still be starting or may have lost access. */ }
          if (controller.signal.aborted) return;
        }
        if (!image) {
          lastAttempt.current = null;
          setObservations([]);
          setSuggestion("continue");
          show(camera && liveScene
            ? "La cámara todavía no me muestra la imagen. ¿Puedes enseñármela otra vez?"
            : "Si quieres que mire algo, activa la cámara y el contexto visual o usa Analizar foto con IA.");
          return;
        }
      }
      const payload: ChatInput = { ...lastAttempt.current, ...(image ? { image, image_consent: true } : {}) };
      lastAttempt.current = payload;
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]);
      const result = await sendMessage(sessionId, payload, signal);
      if (controller.signal.aborted) return;
      setFailedTurns(0);
      setSuggestion(result.suggestion);
      setObservations(image ? result.observations : []);
      show(result.text);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 429) {
        setAiError(cause.message);
        return;
      }
      const failures = failedTurns + 1;
      setFailedTurns(failures);
      setSuggestion("continue");
      setObservations([]);
      if (!cue) {
        show(image ? "No pude ver bien la imagen esta vez. ¿Qué querías mostrarme?" :
          text ? "Podemos seguir a tu ritmo. ¿Qué más te gustaría contar de ese momento?" : SESSION_GREETING);
      }
      if (failures >= 2 && !cue) {
        setRecovering(true);
        setAiError("La conexión con Ayni está intermitente. Puedes seguir conversando.");
      }
    } finally {
      if (request.current === controller) { request.current = null; setPending(false); }
    }
  }

  function receive(raw: string) {
    const reply = raw.trim().slice(0, 500);
    if (!reply || paused || request.current) return;
    append("you", reply);
    const intent = interpretReply(reply);
    if (intent === "end") finish();
    else if (intent === "pause") pause("Claro, hagamos una pausa. Pulsa Continuar cuando te apetezca.");
    else if (intent === "next") changeActivity();
    else if (intent === "photo" || intent === "song" || intent === "anecdote") changeActivity(intent);
    else void follow(reply);
  }

  const dictation = useSessionDictation(
    (reply) => {
      if (input.trim()) return;
      const intent = interpretReply(reply);
      if (!reviewVoice || intent === "pause" || intent === "end") receive(reply);
      else setInput(reply);
    },
    mic && !paused && !pending && !speaking && !input.trim(),
    cloudVoice ? (recording, signal) => transcribeAudio(sessionId, recording, signal) : undefined,
  );

  function pause(message: string) {
    cancelTurn();
    dictation.cancel();
    show(message);
    onPause(message);
  }

  function finish() {
    cancelTurn();
    dictation.cancel();
    onFinish(sound);
  }

  function changeActivity(preferred?: SessionActivity) {
    cancelTurn();
    dictation.cancel();
    show(onNextActivity(preferred));
  }

  function canFollowExpression() {
    const now = performance.now();
    return !aiError && !paused && !input.trim() && (dictation.state === "idle" || dictation.state === "listening") && !request.current && !window.speechSynthesis?.speaking &&
      now - lastTurnAt.current >= 5000 && now - lastExpressionAt.current >= 25_000;
  }

  function onCameraCue(cue: FaceCue) {
    // A glance away should never stop the session or switch off the preview.
    if (cue === "away" || liveScene) return;
    if (!canFollowExpression()) return;
    lastExpressionAt.current = performance.now();
    void follow("", undefined, cue);
  }

  async function loadConversation(isActive: () => boolean) {
    heading.current?.focus();
    try {
      const saved = await getMessages(sessionId);
      if (!isActive()) return;
      if (saved.length) {
        setMessages(saved.map((item, index) => ({ id: index, from: item.role === "assistant" ? "ayni" : "you", text: item.text })));
        nextMessage.current = saved.length;
        const last = saved.filter((item) => item.role === "assistant").at(-1);
        if (last) { setLine(last.text); setSuggestion(last.suggestion); }
      } else {
        await follow("", undefined, undefined, { text: "", request_id: greetingId.current });
      }
    } catch (cause) {
      if (!isActive()) return;
      if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) setAiError(cause.message);
      else show(SESSION_GREETING);
    }
  }
  const initialize = useEffectEvent(loadConversation);
  const refreshVoices = useEffectEvent(() => {
    setVoices(spanishVoices(window.speechSynthesis?.getVoices() ?? []));
    const text = waitingForVoice.current;
    if (!text || document.hidden || !speakLocally(text, setSpeaking, voiceURI)) return;
    setSpeaking(true);
    waitingForVoice.current = null;
    setVoiceNotice("");
  });

  useEffect(() => {
    function onVoicesChanged() { refreshVoices(); }
    function updateVisibility() {
      setVisible(!document.hidden);
      if (document.hidden) {
        window.speechSynthesis?.cancel();
        setSpeaking(false);
      }
    }
    document.addEventListener("visibilitychange", updateVisibility);
    window.speechSynthesis?.addEventListener("voiceschanged", onVoicesChanged);
    let active = true;
    void initialize(() => active);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", updateVisibility);
      request.current?.abort();
      request.current = null;
      waitingForVoice.current = null;
      window.speechSynthesis?.removeEventListener("voiceschanged", onVoicesChanged);
      window.speechSynthesis?.cancel();
    };
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || paused || pending) return;
    dictation.cancel();
    receive(input);
    setInput("");
  }

  function toggleSound() {
    if (sound) {
      waitingForVoice.current = null;
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      setSound(false);
    } else {
      setSound(true);
      if (speakLocally(line, setSpeaking, voiceURI)) { setSpeaking(true); setVoiceNotice(""); }
      else setVoiceNotice("Este dispositivo no tiene una voz local en español.");
    }
  }

  useEffect(() => {
    const view = transcript.current;
    followLatest.current = true;
    if (view) view.scrollTop = view.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    const view = transcript.current;
    if (!view || typeof ResizeObserver === "undefined") return;
    const resize = new ResizeObserver(() => {
      if (followLatest.current) view.scrollTop = view.scrollHeight;
    });
    resize.observe(view);
    return () => resize.disconnect();
  }, []);

  const status = paused ? "En pausa" : speaking ? "Ayni está hablando" : pending ? "Ayni está respondiendo" :
    dictation.error && mic ? "Puedes seguir por escrito" : ({
      idle: mic ? "Puedes hablar o escribir" : "Escribe para responder",
      permission: "Esperando permiso del micrófono…",
      listening: "Te escucho. Habla cuando quieras",
      recording: "Te estoy escuchando…",
      loading: "Preparando el dictado en español…",
      transcribing: "Pasando tu voz a texto…",
    })[dictation.state];

  return <section aria-label="Sesión con Ayni" className="overflow-hidden rounded-xl border border-[#cddbdc] bg-[#f4faf8]">
    <header className="flex flex-wrap items-center justify-between gap-3 bg-[#193745] px-4 py-4 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#e9c46a] text-[#193745]"><Bot aria-hidden="true" className="size-6" /></span>
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-xl font-bold leading-tight focus:outline-none">Conversación con Ayni</h2>
          <p className="mt-1 text-sm tabular-nums text-[#d2e8eb]">{elapsed} · Sesión {paused ? "en pausa" : "en curso"}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" title={sound ? "Silenciar a Ayni" : "Activar voz"} aria-label={sound ? "Silenciar a Ayni" : "Activar voz"}
          className="grid size-11 place-items-center rounded-md text-white hover:bg-white/15" onClick={toggleSound}>
          {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold hover:bg-white/15" onClick={() => {
          if (paused) { onResume(); show("Seguimos a tu ritmo. ¿Qué te gustaría contar ahora?"); }
          else pause("Hagamos una pausa. Seguimos cuando quieras.");
        }}>{paused ? <Play className="size-4" /> : <Pause className="size-4" />}{paused ? "Continuar" : "Pausar"}</button>
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold hover:bg-white/15" onClick={finish}><Square className="size-4" />Terminar</button>
      </div>
    </header>

    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(13rem,16rem)]">
      <aside className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-start gap-x-4 border-b border-[#cddbdc] px-4 py-3 md:col-start-2 md:row-span-2 md:row-start-1 md:block md:border-b-0 md:border-l md:px-5 md:py-5" aria-label="Cámara y recuerdo">
        {Boolean(memoryOptions?.length) && <label className="col-span-2 mb-3 block text-sm font-semibold">Recuerdo activo
          <select aria-label="Recuerdo activo" value={activeMemoryId ?? ""} disabled={paused || pending} className="mt-1 w-full rounded border bg-white p-2 font-normal" onChange={(event) => { dictation.cancel(); onSelectMemory?.(event.target.value); }}>
            {!activeMemoryId && <option value="">Fotos de la sesión</option>}
            {memoryOptions?.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select>
        </label>}
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-bold text-[#264653]">Tu cámara</h3>
            <button type="button" aria-label={camera ? "Apagar cámara" : "Activar cámara"} title={camera ? "Apagar cámara" : "Activar cámara"}
              className="grid size-11 shrink-0 place-items-center rounded-md border border-[#cddbdc] bg-white text-[#264653] hover:bg-[#e8f5e9]" disabled={paused}
              onClick={() => setCamera(!camera)}>{camera ? <VideoOff className="size-5" /> : <Camera className="size-5" />}</button>
          </div>
          {camera && !paused && visible ? <SessionCamera captureRef={cameraCapture} onCue={onCameraCue} canFollowExpression={canFollowExpression} analyzing={pending} onAnalyzeFrame={(image) => void follow("Conversemos sobre un detalle visible de esta captura.", image)}
            live={false} /> :
            <p className="text-sm leading-snug text-[#435d60]">{paused ? "Cámara en pausa." : "Cámara apagada."}</p>}
        </div>
        <label className="mt-3 flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" checked={liveScene} disabled={!camera || paused} onChange={(event) => {
            const enabled = event.target.checked; setLiveScene(enabled);
            if (!enabled) {
              setObservations([]);
              void clearScene(sessionId).catch(() => setSceneNotice("No se pudo limpiar el contexto anterior. No se usarán más capturas mientras esté desactivado."));
            }
          }} />Contexto visual en vivo
        </label>
        <p className="text-xs">Di «mira acá» o pregunta por la imagen para compartir una captura actual con Groq, sin pulsar un botón. En los demás mensajes no se envían capturas. No se guardan fotos ni video; solo la conversación y los detalles que pidas analizar.</p>
        {sceneNotice && <p role="status" className="text-xs">{sceneNotice}</p>}
        <div className="my-3 flex flex-wrap gap-2">
          <button type="button" disabled={paused || pending} onClick={() => changeActivity()} className="min-h-11 rounded-lg border px-3 text-sm">Cambiar actividad</button>
          {photo && <button type="button" disabled={paused || pending} className="min-h-11 rounded-lg border px-3 text-sm" onClick={async () => {
            try { await follow("Exploremos juntos esta foto familiar.", await imageForConversation(photo)); }
            catch { setAiError("No pudimos preparar la foto. Prueba con otra imagen."); }
          }}>Analizar foto con IA</button>}
        </div>
        {photo && <p className="text-xs">Al analizar, compartes esta foto con Groq para conversar sobre sus detalles visibles.</p>}
        {observations.length > 0 && <div className="my-3 text-sm"><strong>Detalles que observó Ayni:</strong><ul className="list-inside list-disc">{observations.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
        {activity && <details key={title} className="min-w-0 md:mt-3 md:border-t md:border-[#cddbdc] md:pt-3" open>
          <summary className="cursor-pointer break-words font-semibold text-[#264653]">{title}</summary>
          {activity}
        </details>}
      </aside>

      <div ref={transcript} role="log" aria-label="Mensajes de la conversación" tabIndex={0}
        onScroll={({ currentTarget: view }) => {
          followLatest.current = view.scrollHeight - view.scrollTop - view.clientHeight < 24;
        }}
        className="h-[clamp(13rem,36dvh,28rem)] md:h-[clamp(16rem,49dvh,30rem)] min-w-0 space-y-3 sm:space-y-5 overflow-y-auto bg-white px-4 py-5 focus-visible:outline-offset-[-3px] sm:px-6 md:col-start-1 md:row-start-1">
        {messages.map(({ id, from, text }) => <div key={id} className={from === "you" ? "flex justify-end" : "flex"}>
          <div className={`max-w-[88%] rounded-xl px-4 py-3 text-[#193745] ${from === "you" ? "bg-[#e6f0f4]" : "bg-[#edf6ef]"}`}>
            <p className="text-sm font-bold">{from === "ayni" ? "Ayni" : "Tú"}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-base leading-relaxed sm:text-lg">{text}</p>
          </div>
        </div>)}
        {aiError && <div role={recovering ? "alert" : "status"} className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p>{aiError}</p>
          {recovering && <button type="button" disabled={pending || paused} className="min-h-11 font-semibold underline" onClick={() => {
            const attempt = lastAttempt.current;
            if (attempt) void follow(attempt.text, attempt.image, attempt.cue, attempt);
            else void loadConversation(() => true);
          }}>Reintentar con IA</button>}
          <button type="button" disabled={paused} className="ml-3 min-h-11 font-semibold" onClick={() => { setAiError(""); setRecovering(false); }}>Seguir conversando</button>
        </div>}
        {!aiError && suggestion !== "continue" && <div className="rounded-lg bg-sky-50 p-3 text-sm">
          <p>{suggestion === "pause" ? "Ayni propone hacer una pausa. Tú decides." : suggestion === "slow_down" ? "Pueden ir más despacio, escuchar o cambiar de tema." : "Si quieren, pueden cambiar de actividad."}</p>
          <button type="button" className="min-h-11 font-semibold underline" onClick={() => pause("La sesión está en pausa. Continúen cuando quieran.")}>Hacer una pausa</button>
          <button type="button" className="ml-3 min-h-11 font-semibold underline" onClick={() => changeActivity()}>Cambiar actividad</button>
        </div>}
        {pending && <p className="text-sm text-[#435d60]">Ayni está respondiendo…</p>}
      </div>

      <form onSubmit={submit} className="min-w-0 space-y-2 border-t border-[#cddbdc] bg-white px-4 py-3 sm:px-6 md:col-start-1 md:row-start-2">
        <div role="status" className="flex min-h-6 items-center gap-2 text-sm font-semibold text-[#264653]">
          <AudioLines aria-hidden="true" className={`size-4 ${speaking || dictation.state === "recording" ? "motion-safe:animate-pulse" : ""}`} />{status}
        </div>
        <div className="flex items-end gap-2">
          <label htmlFor="session-reply" className="sr-only">Tu respuesta</label>
          <textarea id="session-reply" maxLength={500} rows={1} value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className="min-h-11 min-w-0 flex-1 resize-y rounded-lg border border-[#a9bfc0] px-3 py-2.5 text-base text-[#264653] placeholder:text-[#536c70] focus-visible:outline-2 focus-visible:outline-[#2c5f7c]"
            placeholder="Escribe tu respuesta…" disabled={paused} />
          <button type="button" aria-label={mic && !dictation.error ? "Apagar micrófono" : "Activar micrófono"} title={mic && !dictation.error ? "Apagar micrófono" : "Activar micrófono"}
            className="grid size-11 shrink-0 place-items-center rounded-md border border-[#a9bfc0] text-[#264653] hover:bg-[#edf6ef]" disabled={paused}
            onClick={() => {
              if (dictation.error) { dictation.retry(); setMic(true); }
              else setMic(!mic);
            }}>{mic && !dictation.error ? <Mic className="size-5" /> : <MicOff className="size-5" />}</button>
          <Button type="submit" aria-label="Enviar" disabled={!input.trim() || paused || pending} className="size-11 shrink-0 p-0"><Send className="size-5" /></Button>
        </div>
        {dictation.state === "recording" && <Button type="button" variant="outline" onClick={dictation.finish}>Listo, ya hablé</Button>}
        <details className="text-sm"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Opciones de voz</summary>
          <label className="block py-2">Voz de Ayni
            <select aria-label="Voz de Ayni" className="mt-1 block w-full rounded border p-2" value={voices.some((voice) => voice.voiceURI === voiceURI) ? voiceURI : ""} onChange={(event) => {
              const selectedVoice = event.target.value;
              setVoiceURI(selectedVoice);
              saveVoicePreference(selectedVoice);
              if (sound && speakLocally("Hola, soy Ayni. Qué gusto conversar contigo. ¿Qué te gustaría recordar hoy?", setSpeaking, selectedVoice)) {
                setSpeaking(true);
                setVoiceNotice("");
              }
            }}>
              <option value="">{voices[0] ? `Automática · ${spanishVoiceLabel(voices[0])}` : "Automática"}</option>
              {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{spanishVoiceLabel(voice)}</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={cloudVoice} onChange={(event) => { dictation.cancel(); setCloudVoice(event.target.checked); }} />Mejor precisión con Groq</label>
          <p className="text-xs">Al activarlo, envías grabaciones breves a Groq para transcribirlas en español con el modelo de mayor precisión. El audio no se guarda en Ayni. Desactivado usa el modelo local.</p>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={reviewVoice} onChange={(event) => setReviewVoice(event.target.checked)} />Revisar el dictado antes de enviarlo</label>
        </details>
        {(voiceNotice || (mic && (dictation.error || dictation.notice))) && <p role="status" className="text-sm text-[#435d60]">{(mic && (dictation.error || dictation.notice)) || voiceNotice}</p>}
      </form>
    </div>
  </section>;
}
