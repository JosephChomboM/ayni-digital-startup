import type { LookSpec } from "../api/sessions";

/**
 * Look de respaldo cuando la IA no está disponible: palabras clave de los gustos del
 * perfil (y, si no hay, de los recuerdos) llevan a un diseño fijo. Se decide en el navegador.
 */
export type ThemeId = "music" | "garden" | "cooking" | "football" | "knitting" | "reading" | "pets" | "sea";

const keywords: [ThemeId, RegExp][] = [
  ["music", /\b(?:music\w*|cant\w*|bolero\w*|criollo|criolla|vals\w*|marinera|huayno\w*|salsa|cumbia|guitarr\w*|piano|radio|bail\w*|tango|orquesta|chabuca)\b/],
  ["garden", /\b(?:jardin\w*|planta\w*|flor\w*|huert\w*|rosa\w*|sembr\w*|orquidea\w*|campo)\b/],
  ["cooking", /\b(?:cocin\w*|receta\w*|olla\w*|reposter\w*|pastel\w*|torta\w*|comida\w*|guis\w*|hornear|ceviche|postre\w*)\b/],
  ["football", /\b(?:futbol\w*|deport\w*|alianza|universitario|cristal|voley\w*|seleccion|pelota|partido\w*|gol\w*)\b/],
  ["knitting", /\b(?:tej\w*|costur\w*|cos(?:er|ia)|bordad\w*|bordar|crochet|palitos|lana)\b/],
  ["reading", /\b(?:le(?:er|ia|ctura)|libro\w*|poes\w*|poema\w*|novela\w*|periodico\w*|revista\w*|crucigrama\w*|escrib\w*)\b/],
  ["pets", /\b(?:perr\w*|gat\w*|mascota\w*|animal\w*|pajar\w*|loro\w*|canario\w*)\b/],
  ["sea", /\b(?:playa\w*|mar|pesca\w*|pescar|viaj\w*|barco\w*|malecon\w*|chorrillos|ancon)\b/],
];

type Look = Omit<LookSpec, "decor"> & { decor: LookSpec["decor"] };
const looks: Record<ThemeId, Look> = {
  music: { hat: "fedora", body: "bowtie", glasses: false, hat_color: "#3d4a46", outfit_color: "#b94c35", accent_color: "#b94c35", wall: ["#f6ece0", "#f1e2d2"], decor: [{ icon: "guitar", place: "floor" }, { icon: "music", place: "wall" }], description: "Ayni se puso sombrero y corbatín, y trajo su guitarra" },
  garden: { hat: "straw", body: "apron", glasses: false, hat_color: "#edce84", outfit_color: "#7fa58d", accent_color: "#f2a097", wall: ["#eef3e4", "#e5eed9"], decor: [{ icon: "flower-2", place: "floor" }, { icon: "sprout", place: "wall" }], description: "Ayni lleva sombrero de paja con una flor y mandil de jardín" },
  cooking: { hat: "chef", body: "apron", glasses: false, hat_color: "#fffefa", outfit_color: "#fffefa", accent_color: "#b94c35", wall: ["#f8efe2", "#f8efe2"], decor: [{ icon: "cooking-pot", place: "wall" }, { icon: "soup", place: "floor" }], description: "Ayni lleva gorro y mandil de cocina" },
  football: { hat: "cap", body: "sash", glasses: false, hat_color: "#d83a3a", outfit_color: "#d83a3a", accent_color: "#fffefa", wall: ["#f7efe6", "#f3e6dc"], decor: [{ icon: "volleyball", place: "floor" }, { icon: "trophy", place: "wall" }], description: "Ayni lleva gorra y la franja roja" },
  knitting: { hat: "beret", body: "scarf", glasses: false, hat_color: "#b94c35", outfit_color: "#b94c35", accent_color: "#edce84", wall: ["#f7ece4", "#f2e2d8"], decor: [{ icon: "scissors", place: "wall" }, { icon: "shirt", place: "floor" }], description: "Ayni lleva bufanda tejida y boina" },
  reading: { hat: "none", body: "cardigan", glasses: true, hat_color: "#c98a62", outfit_color: "#c98a62", accent_color: "#edce84", wall: ["#f4eee0", "#ece3cf"], decor: [{ icon: "library", place: "floor" }, { icon: "book-open", place: "wall" }], description: "Ayni lleva lentes de lectura y chompa" },
  pets: { hat: "none", body: "bandana", glasses: false, hat_color: "#235c50", outfit_color: "#235c50", accent_color: "#fffefa", wall: ["#f5f0e2", "#efe7d2"], decor: [{ icon: "dog", place: "floor" }, { icon: "paw-print", place: "wall" }], description: "Ayni lleva pañoleta y un perrito la acompaña" },
  sea: { hat: "bucket", body: "stripes", glasses: false, hat_color: "#7fa5b8", outfit_color: "#7fa5b8", accent_color: "#fffefa", wall: ["#eaf2f2", "#e0ecee"], decor: [{ icon: "sailboat", place: "wall" }, { icon: "shell", place: "floor" }], description: "Ayni lleva sombrero de pescador y hay un cuadro del mar" },
};

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Elige el look en el orden en que la familia escribió los gustos; los recuerdos son respaldo. */
export function lookFor(interests: string[], memoryTexts: string[] = []): LookSpec | null {
  const found: ThemeId[] = [];
  for (const source of [interests, memoryTexts]) {
    for (const text of source) {
      const value = normalize(text);
      // Dentro de un mismo gusto manda la palabra que aparece primero («cocina criolla» es cocina).
      const hits = keywords.flatMap(([theme, pattern]) => {
        const at = value.search(pattern);
        return at < 0 ? [] : [{ theme, at }];
      }).sort((a, b) => a.at - b.at);
      for (const { theme } of hits) if (!found.includes(theme)) found.push(theme);
    }
    if (found.length) break;
  }
  if (!found.length) return null;
  const main = looks[found[0]];
  const second = found[1] ? looks[found[1]].decor[0] : undefined;
  return { ...main, wall: [...main.wall] as [string, string], decor: second ? [main.decor[0], second] : main.decor };
}
