import { Calendar, TrendingUp, BookOpen, Clock, Heart } from "lucide-react"

export function FamilyDashboard() {
  return (
    <div className="space-y-6 text-[#264653]">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-extrabold tracking-widest text-[#e76f51] uppercase">
            TU ESPACIO FAMILIAR
          </span>
          <h2 className="text-2xl font-extrabold text-[#2c5f7c]">
            Acompañar también es recordar
          </h2>
        </div>
        <span className="self-start sm:self-auto rounded-full bg-white border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-500 shadow-sm">
          Actualizado hoy
        </span>
      </div>

      {/* 3 TARJETAS SUPERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* TARJETA 1: SESIONES REALIZADAS */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-[#2c5f7c]/10 text-[#2c5f7c]">
              <Calendar className="size-5" />
            </div>
            <TrendingUp className="size-4 text-[#e76f51]" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">Sesiones realizadas</p>
            <p className="text-3xl font-black text-[#264653] mt-0.5">12</p>
            <p className="text-[11px] font-semibold text-[#2c5f7c] mt-1">+3 este mes</p>
          </div>
        </div>

        {/* TARJETA 2: ÚLTIMA SESIÓN */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-[#e9c46a]/30 text-[#264653]">
              <Clock className="size-5" />
            </div>
            <TrendingUp className="size-4 text-[#e76f51]" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">Última sesión</p>
            <p className="text-2xl font-extrabold text-[#2c5f7c] mt-0.5">Receptivo</p>
            <p className="text-[11px] text-gray-400 mt-1">Hoy, 10:30 a. m.</p>
          </div>
        </div>

        {/* TARJETA 3: CONTENIDO SUBIDO */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-[#e76f51]/10 text-[#e76f51]">
              <BookOpen className="size-5" />
            </div>
            <TrendingUp className="size-4 text-[#e76f51]" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">Contenido subido</p>
            <p className="text-3xl font-black text-[#264653] mt-0.5">24</p>
            <p className="text-[11px] text-gray-400 mt-1">12 fotos • 8 notas • 4 canciones</p>
          </div>
        </div>
      </div>

      {/* SECCIÓN GRÁFICA: RESPUESTAS POSITIVAS POR SEMANA */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#2c5f7c]">
              Respuestas positivas por semana
            </h3>
            <p className="text-xs text-gray-500">
              Una señal de cómo se sienten durante las actividades cotidianas
            </p>
          </div>
          <TrendingUp className="size-5 text-[#e76f51]" />
        </div>

        {/* Malla / Gráfico Semanal */}
        <div className="h-32 border-b border-gray-100 flex items-end justify-between px-2 pt-4">
          {[
            { label: "S1", val: 40 },
            { label: "S2", val: 55 },
            { label: "S3", val: 70 },
            { label: "S4", val: 60 },
            { label: "S5", val: 85 },
            { label: "S6", val: 75 },
            { label: "S7", val: 90 },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-2 flex-1">
              <div
                style={{ height: `${item.val}%` }}
                className="w-3 rounded-t-lg bg-[#2c5f7c]/80 transition-all hover:bg-[#e76f51]"
              />
              <span className="text-[10px] font-bold text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIONES INFERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[#e9c46a]/50 bg-[#e9c46a]/15 p-5 space-y-3">
          <h4 className="text-xs font-bold text-[#264653] uppercase tracking-wide">
            Áreas que necesitan más contenido
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-white/70 p-2.5 rounded-xl border border-gray-200/50">
              <span>🖼️ Fotos de viajes familiares</span>
              <span className="bg-[#2c5f7c] text-white font-bold text-[10px] px-2 py-0.5 rounded-md">Sugerido</span>
            </div>
            <div className="flex items-center justify-between bg-white/70 p-2.5 rounded-xl border border-gray-200/50">
              <span>🎵 Música de su juventud</span>
              <span className="bg-[#e76f51] text-white font-bold text-[10px] px-2 py-0.5 rounded-md">Pendiente</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[#2c5f7c] text-white p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#e9c46a]">
            <Heart className="size-4 fill-current" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Recuerda</h4>
          </div>
          <p className="text-xs leading-relaxed text-white/90">
            Esto no es un diagnóstico. Es un registro de actividades familiares para acompañar con cariño.
          </p>
        </div>
      </div>
    </div>
  )
}
