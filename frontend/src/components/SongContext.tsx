import { useEffect, useState } from "react";
import { getSongContext, confirmSongContext } from "../api/songContext";
import type { SongContext as Context } from "../api/songContext";
import { Button } from "./ui/button";

export function SongContext({ memoryId }: { memoryId: string }) {
  const [context, setContext] = useState<Context | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    getSongContext(memoryId).then((value) => { if (active) setContext(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [memoryId]);
  async function load(recordingId?: string) {
    setBusy(true); setError("");
    try { setContext(recordingId ? await confirmSongContext(memoryId, recordingId) : await getSongContext(memoryId, true, search)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos consultar los datos."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Contexto de la canción" className="space-y-2 rounded-lg border p-3 text-sm">
    <h4 className="font-semibold">Sobre esta canción</h4>
    {context?.status === "confirmed" ? <>
      <p>Artista: {context.artist || "No disponible"}</p>
      <p>Año de la grabación: {context.year || "No disponible"}</p>
      <p>Género: {context.genres?.join(", ") || "No disponible"}</p>
      {!context.genres?.length && Boolean(context.artist_genres?.length) && <p>Géneros asociados al artista: {context.artist_genres?.join(", ")}</p>}
      <p>Grabación confirmada por la familia. Ayni usará estos datos al conversar.</p>
      <a href={context.source_url} target="_blank" rel="noreferrer" className="underline">Fuente: MusicBrainz</a>
    </> : <>
      <p>Consulta datos de la grabación. El canal del video puede ser distinto del artista.</p>
      <label className="block">Artista y canción (opcional)<input className="mt-1 block w-full rounded border p-2" maxLength={200} placeholder="Por ejemplo: Rick Astley - Never Gonna Give You Up" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {context?.channel && <p>Canal: {context.channel}</p>}
      <Button variant="outline" disabled={busy} onClick={() => void load()}>{busy ? "Consultando…" : "Buscar artista, año y género"}</Button>
      {context?.status === "needs_confirmation" && <><p>¿Cuál coincide con la canción del enlace?</p>{context.candidates?.map((item) => <div key={item.recording_id} className="rounded border p-2"><p>{item.title} — {item.artist || "Artista sin confirmar"} {item.year ? `(${item.year})` : ""}</p>{item.version && <p>{item.version}</p>}<Button variant="outline" disabled={busy} onClick={() => void load(item.recording_id)}>Es esta grabación</Button></div>)}</>}
      {context?.status === "unavailable" && <p>No hay datos confirmados. Puedes escuchar la canción igualmente.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
