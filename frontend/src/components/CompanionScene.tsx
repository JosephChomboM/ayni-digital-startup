import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Music2, X } from "lucide-react";
import type { Memory } from "../api/memories";
import type { MemoryPhoto } from "../api/photos";
import { AyniBuddy } from "./AyniBuddy";
import type { BuddyPose } from "./AyniBuddy";
import type { CompanionState } from "./AyniCompanion";
import type { LookSpec } from "../api/sessions";
import { ROOM_ICONS } from "./roomIcons";

/** Lo que Ayni tiene "en las manos" durante la sesión. */
export type StageScene =
  | { kind: "photo"; photos: MemoryPhoto[]; index: number; onChange: (index: number) => void }
  | { kind: "song"; memory: Memory }
  | { kind: "anecdote"; title: string; text: string };

const WALK_MS = 1500;

function prefersReducedMotion() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function playerUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const youtubeId = url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : url.hostname === "youtube.com" || url.hostname === "www.youtube.com"
        ? url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1]
        : null;
    if (youtubeId && /^[\w-]{11}$/.test(youtubeId)) return `https://www.youtube-nocookie.com/embed/${youtubeId}`;
    const spotifyId = url.hostname === "open.spotify.com" ? url.pathname.match(/\/track\/([A-Za-z0-9]{22})/)?.[1] : null;
    if (spotifyId) return `https://open.spotify.com/embed/track/${spotifyId}`;
  } catch { return null; }
  return null;
}

/**
 * La sala donde Ayni conversa: entra caminando, saluda, y cuando cambia la actividad
 * camina hacia un lado para entregar la foto, sacar la radio o desplegar la historia.
 */
export function CompanionScene({ state, scene, line, pending, paused, extra, camera, look }: {
  state: CompanionState;
  scene?: StageScene;
  line: string;
  pending: boolean;
  paused: boolean;
  extra?: ReactNode;
  /** La cámara de la persona, como un espejo en la pared de la sala. */
  camera?: ReactNode;
  /** Ropa de Ayni, paredes y objetos de la sala diseñados según los gustos del perfil. */
  look?: LookSpec | null;
}) {
  const kind = scene?.kind ?? "none";
  const [reduced] = useState(prefersReducedMotion);
  const [arrived, setArrived] = useState(reduced);
  const [gesture, setGesture] = useState<"walk" | "wave" | null>(reduced ? null : "walk");
  const previousKind = useRef(kind);

  useEffect(() => {
    if (reduced) return;
    // Un temporizador (no requestAnimationFrame) para que Ayni entre aunque la pestaña abra en segundo plano.
    const enter = window.setTimeout(() => setArrived(true), 40);
    const wave = window.setTimeout(() => setGesture("wave"), WALK_MS + 100);
    const rest = window.setTimeout(() => setGesture(null), WALK_MS + 2600);
    return () => { window.clearTimeout(enter); window.clearTimeout(wave); window.clearTimeout(rest); };
  }, [reduced]);

  useEffect(() => {
    if (reduced || previousKind.current === kind) return;
    previousKind.current = kind;
    setGesture("walk");
    const rest = window.setTimeout(() => setGesture(null), WALK_MS);
    return () => window.clearTimeout(rest);
  }, [kind, reduced]);

  const pose: BuddyPose = gesture ?? (paused ? "none" : kind === "song" ? "music" : kind === "photo" ? "present" : kind === "anecdote" ? "story" : "none");
  const words = line.split(/(\s+)/);

  return <div className="buddy-stage" data-scene={kind} data-camera={camera ? true : undefined} data-look={look ? true : undefined}
    style={look ? { "--wall-a": look.wall[0], "--wall-b": look.wall[1] } as CSSProperties : undefined} data-arrived={arrived || undefined} data-paused={paused || undefined}>
    <div className="stage-room" aria-hidden="true">
      <span className="room-window"/>
      <svg className="room-plant" viewBox="0 0 80 120"><path d="M40 78C38 52 22 40 8 38c4 18 16 30 32 40Zm0 0c2-30 14-48 32-54-2 24-14 42-32 54Zm0 0c-1-24-4-44-10-62 12 10 16 34 10 62Z" fill="#7fa58d"/><path d="M22 76h36l-5 40H27Z" fill="#c98a62"/></svg>
      <span className="room-rug"/>
      {look?.decor.map((item, index) => <RoomDecor key={item.icon + look.description} icon={item.icon} color={look.accent_color}
        slot={`${item.place}${look.decor.slice(0, index).filter((other) => other.place === item.place).length ? "2" : ""}`} />)}
    </div>

    {look?.description && <p className="sr-only">{look.description}.</p>}
    <div className="stage-speech" data-pending={pending || undefined}>
      <p key={line} className="speech-line">
        {words.map((word, index) => /^\s+$/.test(word) ? word :
          <span key={index} style={{ "--i": index / 2 } as CSSProperties}>{word}</span>)}
      </p>
      {pending && <span className="speech-dots" aria-hidden="true"><i/><i/><i/></span>}
    </div>

    {scene && <div className="stage-prop" key={kind}>
      {scene.kind === "photo" && <PhotoFrame {...scene} />}
      {scene.kind === "song" && <RadioPlayer memory={scene.memory} paused={paused} />}
      {scene.kind === "anecdote" && <article className="stage-letter" aria-label="Historia familiar">
        <h3>{scene.title}</h3>
        <p>{scene.text}</p>
      </article>}
      {extra}
    </div>}

    {camera && <div className="stage-camera">{camera}</div>}

    <div className="buddy-walker">
      <AyniBuddy state={state} pose={pose} look={look} />
    </div>
  </div>;
}

