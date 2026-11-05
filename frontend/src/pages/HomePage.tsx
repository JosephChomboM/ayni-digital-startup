import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Users,
  AlertTriangle,
} from "lucide-react";
import { getElderProfile, getMyFamily } from "../api/families";
import type { ElderProfile, Family } from "../api/families";
import { ApiError } from "../api/client";
import { BillingPanel } from "../components/BillingPanel";

interface HomePageProps {
  onStartSession: () => void;
  onViewMemories: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onStartSession,
  onViewMemories,
}) => {
  const [elderProfile, setElderProfile] = useState<ElderProfile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const familyData = await getMyFamily();
        setFamily(familyData);
      } catch {
        // Silencioso
      }

      try {
        const profileData = await getElderProfile();
        setElderProfile(profileData);
      } catch (err) {
        if (err instanceof ApiError && err.code === "elder_profile_not_found") {
          setElderProfile(null);
        }
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

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

      {/* 2. NOTA ÉTICA */}
      <div className="flex items-start gap-4 bg-[#fff8e5] px-4 py-4 text-sm text-[#81500c] sm:px-5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#c77d12]" />
        <div className="space-y-1">
          <p className="font-bold">Nota de Seguridad Ética y Uso Responsable</p>
          <p className="leading-relaxed">
            Ayni Digital NO diagnostica ninguna condición clínica ni reemplaza la consulta geriátrica, psicológica o médica. Si observas agitaciones o respuestas negativas recurrentes, se recomienda pausar la sesión.
          </p>
        </div>
      </div>

      {/* 3. METRICAS */}
      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#2c5f7c]">Sesiones de la semana</span>
          </div>
          <p className="text-3xl font-extrabold text-[#264653]">0</p>
          <p className="text-xs text-gray-500">Sesiones registradas en la red familiar</p>
        </div>

        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2c5f7c] uppercase">Recuerdos Disponibles</span>
            <BookOpen className="size-4 text-[#e76f51]" />
          </div>
          <p className="text-3xl font-extrabold text-[#264653]">
            {elderProfile?.interests ? elderProfile.interests.length : 0}
          </p>
          <p className="text-xs text-gray-500">Fotos, anécdotas y canciones subidas</p>
        </div>

        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2c5f7c] uppercase">Red Familiar</span>
            <Users className="size-4 text-[#2c5f7c]" />
          </div>
          <p className="text-3xl font-extrabold text-[#264653]">Activa</p>
          <button
            onClick={handleShareWhatsApp}
          className="text-sm text-[#168447] font-semibold hover:underline flex items-center gap-1 pt-1"
          >
            <span>Invitar familiar por WhatsApp</span>
          </button>
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

      {/* 4. SESIONES RÁPIDAS */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#e76f51]">Para cualquier momento</p>
            <h2 className="text-xl font-bold text-[#2c5f7c]">Sesiones rápidas de estimulación</h2>
          </div>
          <span className="hidden text-xs text-gray-500 sm:block">Elige una idea recomendada para comenzar</span>
        </div>

        <div className="grid gap-x-8 md:grid-cols-3">
          {quickSessions.map((session, index) => (
            <button
              key={session.title}
              onClick={onStartSession}
              className="group flex h-full items-start gap-4 py-5 text-left md:gap-5"
            >
              <div className="shrink-0 text-5xl font-semibold leading-none text-[#e9c46a] sm:text-6xl">
                {index + 1}
              </div>
              <div className="flex min-h-28 flex-col items-start">
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
