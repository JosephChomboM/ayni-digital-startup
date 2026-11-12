import { useId } from "react";
import { companionLabels } from "./companionLabels";
import type { CompanionState } from "./companionLabels";
import type { ThemeId } from "./companionTheme";

/**
 * Pose física de Ayni en la sala. Solo describe lo que hace el personaje
 * (caminar, saludar, mostrar algo); nunca interpreta emociones de la persona.
 */
export type BuddyPose = "none" | "walk" | "wave" | "present" | "music" | "story";

/** Ayni de cuerpo entero: camina, saluda, gesticula y abre su compartimento de música. */
const HATS: ThemeId[] = ["music", "garden", "cooking", "knitting", "sea"];

export function AyniBuddy({ state, pose, outfit = null }: { state: CompanionState; pose: BuddyPose; outfit?: ThemeId | null }) {
  const id = useId();
  return <div className="ayni-buddy" data-state={state} data-pose={pose} data-outfit={outfit ?? undefined}
    data-hat={outfit && HATS.includes(outfit) ? true : undefined} role="img" aria-label={companionLabels[state]}>
    <svg viewBox="0 0 200 300" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-shell`} x1="40" y1="40" x2="160" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffdf5"/><stop offset="1" stopColor="#c7e2d5"/>
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="44" y1="58" x2="156" y2="126" gradientUnits="userSpaceOnUse">
          <stop stopColor="#294c43"/><stop offset="1" stopColor="#122e28"/>
        </linearGradient>
        <clipPath id={`${id}-torso`}><rect x="56" y="148" width="88" height="86" rx="32"/></clipPath>
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
          <BodyOutfit outfit={outfit} clip={`url(#${id}-torso)`} />
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
          <HeadOutfit outfit={outfit} />
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

/** Lo que Ayni lleva en la cabeza; se mueve con la cabeza. */
function HeadOutfit({ outfit }: { outfit: ThemeId | null }) {
  switch (outfit) {
    case "music": return <g className="buddy-wear">
      <path d="M50 46Q52 8 100 10Q148 8 150 46Z" fill="#3d4a46"/>
      <rect x="51" y="32" width="98" height="9" fill="#b94c35"/>
      <ellipse cx="100" cy="46" rx="78" ry="10" fill="#2f3b38"/>
    </g>;
    case "garden": return <g className="buddy-wear">
      <ellipse cx="100" cy="46" rx="90" ry="13" fill="#e2bd6c" stroke="#c99a45" strokeWidth="2"/>
      <path d="M58 46Q60 12 100 12Q140 12 142 46Z" fill="#edce84" stroke="#c99a45" strokeWidth="2"/>
      <rect x="59" y="34" width="82" height="7" fill="#7fa58d"/>
      <g fill="#f2a097"><circle cx="128" cy="30" r="5"/><circle cx="136" cy="33" r="5"/><circle cx="133" cy="41" r="5"/><circle cx="123" cy="40" r="5"/><circle cx="121" cy="32" r="5"/></g>
      <circle cx="129" cy="36" r="4" fill="#edab3c"/>
    </g>;
    case "cooking": return <g className="buddy-wear" fill="#fffefa" stroke="#d9d0bf" strokeWidth="2">
      <circle cx="70" cy="22" r="18"/><circle cx="130" cy="22" r="18"/><circle cx="100" cy="12" r="22"/>
      <rect x="60" y="24" width="80" height="24" rx="8"/>
    </g>;
    case "knitting": return <g className="buddy-wear">
      <ellipse cx="94" cy="40" rx="66" ry="17" fill="#b94c35" transform="rotate(-8 94 40)"/>
      <path d="M40 50Q94 30 152 38" stroke="#8d3a27" strokeWidth="3" fill="none"/>
      <circle cx="98" cy="22" r="6" fill="#8d3a27"/>
    </g>;
    case "sea": return <g className="buddy-wear">
      <path d="M50 48L62 16Q100 4 138 16L150 48Z" fill="#7fa5b8"/>
      <path d="M58 30Q100 22 142 30" stroke="#5f8799" strokeWidth="3" fill="none"/>
      <ellipse cx="100" cy="48" rx="72" ry="10" fill="#6a91a5"/>
    </g>;
    case "reading": return <g className="buddy-wear" fill="#ffffff14" stroke="#c98a62" strokeWidth="4">
      <circle cx="75" cy="89" r="18"/><circle cx="125" cy="89" r="18"/>
      <path d="M93 87Q100 81 107 87" fill="none"/><path d="M57 85L44 80M143 85L156 80" fill="none"/>
    </g>;
    default: return null;
  }
}

/** Lo que Ayni lleva en el cuerpo; se mueve con el torso. */
function BodyOutfit({ outfit, clip }: { outfit: ThemeId | null; clip: string }) {
  switch (outfit) {
    case "music": return <g className="buddy-wear">
      <path d="M82 146L100 155L82 164Z M118 146L100 155L118 164Z" fill="#b94c35"/>
      <circle cx="100" cy="155" r="5" fill="#8d3a27"/>
    </g>;
    case "cooking": return <g className="buddy-wear">
      <path d="M84 150L72 168M116 150L128 168" stroke="#e0d6c4" strokeWidth="4"/>
      <path d="M68 166H132V222Q132 230 124 230H76Q68 230 68 222Z" fill="#fffefa" stroke="#e0d6c4" strokeWidth="2"/>
      <path d="M68 212H132" stroke="#b94c35" strokeWidth="4"/>
      <path d="M95 186C92 181 86 185 89 189L100 197L111 189C114 185 108 181 105 186L100 190Z" fill="#c56748"/>
    </g>;
    case "garden": return <g className="buddy-wear">
      <path d="M84 150L74 170M116 150L126 170" stroke="#5f8b70" strokeWidth="4"/>
      <path d="M70 168H130V224Q130 230 124 230H76Q70 230 70 224Z" fill="#7fa58d"/>
      <rect x="86" y="190" width="28" height="18" rx="4" fill="#6a9479"/>
    </g>;
    case "football": return <g className="buddy-wear" clipPath={clip}>
      <path d="M52 168L74 148L150 214L128 236Z" fill="#d83a3a"/>
    </g>;
    case "knitting": return <g className="buddy-wear">
      <rect x="66" y="140" width="68" height="18" rx="9" fill="#b94c35"/>
      <path d="M78 141V157M92 141V157M106 141V157M120 141V157" stroke="#edce84" strokeWidth="3"/>
      <rect x="112" y="150" width="15" height="44" rx="6" fill="#b94c35"/>
      <path d="M112 166H127M112 180H127" stroke="#edce84" strokeWidth="3"/>
    </g>;
    case "pets": return <g className="buddy-wear">
      <path d="M64 146H136L100 184Z" fill="#235c50"/>
      <g fill="#fffefa"><circle cx="86" cy="154" r="2.5"/><circle cx="100" cy="162" r="2.5"/><circle cx="114" cy="154" r="2.5"/><circle cx="100" cy="174" r="2"/></g>
    </g>;
    case "reading": return <g className="buddy-wear">
      <path d="M56 170Q60 150 84 148L100 196L116 148Q140 150 144 170V206Q144 234 112 234H88Q56 234 56 206Z" fill="#c98a62" opacity=".9" clipPath={clip}/>
      <g fill="#edce84"><circle cx="100" cy="206" r="3"/><circle cx="100" cy="220" r="3"/></g>
    </g>;
    case "sea": return <g className="buddy-wear" clipPath={clip}>
      <path d="M50 176H150M50 194H150M50 212H150" stroke="#7fa5b8" strokeWidth="7"/>
    </g>;
    default: return null;
  }
}
