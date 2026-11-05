import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, ImagePlus, Music2, Pause, Play, RotateCcw, Square } from "lucide-react";
import type { User } from "../api/auth";
import { listMemories } from "../api/memories";
import type { Memory } from "../api/memories";
import { getLocalFamilyPhotos } from "../api/localMedia";
import type { LocalFamilyPhoto } from "../api/localMedia";
import { saveSessionFeedback } from "../api/sessionFeedback";
import type { SessionExperience, SessionFeeling } from "../api/sessionFeedback";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

interface SessionGuideProps {
  currentUser: User;
  onOpenMemories: () => void;
}

const DURATION_SECONDS = 15 * 60;

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [photos, setPhotos] = useState<LocalFamilyPhoto[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [anecdoteId, setAnecdoteId] = useState("");
  const [songId, setSongId] = useState("");
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [feeling, setFeeling] = useState<SessionFeeling | "">("");
  const [experience, setExperience] = useState<SessionExperience | "">("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const songs = useMemo(() => memories.filter((memory) => memory.type === "song"), [memories]);
  const anecdotes = useMemo(() => memories.filter((memory) => memory.type === "anecdote"), [memories]);
  const sessionPhotos = useMemo(() => photos.filter((photo) => selectedPhotoIds.includes(photo.id)), [photos, selectedPhotoIds]);
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
      setSelectedPhotoIds(localPhotos.map((photo) => photo.id));
      setMemories(response.items);
      const firstAnecdote = response.items.find((memory) => memory.type === "anecdote");
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

  const begin = () => { setStarted(true); setPaused(false); setElapsed(0); setStep(0); setReviewOpen(false); setSaved(false); };
  const finish = () => { setStarted(false); setPaused(false); setReviewOpen(true); };

  const saveReview = () => {
    if (!feeling || !experience) return;
    saveSessionFeedback({
      id: crypto.randomUUID(), family_id: currentUser.family_id, user_id: currentUser.id,
      user_name: currentUser.name, feeling, experience, note: note.trim(),
      duration_seconds: elapsed, created_at: new Date().toISOString(),
    });
    setSaved(true);
  };

  const steps = [
    { title: "Miren una imagen", description: "Muestra una imagen a la vez. Deja que la persona la observe y decida qué le gustaría contar.", prompt: "¿Qué detalle te llama la atención?" },
    { title: "Conversen sin apuro", description: selectedAnecdote ? `Pueden partir de “${selectedAnecdote.title}”. No hace falta recordar todo ni responder de una forma determinada.` : "Usa una pregunta sencilla. Si no quiere responder, pueden escuchar o pasar a otra actividad.", prompt: "¿Qué te gustaría contar de ese momento?" },
    { title: "Escuchen una canción", description: selectedSong ? `Reproduzcan “${selectedSong.title}” y conversen si la música invita a hacerlo.` : "Todavía no hay canciones guardadas. Pueden saltar este paso o agregar un enlace en Subir recuerdos.", prompt: "¿Qué te hace sentir escucharla?" },
    { title: "Cierren a su ritmo", description: "Agradece el momento compartido. Si hay cansancio o incomodidad, terminen antes; no es necesario completar todos los pasos.", prompt: "¿Prefieres seguir conversando o descansar?" },
  ];

  return <Card className="overflow-hidden border-0 bg-white shadow-none">
    <CardHeader className="px-0 pb-5">
      <p className="text-sm font-semibold text-[#e76f51]">Un momento en familia</p>
      <CardTitle className="text-2xl font-semibold text-[#2c5f7c]">Guía de sesión</CardTitle>
      <CardDescription className="max-w-2xl text-sm leading-relaxed text-slate-600">Una conversación breve que se adapta a sus recuerdos. Pueden saltar preguntas, cambiar de tema o detenerse cuando quieran.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6 px-0">
      {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-red-700"><span>{loadError}</span><button onClick={() => window.location.reload()} className="font-semibold underline">Volver a cargar</button></div>}

      {!started && !reviewOpen && <>
        <section className="space-y-4" aria-labelledby="prepare-session">
          <div><h2 id="prepare-session" className="text-lg font-semibold text-[#264653]">Preparen el momento</h2><p className="mt-1 text-sm text-slate-600">Duración sugerida: hasta 15 minutos. Tengan a mano las imágenes o canciones que la familia guardó.</p></div>
          {loading ? <p role="status" className="text-sm text-slate-500">Buscando recuerdos…</p> : <div className="grid gap-5 sm:grid-cols-2">
            <div><div className="flex items-center justify-between gap-2"><h3 className="font-medium text-[#2c5f7c]">Imágenes disponibles</h3><span className="text-xs text-slate-500">{photos.length}</span></div>
              {photos.length ? <PhotoCarousel photos={photos} index={photoIndex} onChange={setPhotoIndex} /> : <div className="py-4"><p className="text-sm text-slate-500">Aún no hay fotos guardadas aquí.</p><button onClick={onOpenMemories} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#e76f51]"><ImagePlus className="size-4" />Agregar fotos</button></div>}
              {photos.length > 1 && <fieldset className="mt-3 space-y-2"><legend className="text-xs font-semibold text-slate-600">Elige las fotos para esta sesión</legend><div className="max-h-32 space-y-1 overflow-y-auto">{photos.map((photo) => <label key={photo.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={selectedPhotoIds.includes(photo.id)} onChange={(event) => { setSelectedPhotoIds((value) => event.target.checked ? [...value, photo.id] : value.filter((id) => id !== photo.id)); setPhotoIndex(0); }} />{photo.name}</label>)}</div></fieldset>}
            </div>
            <div><div className="flex items-center justify-between gap-2"><h3 className="font-medium text-[#2c5f7c]">Canción para escuchar</h3><Music2 className="size-4 text-[#e76f51]" /></div>
              {songs.length ? <><label htmlFor="session-song" className="sr-only">Elegir canción</label><select id="session-song" value={selectedSong?.id ?? ""} onChange={(event) => setSongId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#264653]">{songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select>{selectedSong && <MusicPlayer memory={selectedSong} />}</> : <div className="py-4"><p className="text-sm text-slate-500">Todavía no hay canciones disponibles.</p><button onClick={onOpenMemories} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#e76f51]"><Music2 className="size-4" />Agregar una canción</button></div>}
            </div>
          </div>}
          {anecdotes.length > 0 && <label className="block max-w-xl text-sm font-medium text-[#264653]">Anécdota para conversar<select value={selectedAnecdote?.id ?? ""} onChange={(event) => setAnecdoteId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">{anecdotes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
          {anecdotes.length > 0 && <p className="text-sm text-slate-600">También hay {anecdotes.length} {anecdotes.length === 1 ? "anécdota familiar guardada" : "anécdotas familiares guardadas"} que pueden usar como tema.</p>}
          <p className="text-xs leading-relaxed text-slate-500">La guía es una ayuda para conversar, no una evaluación clínica. Si una imagen o tema incomoda, ciérrenlo y elijan otra cosa.</p>
          <Button onClick={begin} disabled={loading} variant="secondary" className="w-auto px-5">Comenzar cuando estén listos</Button>
        </section>
      </>}

      {started && <section className="space-y-5" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-semibold text-[#e76f51]">Paso {step + 1} de {steps.length}</p><h2 className="text-xl font-semibold text-[#2c5f7c]">{steps[step].title}</h2></div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600"><Clock3 className="size-4 text-[#2c5f7c]" />{formatTime(elapsed)} / 15:00</div>
        </div>
        <Progress value={Math.min(100, elapsed / DURATION_SECONDS * 100)} className="h-1.5" />
        {step === 0 && sessionPhotos.length > 0 && <PhotoCarousel photos={sessionPhotos} index={photoIndex % sessionPhotos.length} onChange={setPhotoIndex} large />}
        {step === 0 && sessionPhotos.length === 0 && <p className="py-4 text-sm text-slate-600">No eligieron imágenes para este momento. Pueden continuar con una anécdota o cambiar la selección.</p>}
        {step === 2 && selectedSong && <MusicPlayer memory={selectedSong} />}
        {step === 2 && !selectedSong && <button onClick={onOpenMemories} className="inline-flex items-center gap-2 text-sm font-semibold text-[#e76f51]"><Music2 className="size-4" />Ir a Subir recuerdos</button>}
        <p className="text-base leading-relaxed text-slate-700">{steps[step].description}</p>
        <div className="py-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Una pregunta posible</p><p className="mt-1 text-lg font-medium text-[#264653]">{steps[step].prompt}</p></div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} className="w-auto"><ArrowLeft className="mr-2 size-4" />Anterior</Button>
            {step < steps.length - 1 && <Button type="button" variant="outline" onClick={() => setStep((value) => value + 1)} className="w-auto">Siguiente<ArrowRight className="ml-2 size-4" /></Button>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setPaused((value) => !value)} className="w-auto">{paused ? <><Play className="mr-2 size-4" />Continuar</> : <><Pause className="mr-2 size-4" />Pausar</>}</Button>
            <Button type="button" variant="secondary" onClick={finish} className="w-auto"><Square className="mr-2 size-4" />Terminar</Button>
          </div>
        </div>
        {paused && <p role="status" className="text-sm text-slate-500">La sesión está en pausa. No hay apuro para continuar.</p>}
        {elapsed >= DURATION_SECONDS && <p role="status" className="text-sm text-slate-600">Ya pasaron 15 minutos. Pueden cerrar la actividad o continuar si les resulta agradable.</p>}
      </section>}

      {reviewOpen && !saved && <section className="max-w-2xl space-y-5">
        <div><p className="text-sm font-semibold text-[#e76f51]">Al terminar</p><h2 className="text-xl font-semibold text-[#2c5f7c]">¿Cómo les fue?</h2><p className="mt-1 text-sm text-slate-600">Este registro es una nota familiar sobre la actividad, no un diagnóstico.</p></div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium text-[#264653]">¿Cómo se sintió tu familiar?</legend><div className="flex flex-wrap gap-2">{([["content", "A gusto"], ["calm", "Tranquilo/a"], ["tired", "Cansado/a"], ["no_answer", "Prefirió no decir"]] as const).map(([value, label]) => <Choice key={value} selected={feeling === value} onClick={() => setFeeling(value)}>{label}</Choice>)}</div></fieldset>
        <fieldset className="space-y-2"><legend className="text-sm font-medium text-[#264653]">¿Cómo resultó la actividad?</legend><div className="flex flex-wrap gap-2">{([["comfortable", "Cómoda"], ["mixed", "Con pausas"], ["paused", "Preferimos parar"]] as const).map(([value, label]) => <Choice key={value} selected={experience === value} onClick={() => setExperience(value)}>{label}</Choice>)}</div></fieldset>
        <label htmlFor="session-note" className="block text-sm font-medium text-[#264653]">Nota para la familia (opcional)</label><textarea id="session-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="¿Qué tema le interesó? ¿Qué prefieren hacer la próxima vez?" className="min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-[#264653] focus:outline-none focus:ring-2 focus:ring-[#2c5f7c]" />
        <div className="flex flex-wrap gap-3"><Button disabled={!feeling || !experience} onClick={saveReview} variant="secondary" className="w-auto"><Check className="mr-2 size-4" />Guardar reseña</Button><Button variant="outline" onClick={() => { setReviewOpen(false); setStarted(false); }} className="w-auto">Omitir</Button></div>
      </section>}

      {reviewOpen && saved && <div className="space-y-3 py-6" role="status"><Check className="size-6 text-[#2c5f7c]" /><h2 className="text-xl font-semibold text-[#2c5f7c]">Reseña guardada</h2><p className="text-sm text-slate-600">Gracias por registrar cómo fue este momento para su familia.</p><Button variant="outline" onClick={() => { setReviewOpen(false); setStarted(false); setElapsed(0); }} className="w-auto"><RotateCcw className="mr-2 size-4" />Volver a la guía</Button></div>}
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
