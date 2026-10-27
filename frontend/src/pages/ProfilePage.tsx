import React from "react";
import { Button } from "../components/Button";

export const ProfilePage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Encabezado de Perfil estilo Duolingo */}
      <div className="bg-[#E8F5E9] p-6 rounded-3xl border border-[#0D7A5F]/20 text-center relative overflow-hidden">
        <div className="w-24 h-24 mx-auto rounded-full bg-white border-4 border-dashed border-[#0D7A5F] flex items-center justify-center text-3xl shadow-inner cursor-pointer hover:bg-gray-50 transition-colors">
          👵
        </div>
        <h2 className="text-xl font-bold text-[#0D7A5F] mt-3">Mamá María</h2>
        <p className="text-xs text-gray-600">Nació en 1950 • Lima, Perú</p>
      </div>

      {/* Sección de Colaboradores Familiares estilo Duolingo */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-[#0D7A5F] flex items-center gap-2">
            <span>👥</span> Red Familiar (Colaboradores)
          </h3>
          <span className="text-xs font-semibold text-gray-500">2 miembros</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-[#F4FBF7] rounded-xl border border-[#0D7A5F]/10">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-[#0D7A5F] text-white flex items-center justify-center font-bold text-xs">
                M
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">María García</p>
                <p className="text-[10px] text-gray-500">Cuidadora Principal</p>
              </div>
            </div>
            <span className="text-[10px] bg-[#E8F5E9] text-[#0D7A5F] px-2 py-1 rounded-md font-bold">Activo</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs">
                C
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">Carlos García</p>
                <p className="text-[10px] text-gray-500">Hermano / Colaborador</p>
              </div>
            </div>
            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-bold">Invitado</span>
          </div>
        </div>

        <Button variant="outline">
          + Invitar a otro familiar
        </Button>
      </div>

      {/* Música y Recuerdos Favoritos */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-[#0D7A5F] flex items-center gap-2">
          <span>🎵</span> Música y Recuerdos Favoritos
        </h3>

        <div className="flex items-center justify-between p-3 bg-[#F4FBF7] rounded-xl border border-[#0D7A5F]/10">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🎧</span>
            <div>
              <p className="text-xs font-bold text-gray-800">Boleros del recuerdo</p>
              <p className="text-[10px] text-gray-500">Spotify / Enlace Guardado</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#0D7A5F]">Spotify 🟢</span>
        </div>
      </div>
    </div>
  );
};

