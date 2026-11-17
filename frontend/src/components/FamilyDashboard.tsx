import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Image, Music2, Share2, Users, Clock3, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { User } from "../api/auth";
import { getFamilyMembers } from "../api/families";
import type { Member } from "../api/families";
import { listMemories, listPhotosForMemories } from "../api/memories";
import type { FamilyMemoryPhoto, Memory } from "../api/memories";
import { getFamilySessionFeedback } from "../api/sessionFeedback";
import type { SessionFeedback } from "../api/sessionFeedback";
import { Button } from "./ui/button";
import { ReactionHistory } from "./ReactionHistory";

interface FamilyDashboardProps {
  currentUser: User;
  onOpenMemories: () => void;
  onOpenSession: () => void;
}

const feelingLabels = { content: "A gusto", calm: "Tranquilo/a", tired: "Cansado/a", no_answer: "Prefirió no decir" };

export function FamilyDashboard({ currentUser, onOpenMemories, onOpenSession }: FamilyDashboardProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [photos, setPhotos] = useState<FamilyMemoryPhoto[]>([]);
  const [feedback, setFeedback] = useState<SessionFeedback[]>([]);
  const [selectedMember, setSelectedMember] = useState("all");
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(7);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const [memberResult, memoryResult] = await Promise.all([
          getFamilyMembers(), listMemories({ include_sensitive: false, limit: 100, offset: 0 }),
        ]);
        if (!active) return;
        const photoResult = await listPhotosForMemories(memoryResult.items);
        if (!active) return;
        setMembers(memberResult.items);
        setMemories(memoryResult.items);
        setPhotos(photoResult);
        setFeedback(getFamilySessionFeedback(currentUser.family_id));
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "No pudimos cargar el resumen familiar.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [currentUser.family_id]);

  const people = useMemo(() => {
    const result = [...members];
    if (!result.some((person) => person.id === currentUser.id)) result.unshift({ id: currentUser.id, name: currentUser.name, role: currentUser.role });
    return result;
  }, [members, currentUser]);

  const visibleMemories = selectedMember === "all" ? memories : memories.filter((item) => item.created_by === selectedMember);
  const visiblePhotos = selectedMember === "all" ? photos : photos.filter((item) => item.created_by === selectedMember);
  const dashboardPhotos = visiblePhotos.map((photo) => ({
    ...photo,
    memory: memories.find((item) => item.id === photo.memory_id),
  }));
  useEffect(() => {
    if (dashboardPhotos.length < 2) return;
    const timer = window.setInterval(() => setPhotoIndex((index) => (index + 1) % dashboardPhotos.length), 5000);
    return () => window.clearInterval(timer);
  }, [dashboardPhotos.length]);
  useEffect(() => { setPhotoIndex(0); }, [selectedMember]);
  const visibleFeedback = selectedMember === "all" ? feedback : feedback.filter((item) => item.user_id === selectedMember);
  const ownContributionCount = memories.filter((item) => item.created_by === currentUser.id).length + photos.filter((item) => item.created_by === currentUser.id).length;
  const recentWeek = visibleFeedback.filter((item) => Date.now() - new Date(item.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const recentNotes = recentWeek.filter((item) => item.note.trim());
  const recentPauses = recentWeek.filter((item) => item.experience === "paused" || item.feeling === "tired").length;
  const weeklyFeelings = Object.entries(feelingLabels).map(([key, label]) => ({ key, label, count: recentWeek.filter((item) => item.feeling === key).length }));
  const maxFeelingCount = Math.max(1, ...weeklyFeelings.map((item) => item.count));
  const bucketCount = periodDays === 7 ? 7 : periodDays === 30 ? 5 : 13;
  const rangeStart = new Date(); rangeStart.setHours(0, 0, 0, 0); rangeStart.setDate(rangeStart.getDate() - (periodDays - 1));
  const bucketSize = periodDays / bucketCount;
  const durationBuckets = Array.from({ length: bucketCount }, (_, index) => {
    const start = new Date(rangeStart.getTime() + index * bucketSize * 86400000);
    const end = new Date(rangeStart.getTime() + (index + 1) * bucketSize * 86400000);
    const entries = visibleFeedback.filter((item) => { const created = new Date(item.created_at); return created >= start && created < end; });
    const minutes = Math.round(entries.reduce((sum, item) => sum + item.duration_seconds, 0) / 60);
    const label = periodDays === 7 ? start.toLocaleDateString("es-PE", { weekday: "short" }) : start.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
    return { start, end, minutes, count: entries.length, label };
  });
  const maxMinutes = Math.max(5, Math.ceil(Math.max(...durationBuckets.map((item) => item.minutes)) / 5) * 5);
  const chartPoints = durationBuckets.map((item, index) => {
    const x = 80 + index * (770 / Math.max(1, durationBuckets.length - 1));
    return `${x},${250 - item.minutes / maxMinutes * 180}`;
  }).join(" ");
  const leaders = Object.entries(visibleFeedback.reduce<Record<string, number>>((counts, item) => { counts[item.user_id] = (counts[item.user_id] ?? 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1]);
  const memberContributions = people.map((person) => ({ id: person.id, name: person.name, count: visibleMemories.filter((item) => item.created_by === person.id).length + visiblePhotos.filter((item) => item.created_by === person.id).length })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
  const maxContribution = Math.max(1, ...memberContributions.map((item) => item.count));
  const memoryMix = [
    { label: "Anécdotas", count: visibleMemories.filter((item) => item.type === "anecdote").length, color: "#e76f51" },
    { label: "Canciones", count: visibleMemories.filter((item) => item.type === "song").length, color: "#e9b85c" },
    { label: "Fotos", count: visiblePhotos.length, color: "#2c5f7c" },
  ];
  const memoryMixTotal = memoryMix.reduce((total, item) => total + item.count, 0);

  const activity = [
    ...visibleMemories.map((item) => ({ id: `memory-${item.id}`, creatorId: item.created_by, title: item.title, kind: item.type === "song" ? "Canción compartida" : "Anécdota compartida", date: item.created_at, icon: item.type === "song" ? "music" : "book" })),
    ...visiblePhotos.map((item) => ({ id: `photo-${item.id}`, creatorId: item.created_by, title: memories.find((memory) => memory.id === item.memory_id)?.title ?? "Foto familiar", kind: "Foto compartida", date: item.created_at, icon: "image" })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const nameFor = (id: string) => people.find((person) => person.id === id)?.name ?? (id === currentUser.id ? currentUser.name : "Familiar");

  return (
    <div className="dashboard-page space-y-8 text-[#264653]">
      <header className="dashboard-intro">
        <div className="dashboard-intro-copy">
          <p className="text-sm font-semibold text-[#e76f51]">EL CAMINO DE SU FAMILIA</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2c5f7c]">Pequeños momentos, vistos en conjunto</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Revisa lo que han compartido, el tiempo de sus encuentros y cómo participa cada familiar. Las reseñas de duración y sensaciones se guardan en este navegador.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onOpenMemories}>Recuerdos</Button>
            <Button onClick={onOpenSession} className="bg-[#e76f51] hover:bg-[#d95f43]">Abrir guía <ArrowRight className="ml-2 size-4" /></Button>
          </div>
        </div>
        <div className="dashboard-photo-hero" aria-label="Fotografías compartidas por la familia" aria-roledescription="carrusel">
          {dashboardPhotos.length ? <>
            {dashboardPhotos.map((photo, index) => <figure className="dashboard-photo-slide" key={photo.id} aria-hidden={index !== photoIndex}>
              <img src={photo.url} alt={photo.memory?.title ? `Foto familiar: ${photo.memory.title}` : "Foto compartida por la familia"} loading={index === photoIndex ? "eager" : "lazy"} />
              <figcaption><span className="dashboard-photo-caption-label">{photo.memory?.type === "song" ? "Una canción que los reúne" : "Un recuerdo de la familia"}</span><strong>{photo.memory?.title ?? "Un momento para recordar"}</strong><span>{nameFor(photo.created_by)} · {new Date(photo.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "long" })}</span></figcaption>
            </figure>)}
            <div className="dashboard-photo-controls" aria-label="Controles de fotografías">
              <button type="button" aria-label="Foto anterior" disabled={dashboardPhotos.length < 2} onClick={() => setPhotoIndex((index) => (index - 1 + dashboardPhotos.length) % dashboardPhotos.length)}><ChevronLeft size={20}/></button>
              <div className="dashboard-photo-dots" aria-live="polite" aria-label={`Foto ${photoIndex + 1} de ${dashboardPhotos.length}`}>{dashboardPhotos.map((photo, index) => <button type="button" key={photo.id} aria-label={`Ver foto ${index + 1}`} aria-current={index === photoIndex} onClick={() => setPhotoIndex(index)} />)}</div>
              <button type="button" aria-label="Foto siguiente" disabled={dashboardPhotos.length < 2} onClick={() => setPhotoIndex((index) => (index + 1) % dashboardPhotos.length)}><ChevronRight size={20}/></button>
            </div>
          </> : <div className="dashboard-photo-empty"><Image size={29}/><p>{loading ? "Cargando las fotos de la familia…" : "Las fotos que compartan aparecerán aquí para recorrerlas juntos."}</p>{!loading && <button type="button" onClick={onOpenMemories}>Agregar un recuerdo <ArrowRight size={16}/></button>}</div>}
        </div>
      </header>

      {loadError && <p role="alert" className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError} Puedes actualizar la página para volver a intentar.</p>}

      <ReactionHistory familyId={currentUser.family_id} />

      <section aria-label="Panorama familiar" className="dashboard-metrics grid gap-5 sm:grid-cols-3">
        <Metric icon={<Users/>} label="Tus aportes" value={loading ? "…" : ownContributionCount} detail="Recuerdos y fotos que sumaste" />
        <Metric icon={<BookOpen/>} label="Álbum familiar" value={loading ? "…" : visibleMemories.length + visiblePhotos.length} detail="Historias, canciones y fotografías" />
        <Metric icon={<Clock3/>} label="Encuentros registrados" value={loading ? "…" : visibleFeedback.length} detail="Sesiones con reseña guardada" />
      </section>

      <section className="dashboard-memory-mix" aria-label="Contenido del álbum familiar">
        <div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">LO QUE ESTÁN REUNIENDO</p><h2>El álbum toma forma</h2></div><span>{memoryMixTotal} {memoryMixTotal === 1 ? "recuerdo" : "recuerdos"}</span></div>
        {memoryMixTotal ? <>
          <div className="dashboard-mix-bar" role="img" aria-label={memoryMix.map((item) => `${item.label}: ${item.count}`).join(", ")}>
            {memoryMix.filter((item) => item.count).map((item) => <span key={item.label} style={{ width: `${item.count / memoryMixTotal * 100}%`, backgroundColor: item.color }} />)}
          </div>
          <ul className="dashboard-mix-legend">{memoryMix.map((item) => <li key={item.label}><span style={{ backgroundColor: item.color }}/><span>{item.label}</span><strong>{item.count}</strong></li>)}</ul>
        </> : <p className="dashboard-empty-note">Cuando compartan anécdotas, canciones o fotos, aquí verán cómo va creciendo el álbum.</p>}
      </section>

      <section className="dashboard-member-filter flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-semibold">Aportes de la familia</h2><p className="mt-1 text-sm text-slate-600">Consulta quién compartió cada recuerdo.</p></div>
        <label className="flex items-center gap-3 text-sm font-medium">Ver aportes de
          <select value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[#264653]">
            <option value="all">Toda la familia</option>
            {people.map((person) => <option value={person.id} key={person.id}>{person.id === currentUser.id ? `${person.name} (tú)` : person.name}</option>)}
          </select>
        </label>
      </section>

      <section className="dashboard-insights-grid" aria-label="Gráficas de actividad familiar">
        <div className="min-w-0">
          <div className="dashboard-section-heading dashboard-duration-heading"><div><p className="dashboard-eyebrow">TIEMPO COMPARTIDO</p><h2>Duración de los encuentros</h2><p>Minutos registrados al terminar cada sesión.</p></div><label className="dashboard-period-filter"><CalendarDays size={17}/><span className="sr-only">Periodo de actividad</span><select aria-label="Periodo de actividad" value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value) as 7 | 30 | 90)}><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select></label></div>
          {durationBuckets.some((item) => item.count > 0) ? <div className="dashboard-chart" role="img" aria-label={`Duración en minutos para ${periodDays} días. ${durationBuckets.map((item) => `${item.label}: ${item.minutes} minutos`).join(". ")}`}>
            <svg viewBox="0 0 900 320" className="w-full" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((tick) => { const y = 250 - tick * 45; const value = Math.round(maxMinutes * tick / 4); return <g key={tick}><line x1="76" y1={y} x2="850" y2={y} stroke={tick === 0 ? "#94a3b8" : "#e2e8f0"} strokeWidth="1"/><text x="62" y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">{value}</text></g>; })}
              <text x="18" y="155" transform="rotate(-90 18 155)" textAnchor="middle" fontSize="13" fill="#475569">Minutos</text>
              <polyline points={chartPoints} fill="none" stroke="#2c5f7c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {durationBuckets.map((item, index) => { const x = 80 + index * (770 / Math.max(1, durationBuckets.length - 1)); const y = 250 - item.minutes / maxMinutes * 180; return <g key={item.start.toISOString()}><circle cx={x} cy={y} r="6" fill="#e76f51"/><text x={x} y={y - 14} textAnchor="middle" fontSize="12" fontWeight="600" fill="#264653">{item.minutes}</text><text x={x} y="275" textAnchor="middle" fontSize={periodDays === 7 ? "12" : "10"} fill="#64748b">{item.label}</text></g>; })}
              <text x="460" y="310" textAnchor="middle" fontSize="13" fill="#475569">Día</text>
            </svg>
          </div> : <div className="dashboard-chart-empty"><Clock3/><p>Aún no hay sesiones registradas en este periodo.</p><span>Al finalizar una sesión, su duración aparecerá aquí.</span></div>}
        </div>
        <div className="dashboard-contributors">
          <p className="dashboard-eyebrow">PARTICIPACIÓN</p><h2>Quién está sumando recuerdos</h2><p className="dashboard-supporting-copy">Aportes visibles según el filtro de familia.</p>
          {memberContributions.length ? <div className="dashboard-contribution-list">{memberContributions.map((item, index) => <div className="dashboard-contribution" key={item.id}><div className="dashboard-contributor-name"><span className={`dashboard-contributor-rank rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span><span>{item.name}</span><strong>{item.count}</strong></div><div className="dashboard-contribution-track"><span style={{ width: `${item.count / maxContribution * 100}%` }}/></div></div>)}</div> : <p className="dashboard-empty-note">Los aportes de cada familiar aparecerán aquí cuando compartan recuerdos.</p>}
        </div>
      </section>

      <section className="dashboard-lower-grid grid gap-10 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#e76f51]">Últimos movimientos</p><h2 className="mt-1 text-xl font-semibold">Recuerdos compartidos</h2></div><button onClick={onOpenMemories} className="text-sm font-semibold text-[#2c5f7c] hover:underline">Ver recuerdos</button></div>
          {activity.length ? <ul className="mt-5 divide-y divide-slate-100">
            {activity.map((item) => <li className="flex gap-4 py-4" key={item.id}>
              <span className="mt-1 text-[#2c5f7c]">{item.icon === "music" ? <Music2 className="size-5" /> : item.icon === "image" ? <Image className="size-5" /> : <BookOpen className="size-5" />}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.kind} · {nameFor(item.creatorId)}</p></div>
              <time className="shrink-0 text-xs text-slate-500" dateTime={item.date}>{new Date(item.date).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</time>
            </li>)}
          </ul> : <p className="mt-5 text-sm text-slate-600">Aún no hay recuerdos para mostrar con este filtro. Invita a la familia a compartir una anécdota, una canción o una foto.</p>}
        </div>

        <div className="space-y-8">
          <section><p className="text-sm font-semibold text-[#e76f51]">Sesiones facilitadas</p><h2 className="mt-1 text-xl font-semibold">Participación en las sesiones</h2>{leaders.length ? <ul className="mt-4 space-y-3">{leaders.map(([userId, count]) => <li className="flex justify-between gap-3 text-sm" key={userId}><span>{nameFor(userId)}</span><span className="font-semibold">{count}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Las sesiones registradas por cada familiar aparecerán aquí.</p>}</section>
          <section>
            <p className="text-sm font-semibold text-[#e76f51]">Últimos 7 días</p><h2 className="mt-1 text-xl font-semibold">¿Cómo se sintieron?</h2>
            <p className="mt-2 text-sm text-slate-600">Resumen de lo que cada familiar indicó al cerrar una sesión; no es una evaluación clínica.</p>
            {recentWeek.length ? <div className="mt-5 space-y-3" aria-label="Reseñas de la semana">
              {weeklyFeelings.filter((item) => item.count > 0).map((item) => <div key={item.key} className="grid grid-cols-[110px_1fr_24px] items-center gap-3 text-sm"><span>{item.label}</span><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-[#2c5f7c]" style={{ width: `${Math.max(6, item.count / maxFeelingCount * 100)}%` }} /></div><span className="text-right text-slate-600">{item.count}</span></div>)}
            </div> : <p className="mt-5 text-sm text-slate-600">Todavía no hay reseñas esta semana. Al finalizar una guía, cualquier familiar puede compartir cómo vivió la actividad.</p>}
            {recentNotes.length > 0 && <ul className="mt-5 space-y-3" aria-label="Comentarios recientes de la familia">{recentNotes.slice(0, 3).map((item) => <li key={item.id} className="border-l-2 border-[#e76f51] bg-[#fff5ef] px-4 py-3"><p className="text-sm leading-relaxed text-slate-700">“{item.note}”</p><p className="mt-2 text-xs text-slate-500">{item.user_name} · {new Date(item.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</p></li>)}</ul>}
          </section>

          <section className="border-l-2 border-[#f4a261] pl-4">
            <h3 className="font-semibold">Pausas y comodidad</h3>
            {recentPauses ? <p className="mt-2 text-sm text-slate-600">La familia registró {recentPauses} {recentPauses === 1 ? "actividad" : "actividades"} con cansancio o pausa. Consideren una actividad más breve o dejarla para otro momento.</p> : <p className="mt-2 text-sm text-slate-600">Si una actividad no resulta cómoda, pueden pausarla o cambiar de tema. Aquí aparecerán las pausas que la familia registre.</p>}
          </section>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 text-sm text-slate-500"><span><Users className="mr-2 inline size-4" />Un resumen para que la familia acompañe y comparta recuerdos.</span><a className="inline-flex items-center gap-2 font-semibold text-[#2c5f7c] hover:underline" href={`https://wa.me/?text=${encodeURIComponent(`Avance de nuestra familia en Ayni: ${visibleMemories.length + visiblePhotos.length} recuerdos compartidos y ${visibleFeedback.length} sesiones registradas.`)}`} target="_blank" rel="noopener noreferrer"><Share2 className="size-4" />Compartir progreso por WhatsApp</a></footer>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: number | string; detail: string }) {
  return <div className="dashboard-metric"><div className="dashboard-metric-icon" aria-hidden="true">{icon}</div><p className="text-sm font-semibold text-slate-600">{label}</p><p className="dashboard-metric-value">{value}</p><p className="mt-2 text-sm text-slate-500">{detail}</p></div>;
}
