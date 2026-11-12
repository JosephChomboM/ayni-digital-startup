import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Music2, X } from "lucide-react";
import type { Memory } from "../api/memories";
import type { MemoryPhoto } from "../api/photos";
import { AyniBuddy } from "./AyniBuddy";
import type { BuddyPose } from "./AyniBuddy";
import type { CompanionState } from "./AyniCompanion";
import type { CompanionTheme, ThemeId } from "./companionTheme";

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
export function CompanionScene({ state, scene, line, pending, paused, extra, camera, theme }: {
  state: CompanionState;
  scene?: StageScene;
  line: string;
  pending: boolean;
  paused: boolean;
  extra?: ReactNode;
  /** La cámara de la persona, como un espejo en la pared de la sala. */
  camera?: ReactNode;
  /** Ropa de Ayni y objetos de la sala según los gustos del perfil. */
  theme?: CompanionTheme;
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

  return <div className="buddy-stage" data-scene={kind} data-camera={camera ? true : undefined} data-theme={theme?.outfit ?? undefined} data-arrived={arrived || undefined} data-paused={paused || undefined}>
    <div className="stage-room" aria-hidden="true">
      <span className="room-window"/>
      <svg className="room-plant" viewBox="0 0 80 120"><path d="M40 78C38 52 22 40 8 38c4 18 16 30 32 40Zm0 0c2-30 14-48 32-54-2 24-14 42-32 54Zm0 0c-1-24-4-44-10-62 12 10 16 34 10 62Z" fill="#7fa58d"/><path d="M22 76h36l-5 40H27Z" fill="#c98a62"/></svg>
      <span className="room-rug"/>
      {theme?.decor.map((item, index) => <RoomDecor key={item} item={item}
        slot={WALL_DECOR.includes(item) ? "wall" : theme.decor.slice(0, index).some((other) => !WALL_DECOR.includes(other)) ? "floor2" : "floor"} />)}
    </div>

    {theme?.description && <p className="sr-only">{theme.description}.</p>}
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
      <AyniBuddy state={state} pose={pose} outfit={theme?.outfit} />
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

/** Objetos de la sala que recuerdan los gustos de la persona (decorativos). */
const WALL_DECOR: ThemeId[] = ["cooking", "sea"];

function RoomDecor({ item, slot }: { item: ThemeId; slot: "floor" | "floor2" | "wall" }) {
  const art: Record<ThemeId, ReactNode> = {
    music: <svg viewBox="0 0 80 150"><g transform="rotate(-12 40 80)">
      <rect x="35" y="6" width="10" height="70" rx="3" fill="#7a4a2c"/><rect x="31" y="2" width="18" height="14" rx="4" fill="#5e3820"/>
      <path d="M40 70C14 70 10 92 20 102C8 116 16 146 40 146C64 146 72 116 60 102C70 92 66 70 40 70Z" fill="#c98a4b"/>
      <circle cx="40" cy="104" r="9" fill="#3b2a14"/><rect x="30" y="126" width="20" height="5" rx="2" fill="#5e3820"/></g></svg>,
    garden: <svg viewBox="0 0 120 90">
      {[14, 60, 106].map((x, i) => <g key={x}>
        <path d={`M${x} 52V${30 - i * 4}`} stroke="#5f8b70" strokeWidth="3"/>
        <g fill={["#f2a097", "#edce84", "#e98f9d"][i]}><circle cx={x - 6} cy={28 - i * 4} r="6"/><circle cx={x + 6} cy={28 - i * 4} r="6"/><circle cx={x} cy={22 - i * 4} r="6"/><circle cx={x} cy={34 - i * 4} r="6"/></g>
        <circle cx={x} cy={28 - i * 4} r="4" fill="#fff6dd"/>
        <path d={`M${x - 14} 52H${x + 14}L${x + 10} 86H${x - 10}Z`} fill="#c98a62"/></g>)}</svg>,
    cooking: <svg viewBox="0 0 140 70">
      <rect x="0" y="56" width="140" height="8" rx="3" fill="#a7774f"/><path d="M14 64L22 70M126 64L118 70" stroke="#a7774f" strokeWidth="4"/>
      <rect x="12" y="28" width="44" height="28" rx="6" fill="#b8c3c2"/><rect x="8" y="24" width="52" height="7" rx="3" fill="#8f9c9b"/><circle cx="34" cy="20" r="4" fill="#b94c35"/>
      <path d="M74 36H118V50Q118 56 112 56H80Q74 56 74 50Z" fill="#b94c35"/><path d="M118 40H134" stroke="#2f3b38" strokeWidth="5" strokeLinecap="round"/></svg>,
    football: <svg viewBox="0 0 70 70"><circle cx="35" cy="35" r="32" fill="#fffefa" stroke="#2f3b38" strokeWidth="3"/>
      <path d="M35 22L47 31L42 45H28L23 31Z" fill="#2f3b38"/><path d="M35 22V4M47 31L64 26M42 45L52 62M28 45L18 62M23 31L6 26" stroke="#2f3b38" strokeWidth="2.5"/></svg>,
    knitting: <svg viewBox="0 0 110 80">
      <circle cx="34" cy="34" r="18" fill="#b94c35"/><circle cx="64" cy="30" r="16" fill="#edce84"/><circle cx="84" cy="38" r="14" fill="#7fa58d"/>
      <path d="M22 28Q34 40 46 26M54 26Q64 36 76 24" stroke="#ffffff66" strokeWidth="2" fill="none"/>
      <path d="M6 40H104L96 78H14Z" fill="#c99a45"/><path d="M10 52H100M12 64H98" stroke="#a87c2f" strokeWidth="3"/>
      <path d="M70 18L96 2M76 22L102 8" stroke="#8f9c9b" strokeWidth="3" strokeLinecap="round"/></svg>,
    reading: <svg viewBox="0 0 110 110"><rect x="2" y="2" width="106" height="106" rx="4" fill="#a7774f"/>
      <rect x="10" y="10" width="90" height="40" fill="#7a4a2c"/><rect x="10" y="58" width="90" height="42" fill="#7a4a2c"/>
      {[["#b94c35", 12, 30], ["#235c50", 26, 34], ["#edce84", 40, 28], ["#7fa5b8", 54, 36], ["#c56748", 68, 30], ["#467967", 82, 33]].map(([color, x, h]) =>
        <rect key={String(x)} x={Number(x)} y={50 - Number(h)} width="12" height={Number(h)} fill={String(color)}/>)}
      {[["#edce84", 14, 34], ["#b94c35", 28, 38], ["#7fa58d", 42, 30], ["#235c50", 56, 36]].map(([color, x, h]) =>
        <rect key={String(x)} x={Number(x)} y={100 - Number(h)} width="12" height={Number(h)} fill={String(color)}/>)}</svg>,
    pets: <svg viewBox="0 0 100 100"><g className="decor-dog">
      <path className="dog-tail" d="M74 70Q94 62 90 44" stroke="#c98a4b" strokeWidth="7" strokeLinecap="round" fill="none"/>
      <ellipse cx="56" cy="74" rx="24" ry="20" fill="#d9a066"/>
      <rect x="40" y="80" width="10" height="18" rx="5" fill="#c98a4b"/><rect x="58" y="80" width="10" height="18" rx="5" fill="#c98a4b"/>
      <circle cx="38" cy="46" r="20" fill="#d9a066"/><path d="M22 34Q12 46 20 62L28 44Z M50 30Q62 40 56 58L48 42Z" fill="#a8693a"/>
      <circle cx="31" cy="44" r="3" fill="#2f3b38"/><circle cx="45" cy="44" r="3" fill="#2f3b38"/><ellipse cx="38" cy="54" rx="5" ry="3.5" fill="#2f3b38"/>
      <path d="M36 62Q38 68 42 62" fill="#e98f9d"/></g></svg>,
    sea: <svg viewBox="0 0 120 90"><rect x="2" y="2" width="116" height="86" fill="#fffaf0" stroke="#c98a62" strokeWidth="6"/>
      <rect x="10" y="10" width="100" height="40" fill="#cfe6ef"/><circle cx="86" cy="26" r="9" fill="#edce84"/>
      <rect x="10" y="50" width="100" height="30" fill="#7fa5b8"/>
      <path d="M10 54Q22 48 34 54T58 54T82 54T110 54M10 66Q22 60 34 66T58 66T82 66T110 66" stroke="#fffaf0" strokeWidth="3" fill="none"/>
      <path d="M38 44H62L56 50H44Z" fill="#b94c35"/><path d="M50 44V30L60 40Z" fill="#fffaf0"/></svg>,
  };
  return <span className={`room-decor decor-${slot} decor-${item}`}>{art[item]}</span>;
}
