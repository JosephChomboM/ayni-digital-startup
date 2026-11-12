import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { FormEvent } from "react";
import { History, Settings2, X, AudioLines, BookOpen, Camera, Images, Mic, MicOff, Music, Pause, Play, Send, Sparkles, Square, VideoOff, Volume2, VolumeX } from "lucide-react";
import type { Memory } from "../api/memories";
import { ApiError } from "../api/client";
import { getMessages, sendMessage, imageForConversation, transcribeAudio } from "../api/sessions";
import type { ChatInput } from "../api/sessions";
import type { CompanionState } from "./AyniCompanion";
import { CompanionScene } from "./CompanionScene";
import type { StageScene } from "./CompanionScene";
import type { CompanionTheme } from "./companionTheme";
import { SessionCamera } from "./SessionCamera";
import { SongContext } from "./SongContext";
import { interpretReply, requestsVisualContext, visualSource, speakLocally } from "./sessionSignals";
import type { FaceCue, SessionActivity } from "./sessionSignals";
import { useSessionDictation } from "./useSessionDictation";
import { Button } from "./ui/button";

export const SESSION_GREETING = "Hola, soy Ayni. Qué gusto acompañarte. ¿Qué recuerdo te gustaría compartir hoy?";

interface GuidedConversationProps {
  onBack?: () => void;
  sessionId: string;
  activeMemoryId?: string;
  memoryOptions?: { id: string; title: string }[];
  onSelectMemory?: (id: string) => void;
  photo?: Blob;
  withDevices: boolean;
  elapsed: string;
  paused: boolean;
  scene?: StageScene;
  activities: SessionActivity[];
  songMemory?: Memory;
  theme?: CompanionTheme;
  onPause: (message: string) => void;
  onResume: () => void;
  onNextActivity: (preferred?: SessionActivity) => string;
  onFinish: (speak: boolean) => void;
}

