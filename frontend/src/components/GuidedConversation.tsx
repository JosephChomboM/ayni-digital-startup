import { useEffect, useRef, useState } from "react";
import { Camera, MessageCircle, Mic, Volume2 } from "lucide-react";
import { nextConversationTurn } from "../api/conversation";
import type { ConversationTopic, ConversationTurn } from "../api/conversation";
import { Button } from "./ui/button";
import { SessionCamera } from "./SessionCamera";
import { interpretReply, speakLocally } from "./sessionSignals";
import type { FaceCue } from "./sessionSignals";

const MAX_QUESTIONS = 5;
const topics = [
  ["place", "El lugar"],
  ["activity", "Lo que hicimos"],
  ["detail", "Otro detalle"],
] as const;

interface LocalRecognition {
  processLocally: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}

type RecognitionClass = {
  new (): LocalRecognition;
  available?: (options: { langs: string[]; processLocally: true }) => Promise<string>;
  install?: (options: { langs: string[]; processLocally: true }) => Promise<boolean>;
};

function localRecognitionClass() {
  const speech = window as Window & { SpeechRecognition?: RecognitionClass };
  return speech.SpeechRecognition?.available ? speech.SpeechRecognition : undefined;
}

interface GuidedConversationProps {
  memoryId: string;
  title: string;
  onPause: (message: string, speak: boolean) => void;
  onNextActivity: () => void;
}

