import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, Pause, Play, RotateCcw, Square } from "lucide-react";
import type { User } from "../api/auth";
import { getMemory } from "../api/memories";
import type { Memory } from "../api/memories";
import { generateSession, getSession, listSessions } from "../api/sessions";
import type { SessionDetail, SessionHistory, SessionStep } from "../api/sessions";
import { saveSessionFeedback } from "../api/sessionFeedback";
import type { SessionExperience, SessionFeeling } from "../api/sessionFeedback";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

interface SessionGuideProps {
  currentUser: User;
  onOpenMemories: () => void;
}

function playerUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const youtubeId = url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : url.hostname === "youtube.com" || url.hostname === "www.youtube.com"
        ? url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1]
        : null;
    if (youtubeId && /^[\w-]{11}$/.test(youtubeId)) return `https://www.youtube-nocookie.com/embed/${youtubeId}`;
    const spotifyId = url.hostname === "open.spotify.com" ? url.pathname.match(/\/track\/([A-Za-z0-9]{22})/)?.[1] : null;
    if (spotifyId) return `https://open.spotify.com/embed/track/${spotifyId}`;
  } catch { return null; }
  return null;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function SessionGuide(props: SessionGuideProps) {
  return <PersistedSessionGuide key={`${props.currentUser.id}:${props.currentUser.family_id}`} {...props} />;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "No pudimos cargar la guía. Inténtalo de nuevo.";
}

