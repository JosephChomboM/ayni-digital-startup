import React from "react";
import { Button } from "../components/Button";

interface HomePageProps {
  elderName?: string;
  onStartSession: () => void;
  onViewMemories: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  elderName = "Mamá María",
  onStartSession,
  onViewMemories,
}) => {
  const handleShareWhatsApp = () => {
    const mensaje = encodeURIComponent(
      `¡Hola! 👋 Hoy estuve compartiendo una sesión de recuerdos alegres con ${elderName} en Ayni Digital. 💚`
    );
    window.open(`https://wa.me/?text=${mensaje}`, "_blank");
  };

  return (
    <div className="space-y-5">
      {/* Saludo principal y estado del día */}
      <div className="bg-[#E8F5E9] p-5 rounded-3xl border border-[#0D7A5F]/20 flex items-center justify-between shadow-sm">
        <div className="space-y-1">
          <span className="text-xs font-bold text-[#0D7A5F] uppercase tracking-wider">Dashboard Familiar</span>
          <h2 className="text-xl font-extrabold text-[#1F2937]">Hoy cuidamos a {elderName} 💚</h2>
          <p className="text-xs text-gray-600">Reminiscencia sugerida: 15 minutos</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-white border-2 border-[#0D7A5F] flex items-center justify-center text-2xl shadow-inner">
          👵
        </div>
      </div>

      {/* Racha y Logros Rápidos estilo Duolingo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-gray-200 text-center shadow-sm">
          <span className="text-xl">🔥</span>
          <p className="text-xs font-bold text-gray-800">3 días seguidos</p>
          <p className="text-[10px] text-gray-500">Racha de recuerdos</p>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-gray-200 text-center shadow-sm">
          <span className="text-xl">⭐</span>
          <p className="text-xs font-bold text-gray-800">5 Actividades</p>
          <p className="text-[10px] text-gray-500">Completadas este mes</p>
        </div>
      </div>

      {/* Acción Principal: Iniciar Actividad de Recuerdos */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F5E9] text-[#0D7A5F] flex items-center justify-center text-2xl">
          🧠
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-[#0D7A5F]">Sesión de Estimulación Cognitiva</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Una guía paso a paso con canciones y preguntas sobre recuerdos felices para ejercitar la memoria.
          </p>
        </div>
        
        <div className="space-y-2 pt-1">
          <Button onClick={onStartSession}>
            Comenzar actividad de hoy
          </Button>

          {/* Botón de Compartir por WhatsApp */}
          <button
            onClick={handleShareWhatsApp}
            className="w-full py-2 px-3 bg-[#25D366]/10 text-[#075E54] hover:bg-[#25D366]/20 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors border border-[#25D366]/30"
          >
            <span>💬</span>
            <span>Compartir avance con la familia por WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Acceso Rápido a Recuerdos y Spotify */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-[#0D7A5F] uppercase tracking-wider flex items-center gap-1">
            <span>🖼️</span> Recuerdos destacados
          </h3>
          <button
            onClick={onViewMemories}
            className="text-xs text-[#0D7A5F] font-semibold hover:underline"
          >
            Ver todos
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          <div className="min-w-[130px] bg-[#F4FBF7] p-3 rounded-xl border border-[#0D7A5F]/10 text-center space-y-1">
            <span className="text-2xl">🎶</span>
            <p className="text-xs font-bold text-gray-800 truncate">Boleros preferidos</p>
            <p className="text-[10px] text-[#0D7A5F] font-semibold">Spotify 🟢</p>
          </div>

          <div className="min-w-[130px] bg-[#F4FBF7] p-3 rounded-xl border border-[#0D7A5F]/10 text-center space-y-1">
            <span className="text-2xl">📷</span>
            <p className="text-xs font-bold text-gray-800 truncate">Paseo a Lachay</p>
            <p className="text-[10px] text-gray-500">Álbum familiar</p>
          </div>
        </div>
      </div>

      {/* Impacto ODS 3 / Autocuidado */}
      <div className="bg-[#FEF3C7] border border-[#D97706]/30 p-4 rounded-2xl flex items-start space-x-3">
        <span className="text-xl mt-0.5">🌱</span>
        <div className="space-y-1">
          <p className="text-xs font-bold text-[#92400E]">Cuidar también es cuidar de ti</p>
          <p className="text-[11px] text-[#92400E]/90 leading-relaxed">
            Recuerda tomarte un descanso. Ayni promueve el bienestar emocional tanto del adulto mayor como de la cuidadora.
          </p>
        </div>
      </div>
    </div>
  );
};

