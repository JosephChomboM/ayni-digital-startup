import { useId } from "react";

import { companionLabels } from "./companionLabels";
import type { CompanionState } from "./companionLabels";

export type { CompanionState };

/** El movimiento refleja el estado de la conversación; no interpreta emociones. */
export function AyniCompanion({ state = "idle", className = "", decorative = false }: {
  state?: CompanionState; className?: string; decorative?: boolean;
}) {
  const id = useId();
  return <div className={`ayni-robot ${className}`} data-state={state} role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : companionLabels[state]} aria-hidden={decorative || undefined}>
    <svg viewBox="0 0 260 250" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-shell`} x1="70" y1="45" x2="185" y2="202" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffdf5"/><stop offset="1" stopColor="#c7e2d5"/>
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="78" y1="95" x2="181" y2="154" gradientUnits="userSpaceOnUse">
          <stop stopColor="#294c43"/><stop offset="1" stopColor="#122e28"/>
        </linearGradient>
      </defs>
      <ellipse className="robot-shadow" cx="130" cy="225" rx="59" ry="10" fill="#1f5140" opacity=".12"/>
      <g className="robot-body">
        <path className="robot-antenna" d="M130 68V44" stroke="#467967" strokeWidth="7" strokeLinecap="round"/>
        <circle className="robot-light" cx="130" cy="36" r="12" fill="#edab7c" stroke="#fff6dd" strokeWidth="4"/>
        <rect x="36" y="108" width="24" height="45" rx="12" fill="#90baaa"/>
        <rect x="200" y="108" width="24" height="45" rx="12" fill="#90baaa"/>
        <path className="robot-hand robot-hand-left" d="M78 173Q34 169 39 191Q43 207 67 192" fill="#d9e9dd" stroke="#8eb7a4" strokeWidth="2"/>
        <path className="robot-hand" d="M182 173Q226 169 221 191Q217 207 193 192" fill="#d9e9dd" stroke="#8eb7a4" strokeWidth="2"/>
        <rect x="84" y="165" width="92" height="47" rx="23" fill={`url(#${id}-shell)`} stroke="#98bdab" strokeWidth="2"/>
        <path d="M124 185C120 176 109 183 115 189L130 200L145 189C151 183 140 176 136 185L130 190Z" fill="#c56748"/>
        <rect x="53" y="65" width="154" height="112" rx="44" fill={`url(#${id}-shell)`} stroke="#98bdab" strokeWidth="2"/>
        <path d="M75 84Q89 73 106 77" stroke="white" strokeWidth="5" strokeLinecap="round"/>
        <rect x="68" y="88" width="124" height="72" rx="29" fill={`url(#${id}-face)`}/>
        <g className="robot-eyes" fill="#d6efbb">
          <rect x="93" y="108" width="12" height="21" rx="6"/>
          <rect x="155" y="108" width="12" height="21" rx="6"/>
        </g>
        <ellipse cx="87" cy="135" rx="9" ry="4" fill="#f3c09b" opacity=".35"/>
        <ellipse cx="173" cy="135" rx="9" ry="4" fill="#f3c09b" opacity=".35"/>
        <path className="robot-smile" d="M119 136Q130 147 141 136" stroke="#d6efbb" strokeWidth="3" strokeLinecap="round"/>
        <g className="robot-speech" stroke="#d6efbb" strokeWidth="4" strokeLinecap="round">
          <path d="M117 134V140"/><path d="M125 130V144"/><path d="M133 132V142"/><path d="M141 134V140"/>
        </g>
      </g>
    </svg>
  </div>;
}