function PersistedSessionGuide({ currentUser, onOpenMemories }: SessionGuideProps) {
  const [history, setHistory] = useState<SessionHistory | null>(null);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState<SessionDetail | null>(null);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [feeling, setFeeling] = useState<SessionFeeling | "">("");
  const [experience, setExperience] = useState<SessionExperience | "">("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    listSessions(offset).then((result) => {
      if (active) setHistory(result);
    }).catch((cause: unknown) => {
      if (active) { setHistory(null); setHistoryError(message(cause)); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [offset, refresh]);

  useEffect(() => {
    if (!guide || paused || reviewOpen) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [guide, paused, reviewOpen]);

  const reloadHistory = () => {
    setLoading(true);
    setHistoryError("");
    setRefresh((value) => value + 1);
  };
  const changePage = (nextOffset: number) => {
    setLoading(true);
    setHistoryError("");
    setOffset(nextOffset);
  };

  const open = async (id?: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = id ? await getSession(id) : await generateSession();
      setGuide(result);
      setStep(0);
      setElapsed(0);
      setPaused(false);
      setReviewOpen(false);
      setSaved(false);
      setFeeling("");
      setExperience("");
      setNote("");
      if (!id) { setOffset(0); reloadHistory(); }
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  };

  const finish = () => { setReviewOpen(true); setPaused(true); };
  const saveReview = () => {
    if (!feeling || !experience) return;
    try {
      saveSessionFeedback({
        id: crypto.randomUUID(), family_id: currentUser.family_id, user_id: currentUser.id,
        user_name: currentUser.name, feeling, experience, note: note.trim(),
        duration_seconds: elapsed, created_at: new Date().toISOString(),
      });
      setSaved(true);
    } catch { setError("No pudimos guardar la reseña en este navegador. Puedes volver a intentarlo."); }
  };
  const activeStep = guide?.steps[step];
  const duration = (guide?.duration_minutes ?? 15) * 60;

  return <Card className="min-w-0 overflow-hidden border-0 bg-white shadow-none">
    <CardHeader className="px-0 pb-5">
      <CardTitle className="text-2xl font-semibold text-[#2c5f7c]">Guía de sesión</CardTitle>
      <CardDescription>Las guías se guardan en tu cuenta familiar. Puedes volver a abrirlas desde el historial. Pueden parar cuando quieran.</CardDescription>
    </CardHeader>
    <CardContent className="min-w-0 space-y-6 px-0">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!guide && !reviewOpen && <section className="space-y-5">
        <p>Prepara una actividad de 15 minutos con recuerdos positivos y sin temas delicados. La guía es una ayuda para compartir en familia.</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void open()} disabled={busy || loading} variant="secondary">{busy ? "Abriendo guía…" : "Generar y comenzar guía"}</Button>
          <Button onClick={onOpenMemories} variant="outline" disabled={busy}>Ir a mis recuerdos</Button>
        </div>
        <h2 className="text-lg font-semibold text-[#2c5f7c]">Historial de guías</h2>
        {loading && <p role="status">Cargando historial…</p>}
        {historyError && <div role="alert"><p>{historyError}</p><Button variant="outline" onClick={reloadHistory}>Reintentar historial</Button></div>}
        {!loading && history?.total === 0 && <p>Todavía no hay guías guardadas.</p>}
        {!loading && history && <>
          <ul className="space-y-3">{history.items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
            <span className="min-w-0">Guía del {new Date(item.created_at).toLocaleString("es-PE")} · {item.duration_minutes} minutos</span>
            <Button variant="outline" disabled={busy} onClick={() => void open(item.id)}>Abrir guía</Button>
          </li>)}</ul>
          {history.total > history.limit && <nav aria-label="Páginas del historial" className="flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={busy || offset === 0} onClick={() => changePage(Math.max(0, offset - 10))}>Página anterior</Button>
            <span>Página {Math.floor(offset / 10) + 1}</span>
            <Button variant="outline" disabled={busy || offset + history.limit >= history.total} onClick={() => changePage(offset + 10)}>Página siguiente</Button>
          </nav>}
        </>}
      </section>}
      {guide && activeStep && !reviewOpen && <section className="space-y-5" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-[#2c5f7c]">Paso {step + 1} de {guide.steps.length}</h2>
          <span className="flex items-center gap-2"><Clock3 className="size-4" />{formatTime(elapsed)} / {formatTime(duration)}</span>
        </div>
        <Progress value={Math.min(100, elapsed / duration * 100)} />
        <p className="text-base leading-relaxed">{activeStep.instruction}</p>
        <p className="text-sm text-slate-600">Tiempo sugerido: {activeStep.duration_minutes} minutos</p>
        <StepMemory key={`${guide.id}:${step}`} step={activeStep} profileId={guide.elder_profile_id} />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={paused || step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft className="mr-2 size-4" />Anterior</Button>
          {step < guide.steps.length - 1 && <Button variant="outline" disabled={paused} onClick={() => setStep((value) => value + 1)}>Siguiente<ArrowRight className="ml-2 size-4" /></Button>}
          <Button variant="outline" onClick={() => setPaused((value) => !value)}>{paused ? <><Play className="mr-2 size-4" />Continuar</> : <><Pause className="mr-2 size-4" />Pausar</>}</Button>
          <Button variant="secondary" onClick={finish}><Square className="mr-2 size-4" />Terminar</Button>
          <Button variant="outline" onClick={() => { setGuide(null); reloadHistory(); }}>Volver al historial</Button>
        </div>
        {paused && <p role="status">La sesión está en pausa. No hay apuro para continuar.</p>}
        {elapsed >= duration && <p role="status">Ya pasó el tiempo sugerido. Pueden descansar o continuar si les resulta agradable.</p>}
      </section>}
      {reviewOpen && !saved && <section className="max-w-2xl space-y-5">
        <div><p className="text-sm font-semibold text-[#e76f51]">Al terminar</p><h2 className="text-xl font-semibold text-[#2c5f7c]">¿Cómo les fue?</h2><p className="mt-1 text-sm text-slate-600">Este registro es una nota familiar sobre la actividad, no un diagnóstico.</p></div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium text-[#264653]">¿Cómo se sintió tu familiar?</legend><div className="flex flex-wrap gap-2">{([["content", "A gusto"], ["calm", "Tranquilo/a"], ["tired", "Cansado/a"], ["no_answer", "Prefirió no decir"]] as const).map(([value, label]) => <Choice key={value} selected={feeling === value} onClick={() => setFeeling(value)}>{label}</Choice>)}</div></fieldset>
        <fieldset className="space-y-2"><legend className="text-sm font-medium text-[#264653]">¿Cómo resultó la actividad?</legend><div className="flex flex-wrap gap-2">{([["comfortable", "Cómoda"], ["mixed", "Con pausas"], ["paused", "Preferimos parar"]] as const).map(([value, label]) => <Choice key={value} selected={experience === value} onClick={() => setExperience(value)}>{label}</Choice>)}</div></fieldset>
        <label htmlFor="session-note" className="block text-sm font-medium text-[#264653]">Nota para la familia (opcional)</label><textarea id="session-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="¿Qué tema le interesó? ¿Qué prefieren hacer la próxima vez?" className="min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-[#264653] focus:outline-none focus:ring-2 focus:ring-[#2c5f7c]" />
        <div className="flex flex-wrap gap-3"><Button disabled={!feeling || !experience} onClick={saveReview} variant="secondary" className="w-auto"><Check className="mr-2 size-4" />Guardar reseña</Button><Button variant="outline" onClick={() => { setReviewOpen(false); setGuide(null); }} className="w-auto">Omitir</Button></div>
      </section>}

      {reviewOpen && saved && <div className="space-y-3 py-6" role="status"><Check className="size-6 text-[#2c5f7c]" /><h2 className="text-xl font-semibold text-[#2c5f7c]">Reseña guardada en este navegador</h2><p className="text-sm text-slate-600">Gracias por registrar cómo fue este momento para su familia.</p><Button variant="outline" onClick={() => { setReviewOpen(false); setGuide(null); setElapsed(0); }} className="w-auto"><RotateCcw className="mr-2 size-4" />Volver a la guía</Button></div>}
    </CardContent>
  </Card>;
}

function StepMemory({ step, profileId }: { step: SessionStep; profileId: string }) {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(Boolean(step.memory_available && step.memory_id));
  useEffect(() => {
    let active = true;
    if (!step.memory_available || !step.memory_id) return;
    getMemory(step.memory_id).then((result) => {
      if (active && result.is_positive && !result.is_sensitive && result.elder_profile_id === profileId) setMemory(result);
    }).catch(() => { /* Un recuerdo retirado no debe reaparecer desde una copia local. */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [step.memory_available, step.memory_id, profileId]);
  if (!step.source_memory_id) return null;
  if (loading) return <p role="status">Cargando recuerdo…</p>;
  if (!memory) return <p role="status">Este recuerdo ya no está disponible para la guía. Pueden pasar al siguiente paso.</p>;
  return <article className="min-w-0 space-y-3 rounded-xl bg-slate-50 p-4">
    <h3 className="break-words font-semibold">{memory.title}</h3>
    {memory.type === "anecdote" ? <p className="whitespace-pre-wrap break-words">{memory.text}</p> : <MusicPlayer memory={memory} />}
  </article>;
}

function MusicPlayer({ memory }: { memory: Memory }) {
  const src = playerUrl(memory.url);
  return <div className="mt-3 space-y-2">
    <p className="text-sm font-medium text-[#264653]">{memory.title}</p>
    {src ? <iframe title={`Reproducir ${memory.title}`} src={src} className="aspect-video w-full max-w-xl rounded-lg border-0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" /> : <a href={memory.url ?? undefined} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#2c5f7c] underline">Abrir canción en otra pestaña</a>}
  </div>;
}

function Choice({ children, selected, onClick }: { children: string; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`rounded-full border px-3 py-2 text-sm transition-colors ${selected ? "border-[#2c5f7c] bg-[#2c5f7c] text-white" : "border-slate-300 text-slate-700 hover:border-[#2c5f7c]"}`}>{children}</button>;
}
