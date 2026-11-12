import { AyniCompanion } from "./AyniCompanion";
import { PageIntro } from "./PageIntro";
import { useEffect, useMemo, useState } from "react";
import { Check, Play, RotateCcw } from "lucide-react";
import type { User } from "../api/auth";
import { listMemories, getMemory } from "../api/memories";
import type { Memory } from "../api/memories";
import { listPhotos } from "../api/photos";
import type { MemoryPhoto } from "../api/photos";
import { recommendMemory, generateSession, getRecordedReaction, getSession, listSessions, recordReaction } from "../api/sessions";
import type { Recommendation, Reaction, SavedSession, SessionSummary } from "../api/sessions";
import { GuidedConversation } from "./GuidedConversation";
import type { StageScene } from "./CompanionScene";
import { speakLocally } from "./sessionSignals";
import type { SessionActivity } from "./sessionSignals";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

interface SessionGuideProps {
  currentUser: User;
  onOpenMemories: () => void;
}

const reactions: Array<[Reaction, string]> = [
  ["receptivo", "Receptivo"], ["emocionado", "Emocionado"],
  ["indiferente", "Indiferente"], ["agitado", "Agitado"],
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function SessionGuide(props: SessionGuideProps) {
  return <PersistedSessionGuide key={`${props.currentUser.id}:${props.currentUser.family_id}`} {...props} />;
}

function PersistedSessionGuide({ currentUser, onOpenMemories }: SessionGuideProps) {
  const [memoryChoice, setMemoryChoice] = useState("");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [guide, setGuide] = useState<SavedSession | null>(null);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    listSessions(10, offset).then((page) => {
      if (active) { setHistory(page.items); setTotal(page.total); setHistoryError(""); }
    }).catch((cause: unknown) => { if (active) setHistoryError(cause instanceof Error ? cause.message : "No pudimos cargar el historial."); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [offset, revision]);
  const refreshHistory = (next = offset) => { setHistoryLoading(true); setOffset(next); setRevision((value) => value + 1); };
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [photoBlob, setPhotoBlob] = useState<Blob>();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [anecdoteId, setAnecdoteId] = useState("");
  const [songId, setSongId] = useState("");
  const [withDevices, setWithDevices] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activity, setActivity] = useState<SessionActivity>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewVoice, setReviewVoice] = useState(false);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [reactionSaved, setReactionSaved] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [saved, setSaved] = useState(false);

  const songs = useMemo(() => memories.filter((memory) => memory.type === "song" && memory.is_positive && !memory.is_sensitive), [memories]);
  const anecdotes = useMemo(() => memories.filter((memory) =>
    memory.type === "anecdote" && memory.is_positive && !memory.is_sensitive), [memories]);
  const selectedSong = songs.find((memory) => memory.id === songId) ?? songs[0];
  const selectedAnecdote = anecdotes.find((memory) => memory.id === anecdoteId) ?? anecdotes[0];

  useEffect(() => {
    let active = true;
    setLoading(true);
    listMemories({ include_sensitive: false, limit: 50, offset: 0 }).then(async (response) => {
      if (!active) return;
      setMemories(response.items);
      const eligible = response.items.filter((memory) => memory.is_positive && !memory.is_sensitive);
      const photoPages = await Promise.allSettled(eligible.map((memory) => listPhotos(memory.id)));
      if (!active) return;
      setPhotos(photoPages.flatMap((result) => result.status === "fulfilled" ? result.value : []));
      const firstAnecdote = response.items.find((memory) => memory.type === "anecdote" && memory.is_positive && !memory.is_sensitive);
      if (firstAnecdote) setAnecdoteId(firstAnecdote.id);
      const firstSong = response.items.find((memory) => memory.type === "song" && memory.is_positive && !memory.is_sensitive);
      if (firstSong) setSongId(firstSong.id);
      setLoadError("");
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "No pudimos cargar los recuerdos.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser.family_id]);

  useEffect(() => {
    const currentPhoto = photos[photoIndex % Math.max(photos.length, 1)];
    if (activity !== "photo" || !currentPhoto) { setPhotoBlob(undefined); return; }
    const controller = new AbortController();
    fetch(currentPhoto.url, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("No se pudo cargar la foto."); return response.blob(); })
      .then((blob) => { if (!controller.signal.aborted) setPhotoBlob(blob); })
      .catch(() => { if (!controller.signal.aborted) setPhotoBlob(undefined); });
    return () => controller.abort();
  }, [activity, photoIndex, photos]);

  useEffect(() => {
    if (!started || !memories.length) return;
    const refresh = () => {
      Promise.allSettled(memories.map((memory) => listPhotos(memory.id)))
        .then((pages) => setPhotos(pages.flatMap((page) => page.status === "fulfilled" ? page.value : [])));
    };
    const timer = window.setInterval(refresh, 4 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [started, memories]);

  useEffect(() => {
    if (!started || paused) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, paused]);

  useEffect(() => {
    if (!reviewOpen || !reviewVoice) return;
    speakLocally("Gracias por compartir este momento conmigo. Si quieren, pueden contar cómo les fue.");
    return () => window.speechSynthesis?.cancel();
  }, [reviewOpen, reviewVoice]);

  const availableActivities: SessionActivity[] = [];
  if (selectedAnecdote) availableActivities.push("anecdote");
  if (photos.length) availableActivities.push("photo");
  if (selectedSong) availableActivities.push("song");

  async function begin(devices: boolean, id?: string) {
    if (busy) return;
    setBusy(true);
    setLoadError("");
    try {
      const saved = id ? await getSession(id) : await generateSession(memoryChoice || undefined);
      setGuide(saved);
      refreshHistory(0);
      const ids = [...new Set(saved.steps.filter((item) => item.memory_available && item.memory_id).map((item) => item.memory_id!))];
      const results = await Promise.allSettled(ids.map(getMemory));
      const allowed = results.flatMap((result) => result.status === "fulfilled" && result.value.is_positive && !result.value.is_sensitive && result.value.elder_profile_id === saved.elder_profile_id ? [result.value] : []);
      const photoResults = await Promise.allSettled(allowed.map((memory) => listPhotos(memory.id)));
      const sessionPhotos = photoResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      const previousReaction = await getRecordedReaction(saved.id);
      setMemories(allowed);
      setPhotos(sessionPhotos);
      setAnecdoteId(allowed.find((item) => item.type === "anecdote")?.id ?? "");
      setSongId(allowed.find((item) => item.type === "song")?.id ?? "");
      setActivity(allowed[0]?.type ?? (sessionPhotos.length ? "photo" : undefined));
      setWithDevices(devices);
      setPhotoIndex(0);
      setStarted(true);
      setPaused(false);
      setElapsed(0);
      setReviewOpen(false);
      setSaved(false);
      setReaction(previousReaction?.reaction ?? null);
      setReactionSaved(Boolean(previousReaction));
      setReviewError("");
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "No pudimos abrir la guía."); }
    finally { setBusy(false); }
  }

  function finish(speak: boolean) {
    setStarted(false);
    setPaused(false);
    setReviewVoice(speak);
    setSaved(reactionSaved);
    setReviewOpen(true);
  }

  function nextActivity(preferred?: SessionActivity): string {
    if (preferred && !availableActivities.includes(preferred)) {
      return "Ese recuerdo todavía no está disponible aquí. ¿Quieres que sigamos con lo que tenemos?";
    }
    const index = activity ? availableActivities.indexOf(activity) : -1;
    const next = preferred ?? (availableActivities.length
      ? availableActivities[(index + 1) % availableActivities.length]
      : undefined);
    setActivity(next);
    if (next === "photo") {
      if (activity === "photo") setPhotoIndex((value) => (value + 1) % photos.length);
      return "Miremos una foto juntos. ¿Qué detalle te llama la atención?";
    }
    if (next === "song") return "Pasemos a la canción. Puedes ponerla cuando quieras. ¿En qué momento solías escucharla?";
    if (next === "anecdote") return "Hablemos de la anécdota. ¿Qué parte te gustaría contar?";
    return "Podemos pensar en otro día bonito. ¿Qué te gustaría compartir?";
  }

  const saveReview = async () => {
    if (!guide || !reaction || reactionSaved || busy) return;
    setBusy(true);
    setReviewError("");
    try {
      await recordReaction(guide.id, reaction);
      setReactionSaved(true);
      setSaved(true);
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : "No pudimos guardar la reacción.");
    } finally { setBusy(false); }
  };

  const scene: StageScene | undefined = activity === "anecdote" && selectedAnecdote ? { kind: "anecdote", title: selectedAnecdote.title, text: selectedAnecdote.text ?? "" } :
    activity === "photo" && photos.length ? { kind: "photo", photos, index: photoIndex, onChange: setPhotoIndex } :
      activity === "song" && selectedSong ? { kind: "song", memory: selectedSong } : undefined;

  return <Card className="session-page border-0 shadow-none">
    {!started && <PageIntro eyebrow="UN MOMENTO PARA CONECTAR" title="Guía de sesión">Conversen a su ritmo con la ayuda de Ayni.</PageIntro>}
    <CardContent className={`session-content space-y-6 px-0 ${!started && !reviewOpen ? "session-preparation" : ""}`}>
      {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
      {!started && !reviewOpen && <section aria-labelledby="prepare-session" className="session-setup">
        <div className="flex items-start gap-4">
          <AyniCompanion className="setup-companion" decorative/>
          <div>
            <h2 id="prepare-session" className="text-xl font-bold text-[#223e38]">Un momento con Ayni</h2>
            <p className="mt-1 text-base text-slate-700">Te haré una pregunta y esperaré tu respuesta. Puedes hablar o escribir a tu ritmo.</p>
          </div>
        </div>
        {loading ? <p role="status" className="mt-5 text-sm text-slate-600">Cargando recuerdos…</p> : <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">¿Con qué recuerdo quieres empezar?
            <select aria-label="Recuerdo para la sesión" className="mt-2 w-full rounded border bg-white p-3 font-normal" value={memoryChoice} onChange={(event) => setMemoryChoice(event.target.value)}>
              <option value="">Dejar que Ayni prepare una selección</option>
              {memories.filter((item) => item.is_positive && !item.is_sensitive).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.type === "song" ? "Canción" : "Anécdota"}</option>)}
            </select>
          </label>
          <Button variant="outline" disabled={recommending || busy} onClick={async () => {
            setRecommending(true); setLoadError("");
            try { const result = await recommendMemory(); setRecommendation(result); setMemoryChoice(result.memory_id); }
            catch (cause) { setLoadError(cause instanceof Error ? cause.message : "No pudimos recomendar un recuerdo."); }
            finally { setRecommending(false); }
          }}>{recommending ? "Buscando una opción…" : "Recomendar un recuerdo"}</Button>
          {recommendation && <div className="rounded border bg-sky-50 p-3 text-sm"><strong>{recommendation.source === "ai" ? "Recomendación con IA" : "Sugerencia por historial"}: {recommendation.title}</strong><p>{recommendation.reason}</p><p>Puedes cambiar la selección antes de empezar. Esto no es un diagnóstico. Es un registro de actividades familiares.</p></div>}
          <p className="text-sm text-slate-700">Ayni usará los recuerdos positivos de esta guía y recordará lo que compartan durante la conversación.</p>
          <button type="button" onClick={onOpenMemories} className="min-h-11 text-sm font-semibold underline">Agregar o revisar mis recuerdos</button>
          <p className="text-sm text-slate-600">Groq recibe sus respuestas y los recuerdos necesarios para conversar. Los mensajes y detalles observados se guardan en el historial familiar. Al empezar con Ayni y permitir la cámara, se comparte una captura solo cuando pides mirar algo, por ejemplo «mira acá». Puedes desactivar «Contexto visual en vivo». No se guardan fotos ni video de la cámara.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={busy} onClick={() => void begin(true)} className="w-auto gap-2"><Play className="size-4" />Empezar con Ayni</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void begin(false)} className="w-auto">Empezar sin cámara ni micrófono</Button>
          </div>
          <p className="text-sm text-slate-600">Al empezar con Ayni, tu navegador pedirá permiso para la cámara y el micrófono. El dictado se procesa en este dispositivo, salvo que actives «Mejor precisión con Groq» para compartir el audio. Ayni acompaña actividades familiares; no es un servicio de salud.</p>
        </div>}
      </section>}
      {!started && !reviewOpen && <section className="session-history space-y-3" aria-labelledby="saved-guides">
        <h2 id="saved-guides" className="text-lg font-semibold">Mis guías y conversaciones</h2>
        {historyLoading ? <p role="status">Cargando historial…</p> : historyError ? <div role="alert"><p>{historyError}</p><Button variant="outline" onClick={() => refreshHistory()}>Reintentar historial</Button></div> : <>
          {total === 0 && <p className="text-sm">Tu primera guía y conversación aparecerán aquí.</p>}
          <ul className="space-y-2">{history.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <span>Guía del {new Date(item.created_at).toLocaleString("es-PE")} · {item.duration_minutes} minutos</span>
            <Button variant="outline" disabled={busy} onClick={() => void begin(false, item.id)}>Continuar conversación</Button>
          </li>)}</ul>
          {total > 10 && <nav aria-label="Páginas del historial" className="flex flex-wrap gap-3"><Button variant="outline" disabled={offset === 0 || busy} onClick={() => refreshHistory(Math.max(0, offset - 10))}>Página anterior</Button><Button variant="outline" disabled={offset + 10 >= total || busy} onClick={() => refreshHistory(offset + 10)}>Página siguiente</Button></nav>}
        </>}
      </section>}
      {started && guide && <GuidedConversation
        key={guide.id}
        sessionId={guide.id}
        activeMemoryId={activity === "song" ? selectedSong?.id : activity === "anecdote" ? selectedAnecdote?.id : undefined}
        memoryOptions={memories.map((item) => ({ id: item.id, title: item.title }))}
        onSelectMemory={(id) => {
          const item = memories.find((value) => value.id === id);
          if (!item) return;
          if (item.type === "song") setSongId(item.id); else setAnecdoteId(item.id);
          setActivity(item.type);
        }}
        photo={activity === "photo" ? photoBlob : undefined}
        withDevices={withDevices}
        elapsed={formatTime(elapsed)}
        paused={paused}
        scene={scene}
        activities={availableActivities}
        songMemory={selectedSong}
        onPause={() => setPaused(true)}
        onResume={() => setPaused(false)}
        onNextActivity={nextActivity}
        onFinish={finish}
      />}
      {started && <Button variant="outline" onClick={() => { setStarted(false); refreshHistory(); }}>Volver al historial</Button>}

      {reviewOpen && !saved && <section className="max-w-2xl space-y-5">
        <div><p className="text-sm font-semibold text-[#b94c35]">Al terminar</p><h2 className="text-xl font-semibold text-[#235c50]">¿Cómo fue este momento?</h2><p className="mt-1 text-sm text-slate-600">La reacción se comparte con tu familia y queda asociada a esta guía.</p></div>
        <fieldset className="space-y-2" disabled={busy || reactionSaved}><legend className="text-sm font-medium text-[#223e38]">Elige una reacción</legend><div className="flex flex-wrap gap-2">{reactions.map(([value, label]) => <Choice key={value} selected={reaction === value} onClick={() => setReaction(value)}>{label}</Choice>)}</div></fieldset>
        {reviewError && <p role="alert" className="text-sm text-red-700">{reviewError}</p>}
        <div className="flex flex-wrap gap-3"><Button disabled={!reaction || busy || reactionSaved} onClick={() => void saveReview()} variant="secondary" className="w-auto"><Check className="mr-2 size-4" />{busy ? "Guardando reacción…" : reactionSaved ? "Reacción ya guardada" : "Guardar reacción"}</Button><Button variant="outline" disabled={busy} onClick={() => { setReviewOpen(false); setStarted(false); }} className="w-auto">Omitir por ahora</Button></div>
      </section>}

      {reviewOpen && saved && <div className="space-y-3 py-6" role="status"><Check className="size-6 text-[#235c50]" /><h2 className="text-xl font-semibold text-[#235c50]">Reacción guardada en tu familia</h2><p className="text-sm text-slate-600">Gracias por compartir cómo fue este momento.</p><Button variant="outline" onClick={() => { setReviewOpen(false); setStarted(false); setElapsed(0); refreshHistory(); }} className="w-auto"><RotateCcw className="mr-2 size-4" />Volver al historial</Button></div>}
    </CardContent>
  </Card>;
}

function Choice({ children, selected, onClick }: { children: string; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`rounded-full border px-3 py-2 text-sm transition-colors ${selected ? "border-[#235c50] bg-[#235c50] text-white" : "border-slate-300 text-slate-700 hover:border-[#235c50]"}`}>{children}</button>;
}
