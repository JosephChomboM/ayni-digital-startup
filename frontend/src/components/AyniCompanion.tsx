import { useId } from "react";

import { companionLabels } from "./companionLabels";
import type { CompanionState } from "./companionLabels";

export type { CompanionState };
export type CompanionMood = "warm" | "curious" | "joyful";
export type OwlAnimation = "none" | "walk" | "wave" | "present" | "music" | "story";

/** El movimiento acompaña el estado de la conversación; no interpreta emociones. */
export function AyniCompanion({ state = "idle", mood = "warm", animation = "none", className = "", decorative = false }: {
  state?: CompanionState; mood?: CompanionMood; animation?: OwlAnimation; className?: string; decorative?: boolean;
}) {
  const id = useId();
  return <div className={`ayni-robot ayni-owl ${className}`} data-state={state} data-mood={mood} data-animation={animation} role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : companionLabels[state]} aria-hidden={decorative || undefined}>
    <svg viewBox="0 0 260 250" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-feathers`} x1="72" y1="44" x2="190" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#397a98"/><stop offset="1" stopColor="#2c5f7c"/>
        </linearGradient>
        <linearGradient id={`${id}-breast`} x1="90" y1="103" x2="175" y2="203" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffdf8"/><stop offset="1" stopColor="#f3e8d6"/>
        </linearGradient>
      </defs>
      <ellipse className="robot-shadow" cx="130" cy="225" rx="60" ry="9" fill="#264653" opacity=".13"/>
      <g className="robot-body">
        <path className="owl-ear owl-ear-left" d="M77 87 67 43Q96 54 111 77" fill="#2c5f7c" stroke="#244f68" strokeWidth="4" strokeLinejoin="round"/>
        <path className="owl-ear owl-ear-right" d="m183 87 10-44q-29 11-44 34" fill="#2c5f7c" stroke="#244f68" strokeWidth="4" strokeLinejoin="round"/>
        <path className="owl-wing owl-wing-left" d="M71 135Q34 145 45 184Q52 208 91 193L106 169Z" fill="#244f68" stroke="#2c5f7c" strokeWidth="3"/>
        <path className="owl-wing owl-wing-right" d="M189 135q37 10 26 49-7 24-46 9l-15-24Z" fill="#244f68" stroke="#2c5f7c" strokeWidth="3"/>
        <path d="M79 94Q78 70 130 68Q182 70 181 94L193 151Q194 197 130 211Q66 197 67 151Z" fill={`url(#${id}-feathers)`} stroke="#244f68" strokeWidth="3"/>
        <path d="M77 126Q84 95 111 95Q124 95 130 108Q136 95 149 95Q176 95 183 126L176 170Q166 197 130 201Q94 197 84 170Z" fill={`url(#${id}-breast)`}/>
        <g className="robot-eyes">
          <g className="owl-eye owl-eye-left">
            <circle cx="105" cy="121" r="23" fill="#fffdf8"/>
            <circle cx="106" cy="122" r="14" fill="#f4d58d"/>
            <circle cx="108" cy="123" r="8" fill="#264653"/>
            <circle cx="111" cy="119" r="3" fill="#fff"/>
          </g>
          <g className="owl-eye owl-eye-right">
            <circle cx="155" cy="121" r="23" fill="#fffdf8"/>
            <circle cx="154" cy="122" r="14" fill="#f4d58d"/>
            <circle cx="152" cy="123" r="8" fill="#264653"/>
            <circle cx="149" cy="119" r="3" fill="#fff"/>
          </g>
        </g>
        <g className="owl-eyes-closed" stroke="#264653" strokeWidth="4" strokeLinecap="round">
          <path d="M87 122q18 12 36 0M137 122q18 12 36 0"/>
        </g>
        <path className="owl-brow owl-brow-left" d="M86 91q18-12 37 0" stroke="#244f68" strokeWidth="5" strokeLinecap="round"/>
        <path className="owl-brow owl-brow-right" d="M137 91q19-12 37 0" stroke="#244f68" strokeWidth="5" strokeLinecap="round"/>
        <ellipse className="owl-blush" cx="82" cy="151" rx="9" ry="5" fill="#e76f51" opacity=".38"/>
        <ellipse className="owl-blush" cx="178" cy="151" rx="9" ry="5" fill="#e76f51" opacity=".38"/>
        <path className="robot-smile owl-beak" d="m121 143 9-9 9 9-9 13Z" fill="#e76f51" stroke="#bf583f" strokeWidth="2" strokeLinejoin="round"/>
        <g className="robot-speech owl-speaking-beak">
          <path d="m120 141 10-8 10 8-10 7Z" fill="#e76f51" stroke="#bf583f" strokeWidth="2" strokeLinejoin="round"/>
          <path d="m123 150 7-2 7 2-7 8Z" fill="#f4a261" stroke="#bf583f" strokeWidth="2" strokeLinejoin="round"/>
        </g>
        <path d="M111 183q19 12 38 0" stroke="#e76f51" strokeWidth="4" strokeLinecap="round" opacity=".8"/>
        <path className="robot-light owl-crest" d="M130 78q-11-11-2-23 4 8 3 13 6-7 13-6-3 11-14 16Z" fill="#f4d58d" stroke="#e9b85c" strokeWidth="2" strokeLinejoin="round"/>
        <g className="owl-feet" fill="#e76f51">
          <path d="M104 204q-8 12-16 12 2 7 18 4l8-11ZM156 204q8 12 16 12-2 7-18 4l-8-11Z"/>
        </g>
      </g>
    </svg>
  </div>;
}