function PhotoFrame({ photos, index, onChange }: { photos: MemoryPhoto[]; index: number; onChange: (index: number) => void }) {
  const [zoomed, setZoomed] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const position = index % photos.length;
  const photo = photos[position];
  useEffect(() => { if (zoomed) close.current?.focus(); }, [zoomed]);
  if (!photo) return null;
  const shut = () => { setZoomed(false); opener.current?.focus(); };
  return <figure className="stage-photo">
    <button ref={opener} type="button" className="photo-mat" aria-label="Ver la foto en grande" onClick={() => setZoomed(true)}>
      <img key={photo.id} src={photo.url} alt="Foto familiar" />
    </button>
    <figcaption>
      {photos.length > 1 && <button type="button" className="photo-step" aria-label="Foto anterior"
        onClick={() => onChange((position - 1 + photos.length) % photos.length)}><ChevronLeft aria-hidden="true" /></button>}
      <span>Foto {position + 1} de {photos.length}</span>
      {photos.length > 1 && <button type="button" className="photo-step" aria-label="Siguiente foto"
        onClick={() => onChange((position + 1) % photos.length)}><ChevronRight aria-hidden="true" /></button>}
    </figcaption>
    {zoomed && createPortal(<div className="photo-zoom" role="dialog" aria-modal="true" aria-label="Foto en grande"
      onKeyDown={(event) => { if (event.key === "Escape") shut(); }} onClick={(event) => { if (event.target === event.currentTarget) shut(); }}>
      <img src={photo.url} alt="Foto familiar en grande" />
      <button ref={close} type="button" onClick={shut}><X aria-hidden="true" />Cerrar</button>
    </div>, document.body)}
  </figure>;
}

function RadioPlayer({ memory, paused }: { memory: Memory; paused: boolean }) {
  const src = playerUrl(memory.url);
  return <div className="stage-radio">
    <span className="radio-handle" aria-hidden="true"/>
    <div className="radio-face">
      <span className="radio-grille" aria-hidden="true"/>
      <div className="radio-screen">
        {paused ? <p>La música espera la pausa.</p> : src ?
          <iframe title={`Reproducir ${memory.title}`} src={src} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" /> :
          memory.url ? <a href={memory.url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Abrir la canción</a> :
            <p>Esta canción no tiene enlace.</p>}
      </div>
    </div>
    <div className="radio-dial">
      <span className="radio-knob" aria-hidden="true"/>
      <p>{memory.title}</p>
      <span className="radio-knob" aria-hidden="true"/>
    </div>
    {!paused && <span className="radio-notes" aria-hidden="true"><Music2/><Music2/><Music2/></span>}
  </div>;
}

/** Objeto de la sala elegido por la IA: un cuadro en la pared o algo sobre una mesita. */
function RoomDecor({ icon, color, slot }: { icon: string; color: string; slot: string }) {
  const Icon = ROOM_ICONS[icon];
  if (!Icon) return null;
  const ink = /^#(?:f|e)/i.test(color) ? "#235c50" : color;
  return <span className={`room-decor decor-${slot}`}>
    {slot.startsWith("wall") ? <span className="decor-frame"><Icon style={{ color: ink }} strokeWidth={1.6} /></span> :
      <span className="decor-stand"><Icon style={{ color: ink }} strokeWidth={1.6} /><i/></span>}
  </span>;
}
