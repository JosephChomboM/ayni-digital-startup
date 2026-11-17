import { useEffect, useState } from "react";
import { getFamilyReactions } from "../api/insights";
import type { FamilyReactions } from "../api/insights";

const labels = { receptivo: "Receptivo", emocionado: "Emocionado", indiferente: "Indiferente", agitado: "Agitado" };
const tones = { receptivo: "#5c9a7b", emocionado: "#e76f51", indiferente: "#8ba0aa", agitado: "#d89a45" };

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
  const counts = data?.summary.counts;
  const maxCount = Math.max(1, ...Object.keys(labels).map((key) => counts?.[key as keyof typeof labels] ?? 0));
  return <section aria-label="Reacciones guardadas" className="reaction-summary">
    <header className="reaction-summary-heading"><div><p className="dashboard-eyebrow">CÓMO VIVIERON LOS ENCUENTROS</p><h2>Reacciones compartidas</h2><p>Lo que la familia registró al cerrar una sesión · últimos 30 días</p></div>{data && <strong className="reaction-total">{data.summary.total}<small>{data.summary.total === 1 ? "reseña" : "reseñas"}</small></strong>}</header>
    {error ? <div role="alert"><p>{error}</p><button className="min-h-11 underline" onClick={() => { setError(""); setData(null); setAttempt((value) => value + 1); }}>Reintentar resumen</button></div> : !data ? <p role="status">Cargando reacciones…</p> : <>
      {data.summary.total ? <ul className="reaction-distribution">{Object.entries(labels).map(([key, label]) => { const count = data.summary.counts[key as keyof typeof labels]; return <li key={key}><div><span className="reaction-dot" style={{ backgroundColor: tones[key as keyof typeof tones] }}/><span>{label}</span><strong>{count}</strong></div><span className="reaction-track"><span style={{ width: `${count / maxCount * 100}%`, backgroundColor: tones[key as keyof typeof tones] }}/></span></li>; })}</ul> : <p className="dashboard-empty-note">Todavía no hay reacciones registradas. Al terminar una sesión, la familia puede compartir cómo vivió el momento.</p>}
      {data.pause.should_pause && <p role="alert" className="reaction-pause-note">{data.pause.message}</p>}
      <details className="reaction-history-details"><summary>Ver historial de reacciones</summary>{data.history.length ? <ol>{[...data.history].reverse().map((item) => <li key={item.session_id}>{new Date(item.occurred_at).toLocaleString("es-PE")} · {labels[item.reaction]}</li>)}</ol> : <p>Todavía no hay reacciones registradas.</p>}</details>
      <p className="reaction-disclaimer">{data.summary.disclaimer} La sugerencia de pausa considera el historial completo; “indiferente” no se interpreta como una reacción negativa.</p>
    </>}
  </section>;
}
