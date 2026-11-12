import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, Check, Play, RotateCcw } from "lucide-react";
import type { User } from "../api/auth";
import { listMemories, getMemory } from "../api/memories";
import type { Memory } from "../api/memories";
import { getLocalFamilyPhotos } from "../api/localMedia";
import type { LocalFamilyPhoto } from "../api/localMedia";
import { saveSessionFeedback } from "../api/sessionFeedback";
import type { SessionExperience, SessionFeeling } from "../api/sessionFeedback";
import { generateSession, getSession, listSessions } from "../api/sessions";
import type { SavedSession, SessionSummary } from "../api/sessions";
import { GuidedConversation } from "./GuidedConversation";
import { speakLocally } from "./sessionSignals";
import type { SessionActivity } from "./sessionSignals";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

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

function PersistedSessionGuide({ currentUser, onOpenMemories }: SessionGuideProps) {
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
    listSessions(offset).then((page) => {
      if (active) { setHistory(page.items); setTotal(page.total); setHistoryError(""); }
    }).catch((cause: unknown) => { if (active) setHistoryError(cause instanceof Error ? cause.message : "No pudimos cargar el historial."); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [offset, revision]);
  const refreshHistory = (next = offset) => { setHistoryLoading(true); setOffset(next); setRevision((value) => value + 1); };
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [photos, setPhotos] = useState<LocalFamilyPhoto[]>([]);
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
  const [feeling, setFeeling] = useState<SessionFeeling | "">("");
  const [experience, setExperience] = useState<SessionExperience | "">("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const songs = useMemo(() => memories.filter((memory) => memory.type === "song" && memory.is_positive && !memory.is_sensitive), [memories]);
  const anecdotes = useMemo(() => memories.filter((memory) =>
    memory.type === "anecdote" && memory.is_positive && !memory.is_sensitive), [memories]);
  const selectedSong = songs.find((memory) => memory.id === songId) ?? songs[0];
  const selectedAnecdote = anecdotes.find((memory) => memory.id === anecdoteId) ?? anecdotes[0];

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getLocalFamilyPhotos(currentUser.family_id),
      listMemories({ include_sensitive: false, limit: 50, offset: 0 }),
    ]).then(([localPhotos, response]) => {
      if (!active) return;
      setPhotos(localPhotos);
      setMemories(response.items);
      const firstAnecdote = response.items.find((memory) => memory.type === "anecdote" && memory.is_positive && !memory.is_sensitive);
      if (firstAnecdote) setAnecdoteId(firstAnecdote.id);
      const firstSong = response.items.find((memory) => memory.type === "song");
      if (firstSong) setSongId(firstSong.id);
      setLoadError("");
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "No pudimos cargar los recuerdos.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser.family_id]);

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
      const saved = id ? await getSession(id) : await generateSession();
      setGuide(saved);
      refreshHistory(0);
      const ids = [...new Set(saved.steps.filter((item) => item.memory_available && item.memory_id).map((item) => item.memory_id!))];
      const results = await Promise.allSettled(ids.map(getMemory));
      const allowed = results.flatMap((result) => result.status === "fulfilled" && result.value.is_positive && !result.value.is_sensitive && result.value.elder_profile_id === saved.elder_profile_id ? [result.value] : []);
      setMemories(allowed);
      setAnecdoteId(allowed.find((item) => item.type === "anecdote")?.id ?? "");
      setSongId(allowed.find((item) => item.type === "song")?.id ?? "");
      setActivity(allowed[0]?.type ?? (photos.length ? "photo" : undefined));
      setWithDevices(devices);
      setPhotoIndex(0);
      setStarted(true);
      setPaused(false);
      setElapsed(0);
      setReviewOpen(false);
      setSaved(false);
      setFeeling(""); setExperience(""); setNote("");
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "No pudimos abrir la guía."); }
    finally { setBusy(false); }
  }

  function finish(speak: boolean) {
    setStarted(false);
    setPaused(false);
    setReviewVoice(speak);
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

  const saveReview = () => {
    if (!feeling || !experience) return;
    saveSessionFeedback({
      id: crypto.randomUUID(), family_id: currentUser.family_id, user_id: currentUser.id,
      user_name: currentUser.name, feeling, experience, note: note.trim(),
      duration_seconds: elapsed, created_at: new Date().toISOString(),
    });
    setSaved(true);
  };

  const activityTitle = activity === "anecdote" ? selectedAnecdote?.title :
    activity === "photo" ? "Foto familiar" : selectedSong?.title;
  const activityContent = activity === "anecdote" ? (
    <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">{selectedAnecdote?.text}</p>
  ) : activity === "photo" && photos.length ? (
    <PhotoCarousel photos={photos} index={photoIndex} onChange={setPhotoIndex} />
  ) : activity === "song" && selectedSong && !paused ? <MusicPlayer memory={selectedSong} /> : null;

  return <Card className="border-0 bg-white shadow-none">
    {!started && <CardHeader className="px-0 pb-5">
      <CardTitle className="text-2xl font-bold text-[#264653]">Guía de sesión</CardTitle>
      <CardDescription className="max-w-2xl text-base text-slate-600">Conversen a su ritmo con la ayuda de Ayni.</CardDescription>
    </CardHeader>}
    <CardContent className="space-y-6 px-0">
      {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
      {!started && !reviewOpen && <section aria-labelledby="prepare-session" className="max-w-2xl rounded-xl border border-slate-200 bg-[#f5faf8] p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#193745] text-[#f4d784]"><Bot aria-hidden="true" className="size-6" /></div>
          <div>
            <h2 id="prepare-session" className="text-xl font-bold text-[#264653]">Un momento con Ayni</h2>
            <p className="mt-1 text-base text-slate-700">Te haré una pregunta y esperaré tu respuesta. Puedes hablar o escribir a tu ritmo.</p>
          </div>
        </div>
        {loading ? <p role="status" className="mt-5 text-sm text-slate-600">Cargando recuerdos…</p> : <div className="mt-5 space-y-4">
          <p className="text-sm text-slate-700">Ayni usará los recuerdos positivos de esta guía y recordará lo que compartan durante la conversación.</p>
          <button type="button" onClick={onOpenMemories} className="min-h-11 text-sm font-semibold underline">Agregar o revisar mis recuerdos</button>
          <p className="text-sm text-slate-600">Groq recibe el texto de sus respuestas y los recuerdos necesarios para responder. Los mensajes se guardan en el historial familiar. Una foto o captura solo se comparte al pulsar Analizar.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={busy} onClick={() => void begin(true)} className="w-auto gap-2"><Play className="size-4" />Empezar con Ayni</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void begin(false)} className="w-auto">Empezar sin cámara ni micrófono</Button>
          </div>
          <p className="text-sm text-slate-600">Al empezar, tu navegador pedirá permiso para usar la cámara y el micrófono. El dictado y el seguimiento facial se procesan en este dispositivo. Ayni acompaña actividades familiares; no es un servicio de salud.</p>
        </div>}
      </section>}
      {!started && !reviewOpen && <section className="space-y-3" aria-labelledby="saved-guides">
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
        photo={activity === "photo" ? photos[photoIndex % photos.length]?.blob : undefined}
        withDevices={withDevices}
        title={activityTitle ?? "Recuerdo familiar"}
        elapsed={formatTime(elapsed)}
        paused={paused}
        activity={activityContent}
        onPause={() => setPaused(true)}
        onResume={() => setPaused(false)}
        onNextActivity={nextActivity}
        onFinish={finish}
      />}
      {started && <Button variant="outline" onClick={() => { setStarted(false); refreshHistory(); }}>Volver al historial</Button>}

      {reviewOpen && !saved && <section className="max-w-2xl space-y-5">
        <div><p className="text-sm font-semibold text-[#e76f51]">Al terminar</p><h2 className="text-xl font-semibold text-[#2c5f7c]">¿Cómo les fue?</h2><p className="mt-1 text-sm text-slate-600">Este registro es una nota familiar sobre la actividad, no un diagnóstico.</p></div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium text-[#264653]">¿Cómo se sintió tu familiar?</legend><div className="flex flex-wrap gap-2">{([["content", "A gusto"], ["calm", "Tranquilo/a"], ["tired", "Cansado/a"], ["no_answer", "Prefirió no decir"]] as const).map(([value, label]) => <Choice key={value} selected={feeling === value} onClick={() => setFeeling(value)}>{label}</Choice>)}</div></fieldset>
        <fieldset className="space-y-2"><legend className="text-sm font-medium text-[#264653]">¿Cómo resultó la actividad?</legend><div className="flex flex-wrap gap-2">{([["comfortable", "Cómoda"], ["mixed", "Con pausas"], ["paused", "Preferimos parar"]] as const).map(([value, label]) => <Choice key={value} selected={experience === value} onClick={() => setExperience(value)}>{label}</Choice>)}</div></fieldset>
        <label htmlFor="session-note" className="block text-sm font-medium text-[#264653]">Nota para la familia (opcional)</label><textarea id="session-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="¿Qué tema le interesó? ¿Qué prefieren hacer la próxima vez?" className="min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-[#264653] focus:outline-none focus:ring-2 focus:ring-[#2c5f7c]" />
        <div className="flex flex-wrap gap-3"><Button disabled={!feeling || !experience} onClick={saveReview} variant="secondary" className="w-auto"><Check className="mr-2 size-4" />Guardar reseña</Button><Button variant="outline" onClick={() => { setReviewOpen(false); setStarted(false); }} className="w-auto">Omitir</Button></div>
      </section>}

      {reviewOpen && saved && <div className="space-y-3 py-6" role="status"><Check className="size-6 text-[#2c5f7c]" /><h2 className="text-xl font-semibold text-[#2c5f7c]">Reseña guardada en este navegador</h2><p className="text-sm text-slate-600">Gracias por registrar cómo fue este momento para su familia.</p><Button variant="outline" onClick={() => { setReviewOpen(false); setStarted(false); setElapsed(0); }} className="w-auto"><RotateCcw className="mr-2 size-4" />Volver a la guía</Button></div>}
    </CardContent>
  </Card>;
}

function PhotoCarousel({ photos, index, onChange, large = false }: { photos: LocalFamilyPhoto[]; index: number; onChange: (index: number) => void; large?: boolean }) {
  const photo = photos[index % photos.length];
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  if (!photo) return null;
  return <figure className={`mt-3 ${large ? "max-w-2xl" : "max-w-sm"}`}>
    {src && <img src={src} alt={photo.name} className={`w-full rounded-lg object-cover ${large ? "max-h-[420px]" : "aspect-video"}`} />}
    <figcaption className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-600"><span className="truncate">{photo.name}</span><span>{index + 1} / {photos.length}</span></figcaption>
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
