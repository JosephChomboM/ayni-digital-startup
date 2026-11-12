import { useId } from "react";
import { companionLabels } from "./companionLabels";
import type { CompanionState } from "./companionLabels";

/**
 * Pose física de Ayni en la sala. Solo describe lo que hace el personaje
 * (caminar, saludar, mostrar algo); nunca interpreta emociones de la persona.
 */
export type BuddyPose = "none" | "walk" | "wave" | "present" | "music" | "story";

/** Ayni de cuerpo entero: camina, saluda, gesticula y abre su compartimento de música. */
export function AyniBuddy({ state, pose }: { state: CompanionState; pose: BuddyPose }) {
  const id = useId();
  return <div className="ayni-buddy" data-state={state} data-pose={pose} role="img" aria-label={companionLabels[state]}>
    <svg viewBox="0 0 200 300" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-shell`} x1="40" y1="40" x2="160" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffdf5"/><stop offset="1" stopColor="#c7e2d5"/>
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="44" y1="58" x2="156" y2="126" gradientUnits="userSpaceOnUse">
          <stop stopColor="#294c43"/><stop offset="1" stopColor="#122e28"/>
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="100" cy="193" r="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbe6a8"/><stop offset="1" stopColor="#e7a76f"/>
        </radialGradient>
      </defs>
      <ellipse className="buddy-shadow" cx="100" cy="290" rx="54" ry="8" fill="#3b2a14" opacity=".14"/>

      <g className="buddy-body">
        <g className="buddy-leg buddy-leg-left">
          <rect x="70" y="220" width="22" height="50" rx="11" fill="#90baaa"/>
          <ellipse cx="78" cy="274" rx="19" ry="10" fill="#467967"/>
        </g>
        <g className="buddy-leg buddy-leg-right">
          <rect x="108" y="220" width="22" height="50" rx="11" fill="#90baaa"/>
          <ellipse cx="122" cy="274" rx="19" ry="10" fill="#467967"/>
        </g>

        <g className="buddy-torso">
          <rect x="56" y="148" width="88" height="86" rx="32" fill={`url(#${id}-shell)`} stroke="#98bdab" strokeWidth="2"/>
          <rect x="78" y="176" width="44" height="36" rx="12" fill="#1d3b33"/>
          <circle className="buddy-core" cx="100" cy="194" r="11" fill={`url(#${id}-glow)`}/>
          <path className="buddy-core-note" d="M97 199v-11l8-2v10m-8 3a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm8-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z"
            stroke="#1d3b33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <g className="buddy-hatch">
            <rect x="78" y="176" width="44" height="36" rx="12" fill="#e6f1e8" stroke="#98bdab" strokeWidth="2"/>
            <path d="M94 190C91 184 84 189 88 193L100 202L112 193C116 189 109 184 106 190L100 195Z" fill="#c56748"/>
          </g>
        </g>

        <g className="buddy-head">
          <rect x="94" y="136" width="12" height="16" rx="5" fill="#90baaa"/>
          <path className="buddy-antenna" d="M100 42V22" stroke="#467967" strokeWidth="6" strokeLinecap="round"/>
          <circle className="buddy-light" cx="100" cy="15" r="10" fill="#edab7c" stroke="#fff6dd" strokeWidth="4"/>
          <rect x="16" y="76" width="18" height="38" rx="9" fill="#90baaa"/>
          <rect x="166" y="76" width="18" height="38" rx="9" fill="#90baaa"/>
          <rect x="28" y="40" width="144" height="104" rx="42" fill={`url(#${id}-shell)`} stroke="#98bdab" strokeWidth="2"/>
          <path d="M50 58Q63 48 80 52" stroke="white" strokeWidth="5" strokeLinecap="round"/>
          <rect x="43" y="60" width="114" height="68" rx="27" fill={`url(#${id}-face)`}/>
          <g className="buddy-eyes" fill="#d6efbb">
            <rect x="69" y="78" width="12" height="21" rx="6"/>
            <rect x="119" y="78" width="12" height="21" rx="6"/>
          </g>
          <g className="buddy-eyes-closed" stroke="#d6efbb" strokeWidth="3.5" strokeLinecap="round">
            <path d="M68 92Q75 97 82 92"/><path d="M118 92Q125 97 132 92"/>
          </g>
          <ellipse cx="60" cy="106" rx="9" ry="4" fill="#f3c09b" opacity=".4"/>
          <ellipse cx="140" cy="106" rx="9" ry="4" fill="#f3c09b" opacity=".4"/>
          <path className="buddy-smile" d="M89 107Q100 118 111 107" stroke="#d6efbb" strokeWidth="3" strokeLinecap="round"/>
          <g className="buddy-mouth" stroke="#d6efbb" strokeWidth="4" strokeLinecap="round">
            <path d="M87 106V112"/><path d="M95 102V116"/><path d="M103 104V114"/><path d="M111 106V112"/>
          </g>
          <g className="buddy-thinking" fill="#edce84">
            <circle cx="176" cy="30" r="4"/><circle cx="188" cy="18" r="5.5"/><circle cx="198" cy="2" r="7"/>
          </g>
          <g className="buddy-sleep" fill="#467967" fontFamily="Georgia, serif" fontWeight="700">
            <text x="168" y="40" fontSize="16">z</text><text x="182" y="22" fontSize="21">z</text>
          </g>
        </g>

        {/* Los brazos van al final para poder cruzar delante de la cabeza al escuchar o pensar. */}
        <g className="buddy-arm buddy-arm-left">
          <rect x="40" y="156" width="20" height="58" rx="10" fill="#90baaa"/>
          <circle cx="49" cy="220" r="12" fill="#d9e9dd" stroke="#8eb7a4" strokeWidth="2"/>
        </g>
        <g className="buddy-arm buddy-arm-right">
          <rect x="140" y="156" width="20" height="58" rx="10" fill="#90baaa"/>
          <circle cx="151" cy="220" r="12" fill="#d9e9dd" stroke="#8eb7a4" strokeWidth="2"/>
        </g>
      </g>

      <g className="buddy-notes" fill="#b94c35">
        <path d="M150 168v-16l9-3v13" stroke="#b94c35" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <circle cx="147" cy="169" r="4"/><circle cx="156" cy="163" r="4"/>
        <path d="M44 160v-14" stroke="#235c50" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="41" cy="161" r="4" fill="#235c50"/>
      </g>
    </svg>
  </div>;
}
