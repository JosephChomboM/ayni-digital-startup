import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowRight, Bot, Camera, Mic, Pause, Play, Send, Square, VideoOff, Volume2, VolumeX } from "lucide-react";
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
  memoryId, title, elapsed, paused, activity, onPause, onResume, onNextActivity, onFinish,
}: GuidedConversationProps) {
  const [line, setLine] = useState(SESSION_GREETING);
  const [lastReply, setLastReply] = useState("");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [sound, setSound] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [camera, setCamera] = useState(false);
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
      waitingForVoice.current = text;
      setVoiceNotice("Puedes leer mis mensajes aquí. Este dispositivo no tiene una voz local en español.");
    } else {
      waitingForVoice.current = null;
      setVoiceNotice("");
    }
  }

  function show(text: string) {
    lastTurnAt.current = performance.now();
    setLine(text);
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
    if (!reply || paused) return;
    setLastReply(reply);
    const intent = interpretReply(reply);
    if (intent === "end") finish();
    else if (intent === "pause") pause("Claro, hagamos una pausa. Pulsa Continuar cuando te apetezca.");
    else if (intent === "next") changeActivity();
    else if (intent === "photo" || intent === "song" || intent === "anecdote") changeActivity(intent);
    else void follow(intent, acknowledgments[intent]);
  }

  const dictation = useSessionDictation(receive);
  const dictating = dictation.state !== "idle";

  function pause(message: string) {
    cancelTurn();
    dictation.cancel();
    setCamera(false);
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
    return !paused && !dictating && !request.current && !window.speechSynthesis?.speaking &&
      now - lastTurnAt.current >= 5000 && now - lastExpressionAt.current >= 25_000;
  }

  function onCameraCue(cue: FaceCue) {
    if (cue === "away") {
      pause("Te perdí de vista. Cuando vuelvas, puedes pulsar Continuar.");
      return;
    }
    if (!canFollowExpression()) return;
    lastExpressionAt.current = performance.now();
    if (cue === "brow") show("Podemos seguir, cambiar de actividad o hacer una pausa. ¿Qué prefieres?");
    else void follow("detail", "Si quieres, podemos quedarnos un poquito más con este recuerdo.");
  }

  const greet = useEffectEvent(() => {
    heading.current?.focus();
    show(SESSION_GREETING);
  });

  useEffect(() => {
    function onVoicesChanged() {
      const text = waitingForVoice.current;
      if (!text || document.hidden || !speakLocally(text, setSpeaking)) return;
      waitingForVoice.current = null;
      setVoiceNotice("");
    }
    window.speechSynthesis?.addEventListener("voiceschanged", onVoicesChanged);
    greet();
    return () => {
      request.current?.abort();
      waitingForVoice.current = null;
      window.speechSynthesis?.removeEventListener("voiceschanged", onVoicesChanged);
      window.speechSynthesis?.cancel();
    };
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || paused || pending || dictating) return;
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
      if (!speakLocally(line, setSpeaking)) setVoiceNotice("Puedes leer mis mensajes aquí. Este dispositivo no tiene una voz local en español.");
    }
  }

  const dictationText = {
    idle: "",
    permission: "Esperando permiso del micrófono…",
    recording: "Te escucho. Pulsa Listo al terminar.",
    loading: "Preparando la voz en español. La primera descarga puede tardar.",
    transcribing: "Estoy leyendo tu respuesta…",
  }[dictation.state];

  return <section aria-label="Sesión con Ayni" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <div>
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold tracking-tight text-[#264653] focus:outline-none">Sesión con Ayni</h2>
        <p className="mt-1 text-sm tabular-nums text-slate-600">{paused ? "En pausa · " : ""}{elapsed}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="w-auto gap-2" aria-pressed={sound} onClick={toggleSound}>
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}{sound ? "Silenciar" : "Activar voz"}
        </Button>
        <Button type="button" variant="outline" className="w-auto gap-2" onClick={() => {
          if (paused) { onResume(); show("Seguimos a tu ritmo. ¿Qué te gustaría contar ahora?"); }
          else pause("Hagamos una pausa. Seguimos cuando quieras.");
        }}>{paused ? <Play className="size-4" /> : <Pause className="size-4" />}{paused ? "Continuar" : "Pausar"}</Button>
        <Button type="button" variant="outline" className="w-auto gap-2" onClick={finish}><Square className="size-4" />Terminar</Button>
      </div>
    </div>

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.58fr)]">
      <div className="rounded-xl bg-[#193745] p-5 text-white sm:p-7 lg:col-start-1 lg:row-start-1">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#e9c46a] text-[#193745]">
              <Bot className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold">Ayni</p>
              <p className="text-sm text-[#d2e8eb]" role="status">
                {paused ? "En pausa" : speaking ? "Hablando…" : dictation.state === "recording" ? "Escuchando…" : pending ? "Pensando…" : "Te acompaño"}
              </p>
            </div>
          </div>
          <p aria-live="polite" className="mt-5 text-xl font-semibold leading-snug sm:text-2xl">{line}</p>
          <button type="button" className="mt-3 min-h-11 text-sm font-semibold text-[#f4d784] underline underline-offset-4"
            onClick={() => {
              if (!speakLocally(line, setSpeaking)) setVoiceNotice("Este dispositivo no tiene una voz local en español. Puedes leer mi mensaje en pantalla.");
            }} disabled={dictating}>
            Volver a escuchar
          </button>
      </div>
      <aside className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Cámara y recuerdo">
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-[#264653]">Tu cámara</h3>
            <Button type="button" variant="outline" className="w-auto gap-2" aria-pressed={camera} disabled={paused}
              onClick={() => setCamera((enabled) => !enabled)}>
              {camera ? <VideoOff className="size-4" /> : <Camera className="size-4" />}{camera ? "Apagar cámara" : "Activar cámara"}
            </Button>
          </div>
          {camera && !paused ? <SessionCamera onCue={onCameraCue} canFollowExpression={canFollowExpression} /> :
            <p className="text-sm text-slate-600">El video se queda en tu dispositivo.</p>}
        </div>
        {activity && <details key={title} className="border-b border-slate-200 py-2" open>
          <summary className="break-words font-semibold text-[#264653]">{title}</summary>
          {activity}
        </details>}
      </aside>
      <div className="space-y-3 lg:col-start-1 lg:row-start-2">
        {lastReply && <p className="break-words text-sm text-slate-700"><strong>Tú:</strong> {lastReply}</p>}
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="session-reply" className="block font-semibold text-[#264653]">Tu respuesta</label>
          <textarea id="session-reply" maxLength={500} rows={2} value={input} onChange={(event) => setInput(event.target.value)}
            className="w-full resize-y rounded-xl border border-slate-300 p-3 text-base text-[#264653] placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-[#2c5f7c]"
            placeholder="Por ejemplo: fuimos al parque" disabled={paused} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!input.trim() || paused || pending || dictating} className="w-auto gap-2"><Send className="size-4" />Enviar</Button>
            {dictation.state === "recording" ?
              <Button type="button" variant="secondary" className="w-auto gap-2" onClick={dictation.stop}><Square className="size-4" />Listo, ya hablé</Button> :
              <Button type="button" variant="outline" className="w-auto gap-2" disabled={paused || pending || dictating} onClick={() => {
                waitingForVoice.current = null;
                window.speechSynthesis?.cancel();
                setSpeaking(false);
                void dictation.start();
              }}><Mic className="size-4" />Hablar</Button>}
            {dictating && <Button type="button" variant="ghost" className="w-auto" onClick={dictation.cancel}>Cancelar voz</Button>}
            <Button type="button" variant="ghost" className="w-auto gap-2" disabled={paused} onClick={() => changeActivity()}>
              Otra actividad <ArrowRight className="size-4" />
            </Button>
          </div>
          {(dictationText || dictation.error || voiceNotice) && <p role="status" className="text-sm text-slate-700">{dictationText || dictation.error || voiceNotice}</p>}
        </form>
      </div>

    </div>
  </section>;
}
