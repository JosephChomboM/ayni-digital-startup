import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AudioLines, Bot, Camera, Mic, MicOff, Pause, Play, Send, Square, VideoOff, Volume2, VolumeX } from "lucide-react";
import { nextConversationTurn } from "../api/conversation";
import type { ConversationTopic } from "../api/conversation";
import { SessionCamera } from "./SessionCamera";
import { interpretReply, speakLocally } from "./sessionSignals";
import type { FaceCue, SessionActivity } from "./sessionSignals";
import { useSessionDictation } from "./useSessionDictation";
import { Button } from "./ui/button";

export const SESSION_GREETING = "Hola, soy Ayni. Qué gusto acompañarte. ¿Qué recuerdo te gustaría compartir hoy?";

const localQuestions: Record<ConversationTopic, readonly string[]> = {
  start: [SESSION_GREETING],
  place: ["¿Qué detalle de ese lugar te viene a la mente?", "¿Cómo era estar allí?"],
  activity: ["¿Qué era lo que más disfrutabas de ese momento?", "¿Qué te gustaría contar de lo que hicieron?"],
  detail: ["Te escucho. ¿Qué más te gustaría compartir?", "¿Hay otro detalle que quieras contar?"],
  ease: ["Está bien. ¿Quieres escuchar otra pregunta o prefieres cambiar de actividad?", "Podemos ir más despacio. ¿Qué te gustaría hacer ahora?"],
};

const acknowledgments: Partial<Record<ConversationTopic, string>> = {
  place: "Gracias por contármelo.",
  activity: "Gracias por compartir ese momento.",
  detail: "Te escucho.",
  ease: "No hay apuro. Vamos a tu ritmo.",
};

interface GuidedConversationProps {
  memoryId?: string;
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
  memoryId, withDevices, title, elapsed, paused, activity, onPause, onResume, onNextActivity, onFinish,
}: GuidedConversationProps) {
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
  const recent = useRef<string[]>([]);
  const turnCount = useRef(0);
  const lastTurnAt = useRef(0);
  const lastExpressionAt = useRef(-Infinity);
  const waitingForVoice = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  function speak(text: string) {
    if (!sound || document.hidden) return;
    if (!speakLocally(text, setSpeaking)) {
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

  async function follow(topic: ConversationTopic, introduction = "") {
    if (paused || request.current) return;
    const options = localQuestions[topic];
    let question = options[turnCount.current % options.length];
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    try {
      if (memoryId) {
        const result = await nextConversationTurn(memoryId, topic, recent.current, controller.signal);
        if (controller.signal.aborted) return;
        recent.current = [...recent.current, result.question_id].slice(-4);
        question = result.question;
      }
    } catch {
      if (controller.signal.aborted) return;
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
    if (controller.signal.aborted) return;
    turnCount.current += 1;
    show([introduction, question].filter(Boolean).join(" "));
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
    else void follow(intent, acknowledgments[intent]);
  }

  const dictation = useSessionDictation(
    (reply) => { if (!input.trim()) receive(reply); },
    mic && !paused && !pending && !speaking && !input.trim(),
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
    return !paused && !input.trim() && (dictation.state === "idle" || dictation.state === "listening") && !request.current && !window.speechSynthesis?.speaking &&
      now - lastTurnAt.current >= 5000 && now - lastExpressionAt.current >= 25_000;
  }

  function onCameraCue(cue: FaceCue) {
    // A glance away should never stop the session or switch off the preview.
    if (cue === "away") return;
    if (!canFollowExpression()) return;
    lastExpressionAt.current = performance.now();
    if (cue === "brow") show("Podemos seguir, cambiar de actividad o hacer una pausa. ¿Qué prefieres?");
    else void follow("detail", "Si quieres, podemos quedarnos un poquito más con este recuerdo.");
  }

  const greet = useEffectEvent(() => {
    heading.current?.focus();
    if (!nextMessage.current) show(SESSION_GREETING);
    else speak(SESSION_GREETING);
  });

  useEffect(() => {
    function onVoicesChanged() {
      const text = waitingForVoice.current;
      if (!text || document.hidden || !speakLocally(text, setSpeaking)) return;
      setSpeaking(true);
      waitingForVoice.current = null;
      setVoiceNotice("");
    }
    function updateVisibility() {
      setVisible(!document.hidden);
      if (document.hidden) {
        window.speechSynthesis?.cancel();
        setSpeaking(false);
      }
    }
    document.addEventListener("visibilitychange", updateVisibility);
    window.speechSynthesis?.addEventListener("voiceschanged", onVoicesChanged);
    greet();
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      request.current?.abort();
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

  const status = paused ? "En pausa" : speaking ? "Ayni está hablando" : pending ? "Ayni está preparando una pregunta" :
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
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-bold text-[#264653]">Tu cámara</h3>
            <button type="button" aria-label={camera ? "Apagar cámara" : "Activar cámara"} title={camera ? "Apagar cámara" : "Activar cámara"}
              className="grid size-11 shrink-0 place-items-center rounded-md border border-[#cddbdc] bg-white text-[#264653] hover:bg-[#e8f5e9]" disabled={paused}
              onClick={() => setCamera(!camera)}>{camera ? <VideoOff className="size-5" /> : <Camera className="size-5" />}</button>
          </div>
          {camera && !paused && visible ? <SessionCamera onCue={onCameraCue} canFollowExpression={canFollowExpression} /> :
            <p className="text-sm leading-snug text-[#435d60]">{paused ? "Cámara en pausa." : "Cámara apagada."}</p>}
        </div>
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
        {pending && <p className="text-sm text-[#435d60]">Ayni está preparando una pregunta…</p>}
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
        {(voiceNotice || (mic && dictation.error)) && <p role="status" className="text-sm text-[#435d60]">{(mic && dictation.error) || voiceNotice}</p>}
      </form>
    </div>
  </section>;
}
