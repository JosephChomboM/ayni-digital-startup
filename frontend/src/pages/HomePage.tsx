import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Users,
  AlertTriangle,
  Bell,
  Music2,
  Share2,
} from "lucide-react";
import { getElderProfile, getFamilyMembers, getMyFamily } from "../api/families";
import type { ElderProfile, Family } from "../api/families";
import type { User } from "../api/auth";
import { ApiError } from "../api/client";
import { BillingPanel } from "../components/BillingPanel";
import { listMemories } from "../api/memories";
import type { Memory } from "../api/memories";
import type { Member } from "../api/families";
import { getLocalFamilyPhotos } from "../api/localMedia";
import { getFamilySessionFeedback } from "../api/sessionFeedback";

interface HomePageProps {
  currentUser: User;
  onStartSession: () => void;
  onViewMemories: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  currentUser,
  onStartSession,
  onViewMemories,
}) => {
  const [elderProfile, setElderProfile] = useState<ElderProfile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [recentMemories, setRecentMemories] = useState<Memory[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [recentSessions, setRecentSessions] = useState<ReturnType<typeof getFamilySessionFeedback>>([]);
  const [shareNotice, setShareNotice] = useState<{ id: string; date: string } | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      const [familyResult, profileResult, memoriesResult, photosResult, membersResult] = await Promise.allSettled([
        getMyFamily(), getElderProfile(), listMemories({ include_sensitive: false, limit: 100 }),
        getLocalFamilyPhotos(currentUser.family_id),
        getFamilyMembers(),
      ]);
      if (familyResult.status === "fulfilled") setFamily(familyResult.value);
      if (profileResult.status === "fulfilled") setElderProfile(profileResult.value);
      else if (profileResult.reason instanceof ApiError && profileResult.reason.code === "elder_profile_not_found") setElderProfile(null);
      if (memoriesResult.status === "fulfilled" && photosResult.status === "fulfilled") setMemoryCount(memoriesResult.value.items.length + photosResult.value.length);
      if (memoriesResult.status === "fulfilled") setRecentMemories(memoriesResult.value.items);
      if (membersResult.status === "fulfilled") { setMemberCount(membersResult.value.items.length); setMembers(membersResult.value.items); }
      const feedback = getFamilySessionFeedback(currentUser.family_id);
      const week = feedback.filter((item) => Date.now() - new Date(item.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000);
      setSessionCount(week.length);
      setRecentSessions(week.slice(0, 3));
      setLoading(false);
    }

    loadDashboardData();
  }, [currentUser.family_id]);

  const elderDisplayName = elderProfile?.name || "tu familiar";
  const familyDisplayName = family?.name || "Familia";
  const familyName = familyDisplayName.replace(/^familia\s+/i, "");

  const quickSessions = [
    { title: "Fotos de su época de trabajo", description: "Miren imágenes juntos y conversen sobre los lugares y personas que aparecen." },
    { title: "Música criolla", description: "Escuchen una canción conocida y den tiempo para compartir lo que les recuerda." },
    { title: "Historias de viajes", description: "Inviten a recordar un paseo, una visita o un lugar importante para la familia." },
  ];

  const handleShareWhatsApp = () => {
    const mensaje = encodeURIComponent(
      `Te invito a unirte al grupo de ${familyDisplayName} en Ayni Digital para compartir recuerdos con ${elderDisplayName}.`
    );
    window.open(`https://wa.me/?text=${mensaje}`, "_blank");
  };

  const handleShareProgress = () => {
    const mensaje = encodeURIComponent(`Avance de ${familyDisplayName} en Ayni Digital: ${memoryCount ?? 0} recuerdos disponibles y ${sessionCount ?? 0} sesiones registradas esta semana. Seguimos compartiendo momentos con ${elderDisplayName}.`);
    window.open(`https://wa.me/?text=${mensaje}`, "_blank");
    setShareNotice({ id: crypto.randomUUID(), date: new Date().toISOString() });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <div className="w-10 h-10 border-4 border-[#2c5f7c] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-[#264653] font-semibold">Organizando el entorno de Ayni Digital...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* 1. HERO SECTION PRINCIPAL */}
      <section className="grid gap-8 py-4 sm:py-8 lg:grid-cols-12 lg:items-center">
        <div className="space-y-5 lg:col-span-7">
          <p className="text-sm font-semibold text-[#e76f51]">{family ? `Un espacio para la familia ${familyName}` : "Un espacio para tu familia"}</p>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-[#2c5f7c] sm:text-5xl">
            Cuidar la memoria de quienes <span className="text-[#e76f51]">más queremos</span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Actividades de estimulación cognitiva por reminiscencia para hacer en casa con {elderDisplayName}, sin necesidad de ser un profesional de la salud.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              onClick={onStartSession}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e76f51] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d65d3f]"
            >
              Comenzar sesión de hoy <ArrowRight className="size-4" />
            </button>
            <button
              onClick={onViewMemories}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-[#2c5f7c] transition-colors hover:bg-slate-50"
            >
              <BookOpen className="size-4" /> Ver recuerdos
            </button>
          </div>

          <p className="pt-1 text-sm text-slate-500">
            <strong className="text-[#2c5f7c]">Ayni acompaña conversaciones familiares.</strong> No reemplaza la atención médica.
          </p>
        </div>

        <figure className="relative min-h-64 overflow-hidden rounded-xl lg:col-span-5">
          <img src="/images/familia-participa.jpg" alt="Familia compartiendo un recuerdo entre generaciones" className="absolute inset-0 h-full w-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-5 pb-5 pt-16 text-sm font-medium text-white">
            Un recuerdo compartido puede abrir una conversación en familia.
          </figcaption>
        </figure>
      </section>

      {/* Nota de cuidado */}
      <div className="flex items-start gap-4 bg-[#fff8e5] px-4 py-4 text-sm text-[#81500c] sm:px-5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#c77d12]" />
        <div className="space-y-1">
          <p className="font-bold">Nota de cuidado y uso responsable</p>
          <p className="leading-relaxed">
            Ayni Digital no diagnostica condiciones clínicas ni reemplaza la consulta geriátrica, psicológica o médica. Si notas incomodidad, cansancio o respuestas negativas, pueden pausar la sesión.
          </p>
        </div>
      </div>

      {/* Resumen */}
      <section aria-label="Resumen familiar" className="mx-auto grid max-w-6xl gap-x-10 gap-y-7 sm:grid-cols-3">
        <SummaryItem icon={<Users className="size-5 text-[#2c5f7c]" />} label="Sesiones esta semana" value={sessionCount === null ? "—" : sessionCount} detail="Sesiones con reseña registrada" />
        <SummaryItem icon={<BookOpen className="size-5 text-[#e76f51]" />} label="Recuerdos disponibles" value={memoryCount === null ? "—" : memoryCount} detail="Fotos, anécdotas y canciones" />
        <div className="min-w-0 border-t border-slate-200 pt-4 sm:border-t-0 sm:pt-0">
          <div className="flex items-center gap-2"><Users className="size-5 text-[#2c5f7c]" /><p className="text-sm font-medium text-slate-600">Red familiar</p></div>
          <p className="mt-3 text-2xl font-semibold leading-tight text-[#264653]">{memberCount === null ? "Tu familia" : `${memberCount} ${memberCount === 1 ? "integrante" : "integrantes"}`}</p>
          <button onClick={handleShareWhatsApp} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#168447] hover:underline">Invitar por WhatsApp</button>
        </div>
      </section>

      <section className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[#e76f51]">Una idea para hoy</p>
          <p className="mt-1 text-lg font-medium leading-relaxed text-[#2c5f7c] sm:text-xl">“¿Qué canción recuerdas de una celebración familiar?”</p>
          <p className="mt-1 text-sm text-slate-600">Pueden responder con calma, cambiar de tema o simplemente escuchar la canción juntos.</p>
        </div>
        <button onClick={onStartSession} className="inline-flex shrink-0 items-center gap-2 self-start text-sm font-semibold text-[#e76f51] hover:text-[#d65d3f] sm:self-center">
          Abrir guía <ArrowRight className="size-4" />
        </button>
      </section>

      <section aria-labelledby="home-notifications-title" className="grid gap-4 border-y border-slate-200 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div>
          <div className="flex items-center gap-2"><Bell className="size-5 text-[#2c5f7c]" /><h2 id="home-notifications-title" className="text-lg font-semibold text-[#2c5f7c]">Actividad reciente</h2></div>
          <ul className="mt-4 space-y-3">
            {[
              ...recentMemories.slice(0, 3).map((memory) => ({ id: memory.id, text: `${members.find((member) => member.id === memory.created_by)?.name ?? (memory.created_by === currentUser.id ? currentUser.name : "Un familiar")} subió ${memory.type === "song" ? "una canción" : "un recuerdo"}: “${memory.title}”`, date: memory.created_at, icon: memory.type === "song" ? "music" : "book" })),
              ...recentSessions.map((session) => ({ id: session.id, text: `${session.user_name} finalizó una sesión`, date: session.created_at, icon: "session" })),
              ...(shareNotice ? [{ id: shareNotice.id, text: "Preparaste un avance para compartir por WhatsApp", date: shareNotice.date, icon: "share" }] : []),
            ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((item) => <li key={item.id} className="flex items-start gap-3 text-sm text-slate-700"><span className="mt-0.5 text-[#2c5f7c]">{item.icon === "music" ? <Music2 className="size-4" /> : item.icon === "session" ? <Users className="size-4" /> : item.icon === "share" ? <Share2 className="size-4" /> : <BookOpen className="size-4" />}</span><span className="min-w-0 flex-1">{item.text}</span><time dateTime={item.date} className="shrink-0 text-xs text-slate-500">{new Date(item.date).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</time></li>)}
            {recentMemories.length === 0 && recentSessions.length === 0 && !shareNotice && <li className="text-sm text-slate-500">Cuando alguien comparta un recuerdo o registre una sesión, su actividad aparecerá aquí.</li>}
          </ul>
        </div>
        <div className="sm:text-right"><button onClick={handleShareProgress} className="inline-flex items-center gap-2 text-sm font-semibold text-[#168447] hover:underline"><Users className="size-4" />Compartir progreso por WhatsApp</button></div>
      </section>

      {/* 4. SESIONES RÁPIDAS */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
          <p className="text-sm font-semibold text-[#e76f51]">Para cualquier momento</p>
            <h2 className="text-xl font-bold text-[#2c5f7c]">Sesiones rápidas de estimulación</h2>
          </div>
          <span className="hidden text-xs text-gray-500 sm:block">Elige una idea recomendada para comenzar</span>
        </div>

        <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {quickSessions.map((session, index) => (
            <button
              key={session.title}
              onClick={onStartSession}
              className="group grid h-full grid-cols-[auto_minmax(0,1fr)] items-start gap-4 border-t border-slate-200 py-5 text-left md:gap-5"
            >
              <div className="shrink-0 text-5xl font-semibold leading-none text-[#e9c46a] sm:text-6xl">
                {index + 1}
              </div>
              <div className="flex min-h-32 flex-col items-start">
                <h3 className="text-lg font-semibold leading-snug text-[#2c5f7c]">{session.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{session.description}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-[#e76f51]">
                  Preparar guía <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div><p className="text-sm font-semibold text-[#e76f51]">Recuerdos que nos acercan</p><h2 className="mt-1 text-2xl font-bold text-[#2c5f7c]">Ideas para compartir en familia</h2></div>
        <div className="grid items-stretch gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Suben sus recuerdos", description: "Fotos, anécdotas y canciones para reunir las historias de la familia.", image: "/images/recuerdos.jpg", action: onViewMemories, label: "Ir a recuerdos" },
            { title: "Guía de 15 minutos", description: "Una conversación breve, con preguntas sencillas y sin apuro.", image: "/images/guia-sesion.jpg", action: onStartSession, label: "Abrir guía" },
            { title: "Registro de emociones", description: "Al final de la guía pueden conversar sobre cómo se sintió este momento.", image: "/images/emociones.jpg", action: onStartSession, label: "Ver la guía" },
          ].map((item) => <button key={item.title} onClick={item.action} className="group flex h-full flex-col text-left focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2c5f7c]">
            <img src={item.image} alt="" loading="lazy" className="aspect-4/3 w-full rounded-xl object-cover transition group-hover:brightness-95" />
            <h3 className="mt-4 text-lg font-semibold text-[#264653]">{item.title}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-gray-600">{item.description}</p>
            <span className="mt-3 inline-flex items-center text-sm font-semibold text-[#2c5f7c]">{item.label} <ArrowRight aria-hidden="true" className="ml-1 size-4" /></span>
          </button>)}
        </div>
      </section>

      <BillingPanel />

      {/* 5. IMPACTO SOCIAL & OBJETIVOS DE DESARROLLO SOSTENIBLE (ODS 3 & ODS 10) CON BANDERAS INSTITUCIONALES */}
      <section className="space-y-8 py-4 sm:py-8">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold text-[#e76f51]">Nuestro compromiso</p>
          <h2 className="text-2xl font-semibold text-[#2c5f7c] sm:text-3xl">Impacto social y Objetivos de Desarrollo Sostenible</h2>
          <p className="text-base leading-relaxed text-slate-600">Ayni Digital acompaña a las familias y se inspira en dos objetivos de las Naciones Unidas.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <article className="flex items-start gap-5 border-b border-gray-200 pb-7 md:border-b-0 md:border-r md:pb-0 md:pr-10">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-[#4C9F38] sm:size-28"><img src="/images/ods-3.jpg" alt="ODS 3: Salud y bienestar" loading="lazy" className="h-full w-full object-cover"/><span className="absolute inset-x-0 bottom-0 bg-[#4C9F38]/90 p-1.5 text-center text-xs font-bold text-white">ODS 3</span></div>
            <div className="space-y-2"><h3 className="text-lg font-semibold text-[#264653]">Salud y bienestar</h3><p className="text-sm leading-relaxed text-gray-600">Promovemos momentos de conexión y bienestar emocional en familia, respetando el ritmo de cada persona.</p></div>
          </article>
          <article className="flex items-start gap-5">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-[#DD1367] sm:size-28"><img src="/images/ods-10.jpg" alt="ODS 10: Reducción de las desigualdades" loading="lazy" className="h-full w-full object-cover"/><span className="absolute inset-x-0 bottom-0 bg-[#DD1367]/90 p-1.5 text-center text-xs font-bold text-white">ODS 10</span></div>
            <div className="space-y-2"><h3 className="text-lg font-semibold text-[#264653]">Reducción de las desigualdades</h3><p className="text-sm leading-relaxed text-gray-600">Buscamos que las familias puedan crear recuerdos compartidos con herramientas digitales sencillas y accesibles.</p></div>
          </article>
        </div>
      </section>
    </div>
  );
};

function SummaryItem({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number | string; detail: string }) {
  return <div className="min-w-0 border-t border-slate-200 pt-4 sm:border-t-0 sm:pt-0">
    <div className="flex items-center gap-2">{icon}<p className="text-sm font-medium text-slate-600">{label}</p></div>
    <p className="mt-3 text-2xl font-semibold leading-tight text-[#264653]">{value}</p>
    <p className="mt-2 text-sm text-slate-500">{detail}</p>
  </div>;
}
