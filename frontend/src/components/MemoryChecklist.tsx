import { useState } from "react";
import type { Memory } from "../api/memories";

const isSessionMemory = (memory: Memory) => memory.is_positive && !memory.is_sensitive && !memory.deletion_pending;

interface Props {
  memories: Memory[];
  selected: string[];
  all?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}

export function MemoryChecklist({ memories, selected, all = false, disabled = false, onChange }: Props) {
  const [query, setQuery] = useState("");
  const eligible = memories.filter(isSessionMemory);
  const ids = new Set(all ? eligible.map((item) => item.id) : selected);
  const visible = eligible.filter((item) => item.title.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")));
  const count = eligible.filter((item) => ids.has(item.id)).length;
  return <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <legend className="px-1 font-semibold">Recuerdos disponibles para conversar</legend>
    <label className="block text-sm">Buscar recuerdo
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} className="mt-1 w-full rounded border p-2" />
    </label>
    <p role="status" className="text-sm">{count} {count === 1 ? "recuerdo seleccionado" : "recuerdos seleccionados"}</p>
    {all && <p className="text-sm">Se incluirán todos los recuerdos bonitos disponibles al guardar la selección.</p>}
    <div className="max-h-60 space-y-2 overflow-y-auto">
      {visible.map((item) => <label key={item.id} className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={ids.has(item.id)} disabled={all} onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />
        <span>{item.title}<small className="ml-2 text-slate-500">{item.type === "song" ? "Canción" : "Anécdota"}</small></span>
      </label>)}
      {!visible.length && <p className="text-sm">{eligible.length ? "No hay recuerdos con ese título." : "Primero agrega un recuerdo bonito que no sea un tema delicado."}</p>}
    </div>
  </fieldset>;
}
