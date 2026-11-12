import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, ImagePlus, Pause, Play, RotateCcw, Square } from "lucide-react";
import type { User } from "../api/auth";
import { ApiError } from "../api/client";
import { getMemory, memoryErrorMessage } from "../api/memories";
import type { Memory } from "../api/memories";
import { listPhotos } from "../api/photos";
import type { MemoryPhoto } from "../api/photos";
import { generateSession, getRecordedReaction, getSession, listSessions, recordReaction } from "../api/sessions";
import type { Reaction, SessionGuide as SavedGuide, SessionSummary } from "../api/sessions";
import { GuidedConversation } from "./GuidedConversation";
import { speakLocally } from "./sessionSignals";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

interface SessionGuideProps { currentUser: User; onOpenMemories: () => void }
const reactions: Array<[Reaction, string]> = [["receptivo", "Receptivo"], ["emocionado", "Emocionado"], ["indiferente", "Indiferente"], ["agitado", "Agitado"]];
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


export function SessionGuide({ currentUser, onOpenMemories }: SessionGuideProps) {
  const [guide, setGuide] = useState<SavedGuide | null>(null);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [contentError, setContentError] = useState("");
  const [contentAttempt, setContentAttempt] = useState(0);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [adaptivePause, setAdaptivePause] = useState<{ message: string; speak: boolean } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [saved, setSaved] = useState(false);
  const guideId = guide?.id;

  useEffect(() => {
    let active = true;
    setLoading(true);
    listSessions(20, offset).then((page) => {
      if (active) { setHistory(page.items); setTotal(page.total); setError(""); }
    }).catch((reason: unknown) => { if (active) setError(memoryErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser.family_id, offset, historyAttempt]);

  useEffect(() => {
    if (!guideId) return;
    let active = true;
    async function refreshContent() {
      try {
        const fresh = await getSession(guideId!);
        const ids = [...new Set(fresh.steps.filter((item) => item.memory_available && item.memory_id).map((item) => item.memory_id!))];
        const candidates = await Promise.all(ids.map(async (id) => {
          try { return await getMemory(id); }
          catch (reason) { if (reason instanceof ApiError && reason.code === "memory_not_found") return null; throw reason; }
        }));
        const safe = candidates.filter((item): item is Memory => item !== null && item.is_positive && !item.is_sensitive && !item.deletion_pending);
        const groups = await Promise.all(safe.map(async (memory) => {
          try { return await listPhotos(memory.id); }
          catch (reason) {
            if (reason instanceof ApiError && reason.status === 401) throw reason;
            if (active) setContentError(memoryErrorMessage(reason));
            return [];
          }
        }));
        if (active) { setGuide(fresh); setMemories(safe); setPhotos(groups.flat()); }
      } catch (reason) {
        if (active) { setMemories([]); setPhotos([]); setContentError(memoryErrorMessage(reason)); }
      }
    }
    setContentError("");
    void refreshContent();
    const renewal = window.setInterval(() => { void refreshContent(); }, 4 * 60 * 1000);
    return () => { active = false; window.clearInterval(renewal); };
  }, [guideId, contentAttempt]);

  useEffect(() => {
    if (!started || paused) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, paused]);

  useEffect(() => {
    if (!paused || !adaptivePause?.speak) return;
    speakLocally(adaptivePause.message);
    return () => window.speechSynthesis?.cancel();
  }, [paused, adaptivePause]);

  async function begin(existingId?: string) {
    setBusy(true); setError("");
    try {
      const record = existingId ? await getSession(existingId) : await generateSession();
      const response = existingId ? await getRecordedReaction(existingId) : null;
      setGuide(record); setReaction(response?.reaction ?? null); setSaved(response !== null);
      setStarted(true); setPaused(false); setAdaptivePause(null); setElapsed(0); setStep(0); setPhotoIndex(0); setReviewOpen(false);
    } catch (reason) { setError(memoryErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function saveReview() {
    if (!guide || !reaction || busy || saved) return;
    setBusy(true); setError("");
    try { const result = await recordReaction(guide.id, reaction); setReaction(result.reaction); setSaved(true); }
    catch (reason) { setError(memoryErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  function returnToHistory() {
    setStarted(false); setReviewOpen(false); setElapsed(0); setGuide(null);
    setHistoryAttempt((value) => value + 1);
  }

  const currentStep = guide?.steps[step];
  const memory = memories.find((item) => item.id === currentStep?.memory_id);
  const stepPhotos = memory ? photos.filter((photo) => photo.memory_id === memory.id) : [];
  const duration = (guide?.duration_minutes ?? 15) * 60;

  return <Card className="overflow-hidden border-0 bg-white shadow-none">
    <CardHeader className="px-0 pb-5">
      <p className="text-sm font-semibold text-[#e76f51]">Un momento en familia</p>
      <CardTitle className="text-2xl font-semibold text-[#2c5f7c]">Guía de sesión</CardTitle>
      <CardDescription className="max-w-2xl text-sm leading-relaxed text-slate-600">Guías y reacciones compartidas con tu familia. Pueden saltar preguntas, cambiar de tema o detenerse cuando quieran.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6 px-0">
      {error && <div role="alert" className="py-3 text-sm text-red-700">{error}</div>}
      {!started && !reviewOpen && <>
        <section className="space-y-4" aria-labelledby="prepare-session">
          <div><h2 id="prepare-session" className="text-lg font-semibold text-[#264653]">Preparen el momento</h2><p className="mt-1 text-sm text-slate-600">Ayni preparará una guía de 15 minutos con hasta tres recuerdos bonitos que no estén marcados como temas delicados.</p></div>
          <p className="text-sm text-slate-600">La guía se guarda en tu familia. En el plan gratis puedes preparar una nueva cada siete días; abrir una guardada no consume otra guía.</p>
          <div className="flex flex-wrap gap-3"><Button onClick={() => { void begin(); }} disabled={busy || loading} variant="secondary" className="w-auto px-5">{busy ? "Preparando guía…" : "Comenzar cuando estén listos"}</Button><Button variant="outline" onClick={onOpenMemories} className="w-auto"><ImagePlus className="mr-2 size-4" />Ver recuerdos</Button></div>
        </section>
        <section className="space-y-4 border-t border-slate-200 pt-5" aria-label="Historial de guías">
          <h2 className="text-lg font-semibold text-[#264653]">Guías guardadas</h2>
          {loading ? <p role="status">Cargando historial…</p> : !history.length ? <p className="text-sm text-slate-600">Todavía no hay guías en esta página.</p> : <ul className="divide-y divide-slate-100">{history.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><time dateTime={item.created_at} className="text-sm font-medium text-[#264653]">{new Date(item.created_at).toLocaleString("es-PE")}</time><p className="text-xs text-slate-500">Duración sugerida: {item.duration_minutes} minutos</p></div><Button variant="outline" disabled={busy} onClick={() => { void begin(item.id); }} className="w-auto">Abrir guía</Button></li>)}</ul>}
          <div className="flex flex-wrap items-center gap-3"><Button variant="outline" className="w-auto" disabled={loading || busy || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 20))}>Anterior</Button><span className="text-sm text-slate-500">{total} guías guardadas</span><Button variant="outline" className="w-auto" disabled={loading || busy || offset + 20 >= total} onClick={() => setOffset((value) => value + 20)}>Siguiente</Button><button onClick={() => setHistoryAttempt((value) => value + 1)} disabled={loading || busy} className="text-sm font-semibold text-[#2c5f7c] underline">Actualizar historial</button></div>
        </section>
      </>}

      {started && guide && currentStep && <section className="space-y-5" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[#e76f51]">Paso {step + 1} de {guide.steps.length}</p><h2 className="text-xl font-semibold text-[#2c5f7c]">{memory?.title ?? "Un momento para compartir"}</h2></div><div className="flex items-center gap-2 text-sm font-medium text-slate-600"><Clock3 className="size-4 text-[#2c5f7c]" />{formatTime(elapsed)} / {formatTime(duration)}</div></div>
        <Progress value={Math.min(100, elapsed / duration * 100)} className="h-1.5" />
        <p className="text-base leading-relaxed text-slate-700">{currentStep.instruction}</p>
        <p className="text-xs text-slate-500">Tiempo sugerido para este paso: {currentStep.duration_minutes} minutos.</p>
        {currentStep.source_memory_id && !memory && <p role="status" className="text-sm text-slate-600">Este recuerdo ya no está disponible para la guía. Pueden continuar con el siguiente paso.</p>}
        {memory?.type === "anecdote" && <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-700">{memory.text}</p>}
        {memory?.type === "song" && <MusicPlayer memory={memory} />}
        {stepPhotos.length > 0 && <PhotoCarousel photos={stepPhotos} index={photoIndex} onChange={setPhotoIndex} />}
        {contentError && <div role="alert" className="text-sm text-amber-900"><p>{contentError}</p><button className="mt-2 font-semibold underline" onClick={() => setContentAttempt((value) => value + 1)}>Actualizar recuerdos y fotos</button></div>}
        {memory?.type === "anecdote" && !paused && <GuidedConversation
          key={memory.id} memoryId={memory.id} title={memory.title}
          onPause={(message, speak) => { setAdaptivePause({ message, speak }); setPaused(true); }}
          onNextActivity={() => { setStep((value) => Math.min(guide.steps.length - 1, value + 1)); setPhotoIndex(0); }}
        />}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><div className="flex gap-2"><Button variant="outline" disabled={paused || step === 0} onClick={() => { setStep((value) => value - 1); setPhotoIndex(0); }} className="w-auto"><ArrowLeft className="mr-2 size-4" />Anterior</Button>{step < guide.steps.length - 1 && <Button variant="outline" disabled={paused} onClick={() => { setStep((value) => value + 1); setPhotoIndex(0); }} className="w-auto">Siguiente<ArrowRight className="ml-2 size-4" /></Button>}</div><div className="flex gap-2"><Button variant="outline" onClick={() => { setAdaptivePause(null); setPaused((value) => !value); }} className="w-auto">{paused ? <><Play className="mr-2 size-4" />Continuar</> : <><Pause className="mr-2 size-4" />Pausar</>}</Button><Button variant="secondary" onClick={() => { setStarted(false); setReviewOpen(true); }} className="w-auto"><Square className="mr-2 size-4" />Terminar</Button></div></div>
        {paused && <p role="status" className="text-sm text-slate-500">{adaptivePause?.message ?? "La sesión está en pausa. No hay apuro para continuar."}</p>}
        {elapsed >= duration && <p role="status" className="text-sm text-slate-600">Pueden cerrar la actividad cuando quieran.</p>}
      </section>}

      {reviewOpen && !saved && <section className="max-w-2xl space-y-5">
        <div><p className="text-sm font-semibold text-[#e76f51]">Al terminar</p><h2 className="text-xl font-semibold text-[#2c5f7c]">¿Cómo les fue?</h2><p className="mt-1 text-sm text-slate-600">Elige lo que observaste durante el momento compartido.</p></div>
        <fieldset className="space-y-2" disabled={busy}><legend className="text-sm font-medium text-[#264653]">¿Cómo reaccionó tu familiar?</legend><div className="flex flex-wrap gap-2">{reactions.map(([value, label]) => <Choice key={value} selected={reaction === value} onClick={() => setReaction(value)}>{label}</Choice>)}</div></fieldset>
        <div className="flex flex-wrap gap-3"><Button disabled={!reaction || busy} onClick={() => { void saveReview(); }} variant="secondary" className="w-auto"><Check className="mr-2 size-4" />{busy ? "Guardando reacción…" : "Guardar reacción"}</Button><Button variant="outline" disabled={busy} onClick={returnToHistory} className="w-auto">Omitir por ahora</Button></div>
      </section>}
      {reviewOpen && saved && <div className="space-y-3 py-6" role="status"><Check className="size-6 text-[#2c5f7c]" /><h2 className="text-xl font-semibold text-[#2c5f7c]">Reacción guardada en tu familia</h2><p className="text-sm text-slate-600">{reactions.find(([value]) => value === reaction)?.[1]}. Puedes consultarla al volver a abrir esta guía.</p><Button variant="outline" onClick={returnToHistory} className="w-auto"><RotateCcw className="mr-2 size-4" />Volver al historial</Button></div>}
      <p className="text-xs text-slate-500">Esto no es un diagnóstico. Es un registro de actividades familiares.</p>
    </CardContent>
  </Card>;
}

function PhotoCarousel({ photos, index, onChange }: { photos: MemoryPhoto[]; index: number; onChange: (index: number) => void }) {
  const photo = photos[index % photos.length];
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [photo?.url]);
  if (!photo) return null;
  return <figure className="mt-3 max-w-2xl">
    {!failed ? <img src={photo.url} alt="Foto del recuerdo familiar" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="max-h-[420px] w-full rounded-lg object-cover" /> : <p className="text-sm text-slate-600">La foto no está disponible. Las imágenes se actualizan automáticamente cada cuatro minutos.</p>}
    <figcaption className="mt-2 text-xs text-slate-600">Foto {index % photos.length + 1} de {photos.length}</figcaption>
    {photos.length > 1 && <div className="mt-2 flex gap-2"><button type="button" onClick={() => onChange((index - 1 + photos.length) % photos.length)} className="rounded-full border border-slate-300 p-2 text-[#2c5f7c]" aria-label="Foto anterior"><ArrowLeft className="size-4" /></button><button type="button" onClick={() => onChange((index + 1) % photos.length)} className="rounded-full border border-slate-300 p-2 text-[#2c5f7c]" aria-label="Siguiente foto"><ArrowRight className="size-4" /></button></div>}
  </figure>;
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