export function GuidedConversation({
  onBack, sessionId, activeMemoryId, memoryOptions, onSelectMemory, photo, withDevices, elapsed, paused, scene, activities, songMemory, theme, onPause, onResume, onNextActivity, onFinish,
}: GuidedConversationProps) {
  // El contexto visual queda siempre activo: con la cámara encendida, «mira acá» comparte una captura.
  const liveScene = true;
  const cameraCapture = useRef<(() => Promise<string>) | null>(null);
  // Lo que Ayni dijo localmente (cambio de actividad, pausa) y que el servidor aún no conoce.
  const localPrompt = useRef<string | null>(null);
  const lastAwayAt = useRef(-Infinity);
  const lastHandAt = useRef(-Infinity);
  const [bodyTracking, setBodyTracking] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsPanel, setToolsPanel] = useState("history");
  const [cloudVoice, setCloudVoice] = useState(false);
  const [reviewVoice, setReviewVoice] = useState(false);
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
    if (!speakLocally(text, setSpeaking)) {
      setSpeaking(false);
      waitingForVoice.current = text;
      setVoiceNotice("Puedes leer mis mensajes aquí. Este dispositivo no tiene una voz en español latinoamericano.");
    } else {
      setSpeaking(true);
      waitingForVoice.current = null;
      setVoiceNotice("");
    }
  }

  function show(text: string, local = true) {
    if (local) localPrompt.current = text;
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
    let lookAtCamera = false;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setAiError("");
    setRecovering(false);
    lastAttempt.current = retry ?? { text, request_id: crypto.randomUUID(), use_scene: false, available: activities, camera_on: camera && liveScene && !paused, ...(localPrompt.current ? { previous_prompt: localPrompt.current.slice(0, 300) } : {}), ...(activeMemoryId ? { active_memory_id: activeMemoryId } : {}), ...(image ? { image, image_consent: true } : {}), ...(cue ? { cue } : {}) };
    try {
      const source = visualSource(text);
      if (!retry?.image && !image && !cue && requestsVisualContext(text) && photo && source !== "camera") {
        image = await imageForConversation(photo);
        if (controller.signal.aborted) return;
      }
      if (!retry?.image && !image && !cue && requestsVisualContext(text)) {
        if (source !== "memory" && camera && liveScene && cameraCapture.current) {
          try { image = await cameraCapture.current(); }
          catch { /* The camera may still be starting or may have lost access. */ }
          if (controller.signal.aborted) return;
        }
        if (!image) {
          lastAttempt.current = null;
          setObservations([]);
          setSuggestion("continue");
          show(source === "memory"
            ? "Abre la foto del recuerdo que quieres comentar y vuelve a preguntarme. No usaré la cámara para esta petición."
            : camera && liveScene
            ? "La cámara todavía no me muestra la imagen. ¿Puedes enseñármela otra vez?"
            : "Si quieres que mire algo, enciende la cámara o usa Analizar foto con IA.");
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
      show(result.text, false);
      localPrompt.current = null;
      // Ayni decide qué hacer según lo que la persona pidió, dicho con sus propias palabras.
      const shows: Partial<Record<NonNullable<typeof result.action>, SessionActivity>> = { show_photo: "photo", play_song: "song", tell_story: "anecdote" };
      const activity = result.action ? shows[result.action] : undefined;
      if (activity && activities.includes(activity)) onNextActivity(activity);
      else if (result.action === "pause") { dictation.cancel(); onPause(result.text); }
      else if (result.action === "look_camera" && !image) lookAtCamera = true;
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
    if (lookAtCamera && camera && cameraCapture.current) {
      let frame: string | undefined;
      try { frame = await cameraCapture.current(); }
      catch { /* Sin imagen, Ayni ya dijo que iba a mirar; la persona puede repetir «mira acá». */ }
      if (frame && !controller.signal.aborted) await follow("Mira por la cámara lo que te estoy mostrando.", frame);
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
    if (cue === "hand") {
      // Una mano en alto suele pedir turno: Ayni lo nota sin llamar a la IA.
      const now = performance.now();
      if (paused || request.current || input.trim() || now - lastHandAt.current < 45_000 || now - lastTurnAt.current < 4000) return;
      lastHandAt.current = now;
      show("¡Veo tu mano en alto! ¿Quieres contarme o mostrarme algo?");
      return;
    }
    if (cue === "away") {
      // Salir del cuadro nunca detiene la sesión: Ayni solo avisa que sigue ahí, sin insistir.
      const now = performance.now();
      if (paused || request.current || input.trim() || now - lastAwayAt.current < 90_000 || now - lastTurnAt.current < 8000) return;
      lastAwayAt.current = now;
      show("Aquí sigo contigo. Cuando quieras, seguimos conversando.");
      return;
    }
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
    const text = waitingForVoice.current;
    if (!text || document.hidden || !speakLocally(text, setSpeaking)) return;
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
      if (speakLocally(line, setSpeaking)) { setSpeaking(true); setVoiceNotice(""); }
      else {
        waitingForVoice.current = line;
        setVoiceNotice("Este dispositivo no tiene una voz en español latinoamericano.");
      }
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

  const companionState: CompanionState = paused ? "paused" : speaking ? "speaking" :
    pending || dictation.state === "transcribing" || dictation.state === "loading" ? "thinking" :
      mic && !dictation.error && (dictation.state === "listening" || dictation.state === "recording") ? "listening" : "idle";
  const choices: [SessionActivity, string, typeof Images][] = [
    ["photo", "Ver la foto", Images],
    ["song", "Escuchar la canción", Music],
    ["anecdote", "Contar la historia", BookOpen],
  ];
  const listeningNow = mic && !dictation.error && (dictation.state === "listening" || dictation.state === "recording");

  return <section aria-label="Sesión con Ayni" className="conversation-room">
    <header className="conversation-bar">
      <div className="min-w-0">
        <h2 ref={heading} tabIndex={-1} className="focus:outline-none">Conversación con Ayni</h2>
        <p className="tabular-nums"><span>{elapsed}</span><span className="session-bar-state"> · Sesión {paused ? "en pausa" : "en curso"}</span></p>
      </div>
      <div className="flex items-center gap-1">
        {onBack && <button type="button" className="bar-action" aria-label="Volver al historial" title="Volver al historial" onClick={onBack}><History size={18}/></button>}
        <button type="button" className="bar-icon session-tools-toggle" aria-label="Abrir opciones de sesión" aria-expanded={toolsOpen} onClick={() => setToolsOpen(!toolsOpen)}><Settings2 size={20}/></button>
        <button type="button" title={sound ? "Silenciar a Ayni" : "Activar voz"} aria-label={sound ? "Silenciar a Ayni" : "Activar voz"}
          className="bar-icon" onClick={toggleSound}>
          {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
        <button type="button" className="bar-action" onClick={() => {
          if (paused) { onResume(); show("Seguimos a tu ritmo. ¿Qué te gustaría contar ahora?"); }
          else pause("Hagamos una pausa. Seguimos cuando quieras.");
        }}>{paused ? <Play className="size-4" /> : <Pause className="size-4" />}{paused ? "Continuar" : "Pausar"}</button>
        <button type="button" className="bar-action" onClick={finish}><Square className="size-4" />Terminar</button>
      </div>
    </header>

    <CompanionScene state={companionState} scene={scene} line={line} pending={pending} paused={paused} theme={theme} camera={<div className="camera-dock">
      <div className="camera-head">
        <h3>Tu cámara</h3>
        <button type="button" aria-label={camera ? "Apagar cámara" : "Activar cámara"} title={camera ? "Apagar cámara" : "Activar cámara"}
          className="tool-icon" disabled={paused}
          onClick={() => setCamera(!camera)}>{camera ? <VideoOff className="size-5" /> : <Camera className="size-5" />}</button>
      </div>
      {camera && !paused && visible ? <SessionCamera captureRef={cameraCapture} onCue={onCameraCue} canFollowExpression={canFollowExpression} analyzing={pending} onAnalyzeFrame={(image) => void follow("Conversemos sobre un detalle visible de esta captura.", image)}
        live={false} bodyTracking={bodyTracking} /> :
        <p className="tool-hint">{paused ? "Cámara en pausa." : "Enciéndela para que Ayni vea tus gestos y lo que le muestres."}</p>}
      {camera && !paused && <label className="camera-toggle"><input type="checkbox" checked={bodyTracking} onChange={(event) => setBodyTracking(event.target.checked)} />Puntos de manos y cuerpo</label>}
    </div>} extra={<>
      {scene?.kind === "photo" && photo && <button type="button" className="prop-action" disabled={paused || pending} onClick={async () => {
        try { await follow("Exploremos juntos esta foto familiar.", await imageForConversation(photo)); }
        catch { setAiError("No pudimos preparar la foto. Prueba con otra imagen."); }
      }}><Sparkles aria-hidden="true" className="size-4" />Analizar foto con IA</button>}
    </>} />

    {(observations.length > 0 || aiError || (!aiError && suggestion !== "continue")) && <div className="stage-notes">
      {observations.length > 0 && <div className="note-observed"><strong>Ayni notó:</strong><ul>{observations.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
      {aiError && <div role={recovering ? "alert" : "status"} className="note-warning">
        <p>{aiError}</p>
        <div className="flex flex-wrap gap-x-4">
          {recovering && <button type="button" disabled={pending || paused} onClick={() => {
            const attempt = lastAttempt.current;
            if (attempt) void follow(attempt.text, attempt.image, attempt.cue, attempt);
            else void loadConversation(() => true);
          }}>Reintentar con IA</button>}
          <button type="button" disabled={paused} onClick={() => { setAiError(""); setRecovering(false); }}>Seguir conversando</button>
        </div>
      </div>}
      {!aiError && suggestion !== "continue" && <div className="note-suggestion">
        <p>{suggestion === "pause" ? "Ayni propone hacer una pausa. Tú decides." : suggestion === "slow_down" ? "Pueden ir más despacio, escuchar o cambiar de tema." : "Si quieren, pueden cambiar de actividad."}</p>
        <div className="flex flex-wrap gap-x-4">
          <button type="button" onClick={() => pause("La sesión está en pausa. Continúen cuando quieran.")}>Hacer una pausa</button>
          <button type="button" onClick={() => changeActivity()}>Probar otra actividad</button>
        </div>
      </div>}
    </div>}

    <div className="conversation-layout">
      <div className="conversation-main">
        {activities.length > 0 && <div className="stage-choices" role="group" aria-label="¿Qué hacemos ahora?">
          {choices.filter(([kind]) => activities.includes(kind)).map(([kind, label, Icon]) =>
            <button key={kind} type="button" aria-pressed={scene?.kind === kind} disabled={paused || pending}
              onClick={() => changeActivity(kind)}><Icon aria-hidden="true" />{label}</button>)}
        </div>}

        <form onSubmit={submit} className="reply-dock">
          <div role="status" className="reply-status">
            <AudioLines aria-hidden="true" className={`size-4 ${speaking || dictation.state === "recording" ? "motion-safe:animate-pulse" : ""}`} />{status}
          </div>
          <div className="flex items-end gap-2">
            <button type="button" aria-label={mic && !dictation.error ? "Apagar micrófono" : "Activar micrófono"} title={mic && !dictation.error ? "Apagar micrófono" : "Activar micrófono"}
              className="reply-mic" data-on={(mic && !dictation.error) || undefined} data-listening={listeningNow || undefined} disabled={paused}
              onClick={() => {
                if (dictation.error) { dictation.retry(); setMic(true); }
                else setMic(!mic);
              }}>{mic && !dictation.error ? <Mic className="size-6" /> : <MicOff className="size-6" />}</button>
            <label htmlFor="session-reply" className="sr-only">Tu respuesta</label>
            <textarea id="session-reply" maxLength={500} rows={1} value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="O escribe aquí tu respuesta…" disabled={paused} />
            <button type="submit" aria-label="Enviar" className="reply-send" disabled={!input.trim() || paused || pending}><Send className="size-5" /></button>
          </div>
          {dictation.state === "recording" && <Button type="button" variant="outline" onClick={dictation.finish}>Listo, ya hablé</Button>}
          {(voiceNotice || (mic && (dictation.error || dictation.notice))) && <p role="status" className="reply-notice">{(mic && (dictation.error || dictation.notice)) || voiceNotice}</p>}
        </form>
      </div>

      <aside className="companion-tools" data-open={toolsOpen || undefined} data-panel={toolsPanel} aria-label="Herramientas para quien acompaña">
        <div className="session-tools-tabs" role="group" aria-label="Panel de sesión">
          <button type="button" aria-pressed={toolsPanel === "history"} onClick={() => setToolsPanel("history")}>Conversación</button>
          <button type="button" aria-pressed={toolsPanel === "options"} onClick={() => setToolsPanel("options")}>Opciones</button>
          <button type="button" className="session-tools-close" aria-label="Cerrar opciones de sesión" onClick={() => setToolsOpen(false)}><X size={18}/></button>
        </div>
        <h3>Para quien acompaña</h3>
        {Boolean(memoryOptions?.length) && <label className="tool-field">Recuerdo activo
          <select aria-label="Recuerdo activo" value={activeMemoryId ?? ""} disabled={paused || pending} onChange={(event) => { dictation.cancel(); onSelectMemory?.(event.target.value); }}>
            {!activeMemoryId && <option value="">Fotos de la sesión</option>}
            {memoryOptions?.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select>
        </label>}

        <div className="tool-block">
          <h4>Lo que hemos conversado</h4>
          <div ref={transcript} role="log" aria-label="Mensajes de la conversación" tabIndex={0} className="transcript"
            onScroll={({ currentTarget: view }) => {
              followLatest.current = view.scrollHeight - view.scrollTop - view.clientHeight < 24;
            }}>
            {messages.map(({ id, from, text }) => <p key={id} data-from={from}>
              <strong>{from === "ayni" ? "Ayni" : "Tú"}</strong>{text}
            </p>)}
            {pending && <p className="transcript-pending">Ayni está respondiendo…</p>}
          </div>
        </div>

        <div className="tool-block">
          <h4>Sobre la cámara</h4>
          <p className="tool-hint">Los puntos y el gesto («Sonriendo», «Gesto triste»…) se calculan en este dispositivo: describen la expresión de la cara, no lo que la persona siente, y no se guardan ni se envían. Di «mira acá» o «¿puedes ver mi cámara?» para compartir una captura con Groq; en los demás mensajes no se envían capturas.</p>
        </div>

        <div className="tool-block">
          <button type="button" className="tool-button" disabled={paused || pending} onClick={() => changeActivity()}>Cambiar actividad</button>
          {photo && scene?.kind === "photo" && <p className="tool-hint">Al analizar, compartes esta foto con Groq para conversar sobre sus detalles visibles.</p>}
        </div>

        {scene?.kind === "song" && songMemory && <SongContext key={songMemory.id} memoryId={songMemory.id} />}

        <details className="tool-block">
          <summary>Opciones de dictado</summary>
          <label className="tool-check"><input type="checkbox" checked={cloudVoice} onChange={(event) => { dictation.cancel(); setCloudVoice(event.target.checked); }} />Mejor precisión con Groq</label>
          <p className="tool-hint">Al activarlo, envías grabaciones breves a Groq para transcribirlas en español con el modelo de mayor precisión. Consume cuota de audio y solicitudes de Groq cada vez que hablas. No cambia la voz de Ayni. El audio no se guarda en Ayni. Desactivado usa el modelo local.</p>
          <label className="tool-check"><input type="checkbox" checked={reviewVoice} onChange={(event) => setReviewVoice(event.target.checked)} />Revisar el dictado antes de enviarlo</label>
        </details>
      </aside>
    </div>
  </section>;
}
