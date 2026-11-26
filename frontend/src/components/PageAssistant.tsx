import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Mic, MicOff, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { assistantSpeech, assistantTurn } from "../api/assistant";
import type { AssistantMessage, PageDecision } from "../api/assistant";
import { AyniCompanion } from "./AyniCompanion";
import { captureScreen, performAction, settleScreen } from "./assistantRuntime";
import type { CapturedScreen } from "./assistantRuntime";
import { SessionVoice } from "./sessionVoice";
import { useSessionDictation } from "./useSessionDictation";

interface Task {
  instruction: string;
  history: AssistantMessage[];
  results: string[];
  controller: AbortController;
  steps: number;
  actions: Set<string>;
}
interface Confirmation { task: Task; decision: PageDecision; snapshot: CapturedScreen; label: string }

function actionKey(snapshot: CapturedScreen, action: string, target: string, value: string) {
  const label = snapshot.targets.get(target)?.control.label ?? "";
  const position = /siguiente|anterior|adelantar|retroceder|ver m[aá]s/i.test(label) ? snapshot.screen.text : "";
  return `${snapshot.screen.page}:${action}:${target}:${value}:${position}`;
}

export function PageAssistant({ open, onOpenChange, request }: { open: boolean; onOpenChange: (open: boolean) => void; request?: { id: string; text: string } }) {
  const [accepted, setAccepted] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [mic, setMic] = useState(false);
  const [sound, setSound] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [failedTask, setFailedTask] = useState<Task | null>(null);
  const [visible, setVisible] = useState(!document.hidden);
  const taskRef = useRef<Task | null>(null);
  const confirmationRef = useRef<Confirmation | null>(null);
  const handledRequest = useRef<string | undefined>(undefined);
  const [voice] = useState(() => new SessionVoice(assistantSpeech));
  const entry = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  function say(text: string) {
    setMessages(items => [...items.slice(-19), { role: "assistant", content: text }]);
    setStatus("");
    if (sound && !document.hidden) void voice.speak("assistant", text, setSpeaking, () => {});
  }

  function stop() {
    taskRef.current?.controller.abort();
    taskRef.current = null;
    confirmationRef.current = null;
    setConfirmation(null);
    setFailedTask(null);
    setBusy(false);
    setStatus("");
    voice.cancel();
    setMic(false);
  }

  async function continueTask(task: Task) {
    try {
      while (task.steps < 10 && !task.controller.signal.aborted) {
        const snapshot = captureScreen();
        snapshot.screen.controls = snapshot.screen.controls.filter(control => {
          const completed = task.actions.has(actionKey(snapshot, control.kind, control.id, control.kind === "click" ? "" : control.value));
          if (completed) snapshot.screen.completed_controls.push(control);
          return !completed;
        });
        const signal = AbortSignal.any([task.controller.signal, AbortSignal.timeout(25_000)]);
        const decision = await assistantTurn(task.instruction, snapshot.screen, task.history, task.results, signal);
        if (task.controller.signal.aborted || taskRef.current !== task) return;
        if (decision.action === "done") { say(decision.message); return; }
        task.steps++;
        const signature = actionKey(snapshot, decision.action, decision.target, decision.value);
        if (decision.action !== "wait" && decision.action !== "scroll" && task.actions.has(signature)) {
          throw new Error("Ese paso ya se ejecutó. Revisa el resultado en la página y dime cómo quieres continuar.");
        }
        const target = snapshot.targets.get(decision.target);
        if (target?.control.confirmation) {
          const pending = { task, decision, snapshot, label: target.control.label };
          confirmationRef.current = pending;
          setConfirmation(pending);
          setStatus(decision.message);
          return;
        }
        setStatus(decision.message);
        task.results.push(performAction(decision, snapshot));
        task.actions.add(signature);
        await settleScreen(task.controller.signal);
      }
      if (!task.controller.signal.aborted) say("Llegué al límite de pasos de esta petición. Revisa dónde quedamos y dime cómo seguimos.");
    } catch (error) {
      if (!task.controller.signal.aborted) {
        setFailedTask(task);
        say(error instanceof Error ? error.message : "No pude completar ese paso. Puedes volver a intentarlo.");
      }
    } finally {
      if (taskRef.current === task && !confirmationRef.current) {
        taskRef.current = null;
        setBusy(false);
      }
    }
  }

  function submit(value: string) {
    const instruction = value.trim().slice(0, 2000);
    if (!instruction || taskRef.current || !accepted) return;
    voice.cancel();
    setFailedTask(null);
    setInput("");
    setMessages(items => [...items.slice(-19), { role: "user", content: instruction }]);
    setBusy(true);
    setStatus("Estoy revisando la página…");
    const task: Task = { instruction, history: messages.slice(-10), results: [], controller: new AbortController(), steps: 0, actions: new Set() };
    taskRef.current = task;
    void continueTask(task);
  }

  const dictation = useSessionDictation(submit, open && accepted && mic && visible && !busy && !speaking && !input.trim());
  const submitRequest = useEffectEvent(submit);
  useEffect(() => {
    if (!open || !accepted || !request || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    submitRequest(request.text);
  }, [open, accepted, request]);

  useEffect(() => {
    function visibility() { setVisible(!document.hidden); }
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      taskRef.current?.controller.abort();
      voice.cancel();
    };
  }, [voice]);
  useEffect(() => { if (open) entry.current?.focus(); }, [open, accepted]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [messages, status, confirmation]);

  function confirm() {
    const pending = confirmationRef.current;
    if (!pending || pending.task.controller.signal.aborted) return;
    confirmationRef.current = null;
    setConfirmation(null);
    try {
      pending.task.results.push(performAction(pending.decision, pending.snapshot, true));
      pending.task.actions.add(actionKey(pending.snapshot, pending.decision.action, pending.decision.target, pending.decision.value));
      void settleScreen(pending.task.controller.signal).then(() => continueTask(pending.task));
    } catch (error) {
      taskRef.current = null;
      setBusy(false);
      say(error instanceof Error ? error.message : "La acción ya no está disponible.");
    }
  }

  return <div className="page-assistant" data-ayni-assistant>
    {!open && <button type="button" className="assistant-launch" onClick={() => onOpenChange(true)} aria-expanded={false} aria-controls="page-assistant-panel">
      <AyniCompanion state="idle" decorative /><span>Hablar con Ayni</span>
    </button>}
    {open && <aside id="page-assistant-panel" className="assistant-panel" aria-label="Asistente de Ayni">
      <header><div><AyniCompanion state={speaking ? "speaking" : busy ? "thinking" : "idle"} decorative /><h2>Ayni te acompaña</h2></div>
        <button type="button" aria-label="Cerrar asistente" onClick={() => { stop(); onOpenChange(false); }}><X size={20}/></button>
      </header>
      {!accepted ? <div className="assistant-intro">
        <p>Puedo abrir secciones, buscar recuerdos, completar formularios y usar los controles de la página contigo.</p>
        <p>Para ayudarte compartiré con Groq tus instrucciones y el contenido visible de la pantalla. Si activas el micrófono, el dictado se procesa en tu dispositivo.</p>
        <button type="button" className="assistant-primary" onClick={() => setAccepted(true)}>Empezar con Ayni</button>
      </div> : <>
        <div className="assistant-log" ref={log} role="log" aria-label="Conversación con el asistente" aria-live="polite">
          {!messages.length && <p className="assistant-example">Prueba con «Busca fotos del paseo» o «Abre mi perfil familiar».</p>}
          {messages.map((item, index) => <p key={index} data-role={item.role}><span className="sr-only">{item.role === "user" ? "Tú" : "Ayni"}: </span>{item.content}</p>)}
          {status && <p role="status" className="assistant-status">{status}</p>}
          {failedTask && !busy && <button type="button" className="assistant-primary" onClick={() => {
            voice.cancel();
            const next = { ...failedTask, controller: new AbortController() };
            setFailedTask(null);
            taskRef.current = next;
            setBusy(true);
            setStatus("Retomando el paso pendiente…");
            void continueTask(next);
          }}>Reintentar paso pendiente</button>}
          {confirmation && <div className="assistant-confirm"><p>Confirma esta acción: <strong>{confirmation.label}</strong></p>
            <button type="button" className="assistant-primary" onClick={confirm}>Confirmar acción</button>
            <button type="button" onClick={() => { stop(); say("Acción cancelada."); }}>Cancelar</button>
          </div>}
        </div>
        <form onSubmit={event => { event.preventDefault(); submit(input); }}>
          <label className="sr-only" htmlFor="assistant-instruction">Qué quieres hacer</label>
          <textarea ref={entry} id="assistant-instruction" rows={2} maxLength={2000} value={input} disabled={busy} onChange={event => setInput(event.target.value)} placeholder="Dime qué quieres hacer…" />
          <div className="assistant-tools">
            <button type="button" aria-label={mic ? "Apagar micrófono del asistente" : "Hablar con el asistente"} aria-pressed={mic} disabled={busy} onClick={() => setMic(value => !value)}>{mic ? <MicOff size={19}/> : <Mic size={19}/>}</button>
            <button type="button" aria-label={sound ? "Silenciar asistente" : "Escuchar asistente"} aria-pressed={sound} onClick={() => { voice.cancel(); setSound(value => !value); }}>{sound ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button>
            <span role="status">{mic ? dictation.state === "listening" || dictation.state === "recording" ? "Te escucho…" : "Micrófono activo" : "Puedes escribir o hablar"}</span>
            {busy ? <button type="button" aria-label="Detener petición" onClick={stop}><Square size={19}/></button> : <button type="submit" aria-label="Enviar petición" disabled={!input.trim()}><Send size={19}/></button>}
          </div>
          {dictation.error && <p role="alert" className="assistant-error">{dictation.error}</p>}
        </form>
      </>}
    </aside>}
  </div>;
}
