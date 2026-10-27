import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
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
        // Manejo silencioso
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

  const handleShareWhatsApp = () => {
    const mensaje = encodeURIComponent(
      `¡Hola! 👋 Hoy estuve compartiendo una sesión de recuerdos alegres con ${elderDisplayName} en Ayni Digital. 💚`
    );
    window.open(`https://wa.me/?text=${mensaje}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <div className="w-10 h-10 border-4 border-[#0D7A5F] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-gray-500 font-medium">Cargando información del día...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Saludo principal */}
      <div className="bg-[#E8F5E9] p-5 rounded-3xl border border-[#0D7A5F]/20 flex items-center justify-between shadow-sm">
        <div className="space-y-1">
          <span className="text-xs font-bold text-[#0D7A5F] uppercase tracking-wider">
            {familyDisplayName}
          </span>
          <h2 className="text-xl font-extrabold text-[#1F2937]">
            Hoy cuidamos a {elderDisplayName} 💚
          </h2>
          <p className="text-xs text-gray-600">
            {elderProfile?.birth_decade
              ? `Década de nacimiento: ${elderProfile.birth_decade}s`
              : "Perfil pendiente de completar"}
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-white border-2 border-[#0D7A5F] flex items-center justify-center text-2xl shadow-inner">
          👵
        </div>
      </div>

      {/* Texto de deslinde médico obligatorio */}
      <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-center">
        <p className="text-[11px] text-gray-600 font-medium">
          Esto no es un diagnóstico. Es un registro de actividades familiares.
        </p>
      </div>

      {/* Racha y Actividades (Estado disponible pronto) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-gray-200 text-center shadow-sm">
          <span className="text-xl">📊</span>
          <p className="text-xs font-bold text-gray-800">Próximamente</p>
          <p className="text-[10px] text-gray-500">Racha de actividades</p>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-gray-200 text-center shadow-sm">
          <span className="text-xl">⭐</span>
          <p className="text-xs font-bold text-gray-800">Sin registros</p>
          <p className="text-[10px] text-gray-500">Actividades del mes</p>
        </div>
      </div>

      {/* Acción Principal */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F5E9] text-[#0D7A5F] flex items-center justify-center text-2xl">
          🧠
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-[#0D7A5F]">Sesión de Estimulación Cognitiva</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Una guía paso a paso con preguntas sobre recuerdos felices para ejercitar la memoria.
          </p>
        </div>
        
        <div className="space-y-2 pt-1">
          <Button onClick={onStartSession}>
            Comenzar actividad
          </Button>

          <button
            onClick={handleShareWhatsApp}
            className="w-full py-2 px-3 bg-[#25D366]/10 text-[#075E54] hover:bg-[#25D366]/20 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors border border-[#25D366]/30"
          >
            <span>💬</span>
            <span>Compartir avance por WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Gustos preferidos reales */}
      {elderProfile?.interests && elderProfile.interests.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2">
          <h4 className="text-xs font-bold text-[#0D7A5F] uppercase tracking-wider">
            💡 Gustos preferidos
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {elderProfile.interests.map((interest, idx) => (
              <span
                key={idx}
                className="bg-[#E8F5E9] text-[#0D7A5F] text-[11px] px-2.5 py-1 rounded-full font-medium"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sección Recuerdos (Estado informativo) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2 text-center">
        <h3 className="text-xs font-bold text-[#0D7A5F] uppercase tracking-wider">
          🖼️ Banco de Recuerdos
        </h3>
        <p className="text-xs text-gray-500">
          Todavía no hay actividades o recuerdos registrados.
        </p>
        <button
          onClick={onViewMemories}
          className="text-xs text-[#0D7A5F] font-semibold hover:underline"
        >
          Ir a Recuerdos
        </button>
      </div>
    </div>
  );
};

