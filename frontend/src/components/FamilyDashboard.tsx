import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Image, Music2, Share2, Users } from "lucide-react";
import type { User } from "../api/auth";
import { getFamilyMembers } from "../api/families";
import type { Member } from "../api/families";
import { listMemories } from "../api/memories";
import type { Memory } from "../api/memories";
import { getLocalFamilyPhotos } from "../api/localMedia";
import type { LocalFamilyPhoto } from "../api/localMedia";
import { getFamilySessionFeedback } from "../api/sessionFeedback";
import type { SessionFeedback } from "../api/sessionFeedback";
import { Button } from "./ui/button";

interface FamilyDashboardProps {
  currentUser: User;
  onOpenMemories: () => void;
  onOpenSession: () => void;
}

const feelingLabels = { content: "A gusto", calm: "Tranquilo/a", tired: "Cansado/a", no_answer: "Prefirió no decir" };

export function FamilyDashboard({ currentUser, onOpenMemories, onOpenSession }: FamilyDashboardProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [photos, setPhotos] = useState<LocalFamilyPhoto[]>([]);
  const [feedback, setFeedback] = useState<SessionFeedback[]>([]);
  const [selectedMember, setSelectedMember] = useState("all");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const [memberResult, memoryResult, photoResult] = await Promise.all([
          getFamilyMembers(), listMemories({ include_sensitive: true, limit: 100, offset: 0 }),
          getLocalFamilyPhotos(currentUser.family_id),
        ]);
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
  const visibleFeedback = selectedMember === "all" ? feedback : feedback.filter((item) => item.user_id === selectedMember);
  const ownContributionCount = memories.filter((item) => item.created_by === currentUser.id).length + photos.filter((item) => item.created_by === currentUser.id).length;
  const recentWeek = visibleFeedback.filter((item) => Date.now() - new Date(item.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const recentPauses = recentWeek.filter((item) => item.experience === "paused" || item.feeling === "tired").length;
  const weeklyFeelings = Object.entries(feelingLabels).map(([key, label]) => ({ key, label, count: recentWeek.filter((item) => item.feeling === key).length }));
  const maxFeelingCount = Math.max(1, ...weeklyFeelings.map((item) => item.count));
  const dailyDurations = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const dayItems = visibleFeedback.filter((item) => { const created = new Date(item.created_at); return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth() && created.getDate() === date.getDate(); });
    return { date, minutes: Math.round(dayItems.reduce((sum, item) => sum + item.duration_seconds, 0) / 60), count: dayItems.length };
  });
  const maxMinutes = Math.max(5, Math.ceil(Math.max(...dailyDurations.map((item) => item.minutes)) / 5) * 5);
  const chartPoints = dailyDurations.map((item, index) => `${80 + index * 120},${250 - item.minutes / maxMinutes * 180}`).join(" ");
  const leaders = Object.entries(visibleFeedback.reduce<Record<string, number>>((counts, item) => { counts[item.user_id] = (counts[item.user_id] ?? 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1]);
  const memberContributions = people.map((person) => ({ name: person.name, count: visibleMemories.filter((item) => item.created_by === person.id).length + visiblePhotos.filter((item) => item.created_by === person.id).length })).filter((item) => item.count > 0);
  const maxContribution = Math.max(1, ...memberContributions.map((item) => item.count));

  const activity = [
    ...visibleMemories.map((item) => ({ id: `memory-${item.id}`, creatorId: item.created_by, title: item.title, kind: item.type === "song" ? "Canción compartida" : "Anécdota compartida", date: item.created_at, icon: item.type === "song" ? "music" : "book" })),
    ...visiblePhotos.map((item) => ({ id: `photo-${item.id}`, creatorId: item.created_by, title: item.name, kind: "Foto compartida", date: item.created_at, icon: "image" })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const nameFor = (id: string) => people.find((person) => person.id === id)?.name ?? (id === currentUser.id ? currentUser.name : "Familiar");

  return (
    <main className="space-y-10 text-[#264653]">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#e76f51]">Tu espacio familiar</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2c5f7c]">Recuerdos que comparten</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Un resumen de los aportes y de cómo la familia vivió sus actividades.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenMemories}>Subir recuerdos</Button>
          <Button onClick={onOpenSession} className="bg-[#e76f51] hover:bg-[#d95f43]">Abrir guía <ArrowRight className="ml-2 size-4" /></Button>
        </div>
      </header>

      {loadError && <p role="alert" className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError} Puedes actualizar la página para volver a intentar.</p>}

      <section aria-label="Resumen familiar" className="grid gap-7 sm:grid-cols-3">
        <Metric label="Aportes tuyos" value={loading ? "…" : ownContributionCount} detail="Recuerdos y fotos aportados por ti" />
        <Metric label="Recuerdos compartidos" value={loading ? "…" : visibleMemories.length + visiblePhotos.length} detail="Anécdotas, canciones y fotos disponibles" />
        <Metric label="Reseñas de sesiones" value={loading ? "…" : visibleFeedback.length} detail="Registradas por la familia" />
      </section>

      <section className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-semibold">Aportes de la familia</h2><p className="mt-1 text-sm text-slate-600">Consulta quién compartió cada recuerdo.</p></div>
        <label className="flex items-center gap-3 text-sm font-medium">Ver aportes de
          <select value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[#264653]">
            <option value="all">Toda la familia</option>
            {people.map((person) => <option value={person.id} key={person.id}>{person.id === currentUser.id ? `${person.name} (tú)` : person.name}</option>)}
          </select>
        </label>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.5fr_.8fr]" aria-label="Gráficas de actividad familiar">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#e76f51]">Actividad familiar · últimos 7 días</p><h2 className="mt-1 text-xl font-semibold">Duración de las sesiones</h2>
          <p className="mt-2 text-sm text-slate-600">Cada punto muestra los minutos conversados ese día.</p>
          {dailyDurations.some((item) => item.count > 0) ? <div className="mt-4 w-full overflow-x-auto" role="img" aria-label={`Duración diaria en minutos. ${dailyDurations.map((item) => `${item.date.toLocaleDateString("es-PE", { weekday: "long" })}: ${item.minutes} minutos`).join(". ")}`}>
            <svg viewBox="0 0 900 320" className="min-w-[640px] w-full" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((tick) => { const y = 250 - tick * 45; const value = Math.round(maxMinutes * tick / 4); return <g key={tick}><line x1="76" y1={y} x2="850" y2={y} stroke={tick === 0 ? "#94a3b8" : "#e2e8f0"} strokeWidth="1"/><text x="62" y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">{value}</text></g>; })}
              <text x="18" y="155" transform="rotate(-90 18 155)" textAnchor="middle" fontSize="13" fill="#475569">Minutos</text>
              <polyline points={chartPoints} fill="none" stroke="#2c5f7c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {dailyDurations.map((item, index) => { const x = 80 + index * 120; const y = 250 - item.minutes / maxMinutes * 180; return <g key={item.date.toISOString()}><circle cx={x} cy={y} r="6" fill="#e76f51"/><text x={x} y={y - 14} textAnchor="middle" fontSize="12" fontWeight="600" fill="#264653">{item.minutes}</text><text x={x} y="275" textAnchor="middle" fontSize="12" fill="#64748b">{item.date.toLocaleDateString("es-PE", { weekday: "short" })}</text></g>; })}
              <text x="460" y="310" textAnchor="middle" fontSize="13" fill="#475569">Día</text>
            </svg>
          </div> : <div className="mt-5 flex min-h-52 items-center justify-center text-center text-sm text-slate-500">Al cerrar sesiones con una reseña, aquí aparecerán los minutos por día.</div>}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#e76f51]">Participación</p><h2 className="mt-1 text-xl font-semibold">Aportes por familiar</h2><p className="mt-2 text-sm text-slate-600">Recuerdos y fotos compartidos.</p>
          {memberContributions.length ? <div className="mt-6 space-y-5">{memberContributions.map((item) => <div key={item.name}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{item.name}</span><span className="font-semibold">{item.count}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#e9c46a]" style={{ width: `${item.count / maxContribution * 100}%` }} /></div></div>)}</div> : <p className="mt-5 text-sm text-slate-500">Los aportes aparecerán cuando la familia comparta recuerdos.</p>}
        </div>
      </section>

      <section className="grid gap-10 lg:grid-cols-[1.1fr_.9fr]">
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
          </section>

          <section className="border-l-2 border-[#e9c46a] pl-4">
            <h3 className="font-semibold">Pausas y comodidad</h3>
            {recentPauses ? <p className="mt-2 text-sm text-slate-600">La familia registró {recentPauses} {recentPauses === 1 ? "actividad" : "actividades"} con cansancio o pausa. Consideren una actividad más breve o dejarla para otro momento.</p> : <p className="mt-2 text-sm text-slate-600">Si una actividad no resulta cómoda, pueden pausarla o cambiar de tema. Aquí aparecerán las pausas que la familia registre.</p>}
          </section>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 text-sm text-slate-500"><span><Users className="mr-2 inline size-4" />Un resumen para que la familia acompañe y comparta recuerdos.</span><a className="inline-flex items-center gap-2 font-semibold text-[#2c5f7c] hover:underline" href={`https://wa.me/?text=${encodeURIComponent(`Avance de nuestra familia en Ayni: ${visibleMemories.length + visiblePhotos.length} recuerdos compartidos y ${visibleFeedback.length} sesiones registradas.`)}`} target="_blank" rel="noopener noreferrer"><Share2 className="size-4" />Compartir progreso por WhatsApp</a></footer>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return <div className="border-l-2 border-[#e9c46a] pl-5"><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-2 text-4xl font-bold tracking-tight text-[#2c5f7c]">{value}</p><p className="mt-2 text-sm text-slate-500">{detail}</p></div>;
}
