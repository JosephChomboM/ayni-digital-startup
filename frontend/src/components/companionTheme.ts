/**
 * Ambienta la sala y viste a Ayni según los gustos registrados en el perfil.
 * Se decide en el navegador con palabras clave: no se envían gustos a la IA.
 */
export type ThemeId = "music" | "garden" | "cooking" | "football" | "knitting" | "reading" | "pets" | "sea";

export interface CompanionTheme {
  /** Ropa de Ayni: la del primer gusto reconocido. */
  outfit: ThemeId | null;
  /** Objetos de la sala: hasta dos gustos distintos. */
  decor: ThemeId[];
  /** Frase accesible que explica el look, por ejemplo «Ayni lleva gorro de cocinero». */
  description: string;
}

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

const descriptions: Record<ThemeId, string> = {
  music: "Ayni lleva sombrero y corbatín, y hay una guitarra en la sala",
  garden: "Ayni lleva sombrero de paja con una flor, y hay macetas en la sala",
  cooking: "Ayni lleva gorro y mandil de cocina, y hay ollas en la repisa",
  football: "Ayni lleva la franja roja, y hay una pelota en la sala",
  knitting: "Ayni lleva bufanda tejida y boina, y hay una canasta de lana",
  reading: "Ayni lleva lentes de lectura, y hay un librero en la sala",
  pets: "Ayni lleva pañoleta, y un perrito la acompaña en la sala",
  sea: "Ayni lleva sombrero de pescador, y hay un cuadro del mar",
};

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Elige el look en el orden en que la familia escribió los gustos; los recuerdos son respaldo. */
export function themeFor(interests: string[], memoryTexts: string[] = []): CompanionTheme {
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
  const outfit = found[0] ?? null;
  return { outfit, decor: found.slice(0, 2), description: outfit ? descriptions[outfit] : "" };
}
