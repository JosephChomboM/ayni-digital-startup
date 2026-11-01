import type { Memory } from "../api/memories";

const labels = {
  person: "Persona",
  place: "Lugar",
  period: "Época",
  activity: "Actividad",
};

export function MemoryEntities({ memory }: { memory: Memory }) {
  if (memory.type !== "anecdote") return null;

  const message = memory.entities_status === "pending"
    ? "Estamos identificando los detalles. Puedes actualizar los recuerdos en unos momentos."
    : memory.entities_status === "failed"
      ? "No pudimos identificar los detalles. Tu anécdota sigue guardada."
      : memory.entities.length === 0
        ? "No se identificaron personas, lugares, épocas ni actividades."
        : null;

  return (
    <details className="text-xs text-[#264653]">
      <summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-[#2c5f7c]">
        Detalles de la anécdota
      </summary>
      <div className="mt-2 space-y-2">
        {message ? <p>{message}</p> : (
          <ul className="space-y-1">
            {memory.entities.map((entity, index) => (
              <li key={`${entity.kind}-${index}`} className="break-words">
                <span className="font-semibold">{labels[entity.kind]}:</span> {entity.text}
              </li>
            ))}
          </ul>
        )}
        <p>Los detalles se detectan automáticamente y pueden contener errores.</p>
      </div>
    </details>
  );
}
