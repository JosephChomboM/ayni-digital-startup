import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

interface Player { play: () => void; pause: () => void; restart: () => void; destroy: () => void; volume?: (value: number) => void }
interface YouTubePlayer {
  playVideo: () => void; pauseVideo: () => void; seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void; setVolume: (value: number) => void;
}
interface YouTubeApi { Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer }
interface SpotifyController {
  play: () => void; pause: () => void; restart: () => void; destroy: () => void;
  addListener: (event: string, callback: (event: { data: { isPaused: boolean; isBuffering: boolean } }) => void) => void;
}
interface SpotifyApi { createController: (element: HTMLElement, options: { uri: string; width: string; height: number }, ready: (controller: SpotifyController) => void) => void }
type MusicWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
  onSpotifyIframeApiReady?: (api: SpotifyApi) => void;
};
let youtube: Promise<YouTubeApi> | undefined;
let spotify: Promise<SpotifyApi> | undefined;

function youtubeApi() {
  const host = window as MusicWindow;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  youtube ??= new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("YouTube no respondió.")), 15000);
    host.onYouTubeIframeAPIReady = () => { window.clearTimeout(timeout); if (host.YT) resolve(host.YT); };
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => { window.clearTimeout(timeout); reject(new Error("No pudimos cargar YouTube.")); };
    document.head.append(script);
  }).catch(error => { youtube = undefined; throw error; });
  return youtube;
}

function spotifyApi() {
  const host = window as MusicWindow;
  spotify ??= new Promise<SpotifyApi>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("Spotify no respondió.")), 15000);
    host.onSpotifyIframeApiReady = api => { window.clearTimeout(timeout); resolve(api); };
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.onerror = () => { window.clearTimeout(timeout); reject(new Error("No pudimos cargar Spotify.")); };
    document.head.append(script);
  }).catch(error => { spotify = undefined; throw error; });
  return spotify;
}

export function musicSource(value: string): { provider: "youtube" | "spotify"; id: string } | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const video = url.hostname === "youtu.be" ? url.pathname.slice(1) : ["youtube.com", "www.youtube.com", "www.youtube-nocookie.com"].includes(url.hostname)
      ? url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] : null;
    if (video && /^[\w-]{11}$/.test(video)) return { provider: "youtube", id: video };
    const track = url.hostname === "open.spotify.com" ? url.pathname.match(/^\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]{22})(?:\/|$)/)?.[1] : null;
    if (track) return { provider: "spotify", id: track };
  } catch { /* El enlace sigue disponible para abrirlo manualmente. */ }
  return null;
}

export function MusicPlayer({ url, title, paused }: { url: string; title: string; paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const sessionPaused = useRef(paused);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("Preparando la canción…");
  const [volume, setVolume] = useState(70);
  const source = musicSource(url);
  const provider = source?.provider;
  const id = source?.id;

  useEffect(() => { sessionPaused.current = paused; }, [paused]);

  useEffect(() => {
    if (!host.current || !provider || !id) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    player.current = null;
    setReady(false);
    setPlaying(false);
    setStatus("Preparando la canción…");
    const element = document.createElement("div");
    host.current.replaceChildren(element);
    function playback(active: boolean) {
      if (disposed) return;
      setPlaying(active);
      setStatus(active ? `Reproduciendo ${title}` : "Música en pausa.");
    }
    function loaded(control: Player) {
      if (disposed) { control.destroy(); return; }
      player.current = control;
      setReady(true);
      if (sessionPaused.current) { control.pause(); setStatus("Música en pausa."); }
      else { setStatus("Solicitando reproducción… Si no empieza, pulsa Reproducir música."); control.play(); }
    }
    if (provider === "youtube") {
      void youtubeApi().then(api => {
        if (disposed) return;
        const instance = new api.Player(element, {
          videoId: id, host: "https://www.youtube-nocookie.com", width: "100%", height: 240,
          playerVars: { origin: window.location.origin, playsinline: 1 },
          events: {
            onReady: (event: { target: YouTubePlayer }) => {
              event.target.setVolume(70);
              loaded({ play: () => event.target.playVideo(), pause: () => event.target.pauseVideo(), restart: () => event.target.seekTo(0, true), destroy: () => event.target.destroy(), volume: value => event.target.setVolume(value) });
            },
            onStateChange: (event: { data: number }) => {
              if (event.data === 1) playback(true);
              if ([0, 2, 5].includes(event.data)) playback(false);
              if (event.data === 3 && !disposed) setStatus("Cargando la canción…");
            },
            onAutoplayBlocked: () => { if (!disposed) { playback(false); setStatus("El navegador pide que pulses Reproducir música para empezar."); } },
            onError: () => { if (!disposed) { playback(false); setStatus("YouTube no pudo reproducir esta canción. Puedes abrir su enlace."); } },
          },
        });
        cleanup = () => instance.destroy();
      }).catch(error => { if (!disposed) setStatus(error.message); });
    } else {
      void spotifyApi().then(api => {
        if (disposed) return;
        api.createController(element, { uri: `spotify:track:${id}`, width: "100%", height: 232 }, control => {
          cleanup = () => control.destroy();
          if (disposed) { cleanup(); return; }
          control.addListener("playback_update", event => {
            if (disposed) return;
            if (event.data.isBuffering) setStatus("Cargando la canción…");
            else playback(!event.data.isPaused);
          });
          control.addListener("ready", () => loaded(control));
        });
      }).catch(error => { if (!disposed) setStatus(error.message); });
    }
    return () => { disposed = true; cleanup?.(); player.current = null; };
  }, [provider, id, title]);

  useEffect(() => { if (paused) player.current?.pause(); }, [paused]);
  if (!source) return <a href={url} target="_blank" rel="noopener noreferrer">Abrir la canción</a>;

  return <div className="music-player" aria-label={`Música: ${title}`}>
    <div ref={host} className="music-embed" />
    <p role="status">{status}</p>
    <div className="music-controls">
      <button type="button" disabled={!ready || paused} onClick={() => { setStatus("Solicitando reproducción…"); player.current?.play(); }} aria-label="Reproducir música" aria-pressed={playing}><Play size={18}/>Reproducir</button>
      <button type="button" disabled={!ready} onClick={() => player.current?.pause()} aria-label="Pausar música"><Pause size={18}/>Pausar</button>
      <button type="button" disabled={!ready || paused} onClick={() => player.current?.restart()} aria-label="Reiniciar canción"><RotateCcw size={18}/></button>
    </div>
    {provider === "youtube" && <label className="music-volume">Volumen de la música
      <input aria-label="Volumen de la música" type="range" min="0" max="100" value={volume} disabled={!ready} onChange={event => { const next = Number(event.target.value); setVolume(next); player.current?.volume?.(next); }}/>
    </label>}
    <a href={url} target="_blank" rel="noopener noreferrer">Abrir en {provider === "youtube" ? "YouTube" : "Spotify"}</a>
  </div>;
}