export function GuidedConversation({ memoryId, title, onPause, onNextActivity }: GuidedConversationProps) {
  const [turn, setTurn] = useState<ConversationTurn | null>(null);
  const [asked, setAsked] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const [closed, setClosed] = useState(false);
  const [camera, setCamera] = useState(false);
  const [readAutomatically, setReadAutomatically] = useState(false);
  const [needsVoicePack, setNeedsVoicePack] = useState(false);
  const [installingVoicePack, setInstallingVoicePack] = useState(false);
  const request = useRef<AbortController | null>(null);
  const microphone = useRef<LocalRecognition | null>(null);
  const lastTurnAt = useRef(0);
  const expressionUsed = useRef(false);

  function stopMicrophone() {
    const recognition = microphone.current;
    microphone.current = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
  }

  useEffect(() => {
    function onVisibilityChange() {
      if (!document.hidden) return;
      stopMicrophone();
      setListening(false);
      window.speechSynthesis?.cancel();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      request.current?.abort();
      request.current = null;
      stopMicrophone();
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function ask(topic: ConversationTopic, introduction = "") {
    if (request.current || asked.length >= MAX_QUESTIONS) return;
    stopMicrophone();
    window.speechSynthesis?.cancel();
    setListening(false);
    setNotice("");
    setPending(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const next = await nextConversationTurn(memoryId, topic, asked, controller.signal);
      if (controller.signal.aborted) return;
      lastTurnAt.current = performance.now();
      setTurn(next);
      setAsked((previous) => [...previous, next.question_id]);
      if (introduction) setNotice(introduction);
      if (readAutomatically && !document.hidden) {
        speakLocally([introduction, next.question].filter(Boolean).join(" "));
      }
    } catch {
      if (!controller.signal.aborted) {
        setNotice("No pudimos traer otra pregunta. Pueden volver a intentar o seguir con la guía.");
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setPending(false);
      }
    }
  }

  function close() {
    request.current?.abort();
    request.current = null;
    stopMicrophone();
    window.speechSynthesis?.cancel();
    setClosed(true);
  }

  function readQuestion() {
    if (!turn) return;
    if (!speakLocally(turn.question)) {
      setNotice("No encontramos una voz en español en este dispositivo. Pueden leer la pregunta en pantalla.");
    }
  }

  function canFollowExpression() {
    return !expressionUsed.current && !!turn && !request.current && !microphone.current &&
      !window.speechSynthesis?.speaking && performance.now() - lastTurnAt.current >= 4000 &&
      asked.length < MAX_QUESTIONS;
  }

  function handleFaceCue(cue: FaceCue) {
    if (cue === "away") {
      onPause("La persona salió del cuadro. Podemos retomar cuando esté lista.", readAutomatically);
      return;
    }
    if (!canFollowExpression()) return;
    expressionUsed.current = true;
    if (cue === "brow") {
      void ask("ease", "Tómate tu tiempo. Podemos cambiar de actividad cuando quieras.");
    } else {
      void ask("detail", "Si te apetece, podemos seguir con este recuerdo.");
    }
  }

  async function listenForTopic() {
    const Recognition = localRecognitionClass();
    if (!Recognition?.available || microphone.current) return;
    const recognition = new Recognition();
    if (!("processLocally" in recognition)) return;
    microphone.current = recognition;
    setListening(true);
    setNotice("");
    window.speechSynthesis?.cancel();
    try {
      recognition.processLocally = true;
      recognition.lang = "es-ES";
      const status = await Recognition.available({ langs: [recognition.lang], processLocally: true });
      if (microphone.current !== recognition) return;
      if (status !== "available") {
        const canInstall = status === "downloadable" && !!Recognition.install;
        setNeedsVoicePack(canInstall);
        setNotice(canInstall
          ? "Descarga el paquete de español para responder por voz."
          : "El dictado local en español no está disponible aquí. Elijan un tema con los botones.");
        microphone.current = null;
        setListening(false);
        return;
      }
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (!transcript?.trim()) return;
        const choice = interpretReply(transcript);
        if (choice === "end") close();
        else if (choice === "pause") onPause("Claro, tomemos una pausa.", readAutomatically);
        else if (choice === "next") onNextActivity();
        else void ask(choice, choice === "ease" ? "Está bien. Podemos tomarnos nuestro tiempo." : "");
      };
      recognition.onerror = () => {
        stopMicrophone();
        setListening(false);
        setNotice("No pudimos escuchar. Pueden elegir el tema con los botones.");
      };
      recognition.onend = () => {
        if (microphone.current === recognition) microphone.current = null;
        setListening(false);
      };
      recognition.start();
    } catch {
      if (microphone.current !== recognition) return;
      microphone.current = null;
      setListening(false);
      setNotice("No pudimos activar el micrófono. Pueden elegir el tema con los botones.");
    }
  }

  async function installVoicePack() {
    const Recognition = localRecognitionClass();
    if (!Recognition?.install || installingVoicePack) return;
    setInstallingVoicePack(true);
    try {
      const ready = await Recognition.install({ langs: ["es-ES"], processLocally: true });
      setNeedsVoicePack(!ready);
      setNotice(ready ? "La voz está lista. Pulsa «Responder por voz»." : "La descarga no terminó. Puedes usar los botones.");
    } catch {
      setNotice("No pudimos instalar el español. Puedes usar los botones.");
    } finally {
      setInstallingVoicePack(false);
    }
  }

  if (closed) return <p role="status" className="text-sm text-slate-600">Gracias por compartir este recuerdo.</p>;

  return <section aria-label="Conversar con Ayni" className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
    <div>
      <h3 className="font-semibold text-[#264653]">Conversar con Ayni</h3>
      <p className="mt-1 text-sm text-slate-600">{title}</p>
    </div>
    <label className="flex min-h-11 items-center gap-2 text-sm text-[#264653]">
      <input type="checkbox" checked={readAutomatically} disabled={pending || listening} onChange={(event) => {
        const enabled = event.target.checked;
        setReadAutomatically(enabled);
        if (!enabled) window.speechSynthesis?.cancel();
        else if (turn) readQuestion();
      }} />
      Leer las preguntas en voz alta
    </label>
    {!turn && <Button type="button" onClick={() => void ask("start")} disabled={pending} className="w-auto">
      <MessageCircle className="mr-2 size-4" />Conversar
    </Button>}
    {turn && <>
      <div aria-live="polite">
        <p className="text-sm text-slate-600">{turn.source === "ai" ? "Pregunta elegida por IA" : "Pregunta de la guía"}</p>
        <p className="mt-1 text-lg font-medium text-[#264653]">{turn.question}</p>
      </div>
      <Button type="button" variant="outline" className="w-auto" onClick={readQuestion} disabled={pending || listening}>
        <Volume2 className="mr-2 size-4" />Escuchar pregunta
      </Button>
      {asked.length < MAX_QUESTIONS && <fieldset className="space-y-2">
        <legend className="text-sm text-slate-600">¿De qué les gustaría hablar ahora?</legend>
        <div className="flex flex-wrap gap-2">
          {topics.map(([topic, label]) => <Button key={topic} type="button" variant="outline" className="w-auto"
            onClick={() => void ask(topic)} disabled={pending}>{label}</Button>)}
        </div>
      </fieldset>}
      {localRecognitionClass() && <div className="space-y-2">
        <Button type="button" variant="outline" className="w-auto"
          onClick={() => void listenForTopic()} disabled={pending || listening || installingVoicePack}>
          <Mic className="mr-2 size-4" />{listening ? "Te estamos escuchando…" : "Responder por voz"}
        </Button>
        {needsVoicePack && <Button type="button" variant="outline" className="w-auto"
          onClick={() => void installVoicePack()} disabled={installingVoicePack}>
          {installingVoicePack ? "Descargando español…" : "Descargar español"}
        </Button>}
        <p className="text-sm text-slate-600">Puedes contar un detalle, pedir una pausa o decir «otra actividad».</p>
      </div>}
      <div className="space-y-2 border-t border-slate-200 pt-3">
        <Button type="button" variant="outline" className="w-auto" onClick={() => setCamera((enabled) => !enabled)}>
          <Camera className="mr-2 size-4" />{camera ? "Apagar cámara" : "Activar cámara"}
        </Button>
        {camera
          ? <SessionCamera onCue={handleFaceCue} canFollowExpression={canFollowExpression} />
          : <p className="text-sm text-slate-600">Con su permiso, la cámara ayuda a ajustar el ritmo. El video se procesa en este dispositivo.</p>}
      </div>
    </>}
    {pending && <p role="status" className="text-sm text-slate-600">Buscando una pregunta…</p>}
    {notice && <p role="status" className="text-sm text-slate-700">{notice}</p>}
    {(turn || pending) && <Button type="button" variant="outline" className="w-auto" onClick={close}>Terminar conversación</Button>}
  </section>;
}
