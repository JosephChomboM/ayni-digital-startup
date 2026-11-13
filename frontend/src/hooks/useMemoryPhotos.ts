import { useEffect, useState } from "react";
import { listPhotosForMemories } from "../api/memories";
import type { FamilyMemoryPhoto, Memory } from "../api/memories";

const SIGNED_URL_REFRESH_MS = 4 * 60 * 1000;

export function useMemoryPhotos(memories: Memory[]) {
  const [photos, setPhotos] = useState<FamilyMemoryPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedForKey, setLoadedForKey] = useState<string | null>(null);
  const memoryKey = memories.map((memory) => memory.id).join(",");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!memories.length) {
        if (active) { setPhotos([]); setError(null); setLoading(false); setLoadedForKey(memoryKey); }
        return;
      }
      if (active) setLoading(true);
      try {
        const freshPhotos = await listPhotosForMemories(memories);
        if (active) { setPhotos(freshPhotos); setError(null); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No pudimos cargar las fotos.");
      } finally {
        if (active) { setLoading(false); setLoadedForKey(memoryKey); }
      }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, SIGNED_URL_REFRESH_MS);
    const onReturn = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [memories, memoryKey]);

  return { photos, error, loading, loaded: loadedForKey === memoryKey };
}
