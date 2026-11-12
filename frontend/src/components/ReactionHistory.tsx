import { useEffect, useState } from "react";
import { getFamilyReactions } from "../api/insights";
import type { FamilyReactions } from "../api/insights";

const labels = { receptivo: "Receptivo", emocionado: "Emocionado", indiferente: "Indiferente", agitado: "Agitado" };

export function ReactionHistory({ familyId }: { familyId: string }) {
  return <ReactionHistoryContent key={familyId} />;
}

function ReactionHistoryContent() {
  const [data, setData] = useState<FamilyReactions | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getFamilyReactions().then((result) => { if (active) setData(result); }).catch(() => {
      if (active) setError("No pudimos cargar las reacciones guardadas. No hay datos disponibles para evaluar las alertas.");
    });
    return () => { active = false; };
  }, [attempt]);
  return <section aria-label="Reacciones guardadas" className="space-y-4 rounded-xl border p-5">
    <h2 className="text-xl font-semibold">Reacciones guardadas por la familia</h2>
    {error ? <div role="alert"><p>{error}</p><button className="min-h-11 underline" onClick={() => { setError(""); setData(null); setAttempt((value) => value + 1); }}>Reintentar resumen</button></div> : !data ? <p role="status">Cargando historial…</p> : <>
      <p>Últimos 30 días: {data.summary.total} sesiones con reacción registrada.</p>
      <ul className="flex flex-wrap gap-4">{Object.entries(labels).map(([key, label]) => <li key={key}>{label}: {data.summary.counts[key as keyof typeof labels]}</li>)}</ul>
      {data.pause.should_pause && <p role="alert" className="rounded bg-amber-50 p-3">{data.pause.message}</p>}
      <p className="text-sm">La sugerencia de pausa considera el historial completo. Indiferente no cuenta como una reacción negativa.</p>
      <p className="text-sm">{data.summary.disclaimer}</p>
      {data.history.length ? <details><summary className="cursor-pointer py-3">Ver historial de reacciones</summary><ol className="space-y-2">{[...data.history].reverse().map((item) => <li key={item.session_id}>{new Date(item.occurred_at).toLocaleString("es-PE")} · {labels[item.reaction]}</li>)}</ol></details> : <p>Todavía no hay reacciones registradas.</p>}
    </>}
  </section>;
}
