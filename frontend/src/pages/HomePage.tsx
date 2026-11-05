import React, { useEffect, useState } from "react";
import {
  CalendarDays,
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

  const quickSessions = [
    "Sesión con fotos de la época de trabajo",
    "Sesión con música criolla",
    "Sesión con anécdotas de viajes",
  ];

  const handleShareWhatsApp = () => {
    const mensaje = encodeURIComponent(
      `¡Hola! 👋 Te invito a unirte al grupo de ${familyDisplayName} en Ayni Digital para compartir recuerdos con ${elderDisplayName}. 💚`
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
          <p className="text-sm font-semibold text-[#e76f51]">Un espacio para {familyDisplayName}</p>
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
      <div className="rounded-2xl bg-[#FEF3C7] border border-[#D97706]/30 p-4 sm:p-5 flex items-start gap-4 text-xs text-[#92400E]">
        <AlertTriangle className="size-5 shrink-0 text-[#D97706] mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Nota de Seguridad Ética y Uso Responsable</p>
          <p className="leading-relaxed">
            Ayni Digital NO diagnostica ninguna condición clínica ni reemplaza la consulta geriátrica, psicológica o médica. Si observas agitaciones o respuestas negativas recurrentes, se recomienda pausar la sesión.
          </p>
        </div>
      </div>

      {/* 3. METRICAS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2c5f7c] uppercase">Sesiones de la Semana</span>
            <CalendarDays className="size-4 text-[#e9c46a]" />
          </div>
          <p className="text-3xl font-extrabold text-[#264653]">0</p>
          <p className="text-xs text-gray-500">Sesiones registradas en la red familiar</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2c5f7c] uppercase">Recuerdos Disponibles</span>
            <BookOpen className="size-4 text-[#e76f51]" />
          </div>
          <p className="text-3xl font-extrabold text-[#264653]">
            {elderProfile?.interests ? elderProfile.interests.length : 0}
          </p>
          <p className="text-xs text-gray-500">Fotos, anécdotas y canciones subidas</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2c5f7c] uppercase">Red Familiar</span>
            <Users className="size-4 text-[#2c5f7c]" />
          </div>
          <p className="text-3xl font-extrabold text-[#264653]">Activa</p>
          <button
            onClick={handleShareWhatsApp}
            className="text-xs text-[#25D366] font-bold hover:underline flex items-center gap-1 pt-1"
          >
            <span>Invitar familiar por WhatsApp</span>
          </button>
        </div>
      </section>

      {/* 4. SESIONES RÁPIDAS */}
      <section className="space-y-4">
        <div className="flex items-end justify-between border-b border-gray-200 pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#e76f51]">Para cualquier momento</p>
            <h2 className="text-xl font-bold text-[#2c5f7c]">Sesiones rápidas de estimulación</h2>
          </div>
          <span className="hidden text-xs text-gray-500 sm:block">Elige una idea recomendada para comenzar</span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {quickSessions.map((session, index) => (
            <button
              key={session}
              onClick={onStartSession}
              className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-[#2c5f7c]/40 hover:shadow-md space-y-3"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#e9c46a]/30 text-[#264653] font-bold text-xs">
                0{index + 1}
              </div>
              <p className="font-bold text-xs text-[#264653] leading-snug">{session}</p>
              <p className="flex items-center gap-1 text-xs text-[#e76f51] font-semibold">
                Generar guía <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div><p className="text-sm font-semibold text-[#e76f51]">Recuerdos que nos acercan</p><h2 className="mt-1 text-2xl font-bold text-[#2c5f7c]">Ideas para compartir en familia</h2></div>
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Suben sus recuerdos", description: "Fotos, anécdotas y canciones para reunir las historias de la familia.", image: "/images/recuerdos.jpg", action: onViewMemories, label: "Ir a recuerdos" },
            { title: "Guía de 15 minutos", description: "Una conversación breve, con preguntas sencillas y sin apuro.", image: "/images/guia-sesion.jpg", action: onStartSession, label: "Abrir guía" },
            { title: "Registro de emociones", description: "Al final de la guía pueden conversar sobre cómo se sintió este momento.", image: "/images/emociones.jpg", action: onStartSession, label: "Ver la guía" },
          ].map((item) => <button key={item.title} onClick={item.action} className="group text-left focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2c5f7c]">
            <img src={item.image} alt="" loading="lazy" className="aspect-4/3 w-full rounded-2xl object-cover transition group-hover:brightness-95" />
            <h3 className="mt-3 text-lg font-semibold text-[#264653]">{item.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{item.description}</p>
            <span className="mt-2 inline-flex text-sm font-semibold text-[#2c5f7c]">{item.label} <ArrowRight aria-hidden="true" className="ml-1 size-4" /></span>
          </button>)}
        </div>
      </section>

      <BillingPanel />

      {/* 5. IMPACTO SOCIAL & OBJETIVOS DE DESARROLLO SOSTENIBLE (ODS 3 & ODS 10) CON BANDERAS INSTITUCIONALES */}
      <section className="rounded-2xl bg-white p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <Users className="size-6 text-[#2c5f7c]" aria-hidden="true" />
          <div>
            <h3 className="text-base font-bold text-[#2c5f7c]">Impacto Social & Objetivos de Desarrollo Sostenible (ODS)</h3>
            <p className="text-xs text-gray-500">Ayni Digital impulsa dos pilares fundamentales de las Naciones Unidas en Lima Metropolitana</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TARJETA ODS 3 */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-[#4C9F38]"><img src="/images/ods-3.jpg" alt="ODS 3: Salud y bienestar" loading="lazy" className="h-full w-full object-cover"/><span className="absolute inset-x-0 bottom-0 bg-[#4C9F38]/90 p-1 text-center text-[10px] font-bold text-white">ODS 3</span></div>
            <div className="space-y-1.5 flex-1">
              <h4 className="text-xs font-bold text-[#264653] uppercase tracking-wide">
                Salud y Bienestar
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Promoción del bienestar emocional y la salud cognitiva del adulto mayor con deterioro leve/moderado y disminución del agotamiento en cuidadores informales.
              </p>
            </div>
          </div>

          {/* TARJETA ODS 10 */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-[#DD1367]"><img src="/images/ods-10.jpg" alt="ODS 10: Reducción de las desigualdades" loading="lazy" className="h-full w-full object-cover"/><span className="absolute inset-x-0 bottom-0 bg-[#DD1367]/90 p-1 text-center text-[10px] font-bold text-white">ODS 10</span></div>
            <div className="space-y-1.5 flex-1">
              <h4 className="text-xs font-bold text-[#264653] uppercase tracking-wide">
                Reducción de las Desigualdades
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Inclusión digital e intergeneracional accesible para familias sin recursos para terapias privadas costosas en Lima Metropolitana.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
