import React, { useEffect, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Heart,
  BookOpen,
  Users,
  AlertTriangle,
} from "lucide-react";
import { getElderProfile, getMyFamily } from "../api/families";
import type { ElderProfile, Family } from "../api/families";
import { ApiError } from "../api/client";

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
      <section className="relative grid gap-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#2c5f7c] via-[#264653] to-[#e76f51] p-8 sm:p-12 lg:grid-cols-12 lg:items-center text-white shadow-xl">
        <div className="lg:col-span-7 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#e9c46a] px-3 py-1 text-xs font-extrabold text-[#264653] shadow-sm">
            <Sparkles className="size-3.5" />
            <span>Hecho para acompañar en familia • {familyDisplayName}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            Cuidar la memoria de quienes <span className="text-[#e9c46a]">más queremos</span>
          </h1>

          <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-xl">
            Actividades de estimulación cognitiva por reminiscencia para hacer en casa con {elderDisplayName}, sin necesidad de ser un profesional de la salud.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onStartSession}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e76f51] px-6 py-3 text-xs font-extrabold text-white shadow-lg hover:bg-[#d65d3f] transition-all"
            >
              Comenzar sesión de hoy <ArrowRight className="size-4" />
            </button>
            <button
              onClick={onViewMemories}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-xs font-bold text-white border border-white/20 hover:bg-white/20 transition-all"
            >
              <BookOpen className="size-4" /> Subir recuerdos
            </button>
          </div>

          <p className="text-[11px] text-white/80 pt-1">
            <strong className="text-white">Importante:</strong> Esto no es un servicio de salud. No reemplaza consulta médica.
          </p>
        </div>

        <div className="lg:col-span-5 relative rounded-2xl bg-white/10 backdrop-blur-md p-6 sm:p-8 border border-white/15 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#e9c46a] uppercase tracking-wider">Un momento para compartir</span>
            <Heart className="size-5 text-[#e76f51] fill-current" />
          </div>

          <p className="text-xl sm:text-2xl font-serif italic text-white/95 leading-snug">
            “A veces una canción abre la puerta a una historia.”
          </p>

          <div className="pt-4 border-t border-white/20 flex items-center justify-between">
            <div className="flex -space-x-2">
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-[#2c5f7c] bg-[#e9c46a] text-xs font-bold text-[#264653]">
                M
              </div>
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-[#2c5f7c] bg-[#e76f51] text-xs font-bold text-white">
                J
              </div>
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-[#2c5f7c] bg-white text-xs font-bold text-[#2c5f7c]">
                A
              </div>
            </div>
            <span className="text-xs text-white/80 font-medium">Tu familia construye esta historia junta</span>
          </div>
        </div>
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
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2c5f7c] uppercase">Sesiones de la Semana</span>
            <Sparkles className="size-4 text-[#e9c46a]" />
          </div>
          <p className="text-3xl font-extrabold text-[#264653]">0</p>
          <p className="text-xs text-gray-500">Sesiones registradas en la red familiar</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2c5f7c] uppercase">Recuerdos Disponibles</span>
            <BookOpen className="size-4 text-[#e76f51]" />
          </div>
          <p className="text-3xl font-extrabold text-[#264653]">
            {elderProfile?.interests ? elderProfile.interests.length : 0}
          </p>
          <p className="text-xs text-gray-500">Fotos, anécdotas y canciones subidas</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-2">
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
              className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#2c5f7c]/40 hover:shadow-md space-y-3"
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

      {/* 5. IMPACTO SOCIAL & OBJETIVOS DE DESARROLLO SOSTENIBLE (ODS 3 & ODS 10) CON BANDERAS INSTITUCIONALES */}
      <section className="rounded-2xl bg-white p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <span className="text-2xl">🌍</span>
          <div>
            <h3 className="text-base font-bold text-[#2c5f7c]">Impacto Social & Objetivos de Desarrollo Sostenible (ODS)</h3>
            <p className="text-xs text-gray-500">Ayni Digital impulsa dos pilares fundamentales de las Naciones Unidas en Lima Metropolitana</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TARJETA ODS 3 */}
          <div className="bg-[#f1faee] p-5 rounded-2xl border border-[#4C9F38]/30 flex flex-col sm:flex-row items-start gap-4 hover:shadow-md transition-all">
            <div className="size-20 bg-[#4C9F38] text-white rounded-xl shrink-0 p-2 flex flex-col justify-between shadow-sm border border-[#4C9F38]">
              <span className="text-[10px] font-black uppercase tracking-wider">ODS 3</span>
              <div className="space-y-0.5">
                <p className="text-xs font-black leading-none">SALUD</p>
                <p className="text-[9px] font-semibold leading-none opacity-90">& BIENESTAR</p>
              </div>
            </div>
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
          <div className="bg-[#f1faee] p-5 rounded-2xl border border-[#DD1367]/30 flex flex-col sm:flex-row items-start gap-4 hover:shadow-md transition-all">
            <div className="size-20 bg-[#DD1367] text-white rounded-xl shrink-0 p-2 flex flex-col justify-between shadow-sm border border-[#DD1367]">
              <span className="text-[10px] font-black uppercase tracking-wider">ODS 10</span>
              <div className="space-y-0.5">
                <p className="text-xs font-black leading-none">REDUCCIÓN DE</p>
                <p className="text-[9px] font-semibold leading-none opacity-90">DESIGUALDADES</p>
              </div>
            </div>
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
