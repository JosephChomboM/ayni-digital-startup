import { BookOpen } from "lucide-react";
import { Button } from "./ui/button";

export function FamilyDashboard({ onViewMemories }: { onViewMemories?: () => void }) {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 sm:p-8 space-y-5" aria-labelledby="summary-title">
      <BookOpen aria-hidden="true" className="size-8 text-[#2c5f7c]" />
      <h1 id="summary-title" className="text-2xl font-bold text-[#2c5f7c]">Resumen familiar</h1>
      <h2 className="text-lg font-semibold">El historial de sesiones aún no está disponible</h2>
      <p className="text-base leading-relaxed">Aquí podrás consultar la actividad familiar cuando el registro de sesiones esté conectado. Por ahora, la guía es un ejemplo y no genera un historial.</p>
      <p className="text-sm leading-relaxed text-gray-600">Tus anécdotas y canciones se consultan en Recuerdos. Este resumen no muestra cifras ni reacciones de demostración.</p>
      {onViewMemories && <Button onClick={onViewMemories}>Ver recuerdos familiares</Button>}
      <p className="border-t border-gray-200 pt-4 text-sm">Esto no es un diagnóstico. Es un espacio para actividades familiares.</p>
    </section>
  );
}
