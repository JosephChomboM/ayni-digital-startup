import type { ConversationTopic } from "../api/conversation";

export type SessionActivity = "anecdote" | "photo" | "song";
export type SpokenChoice = ConversationTopic | SessionActivity | "pause" | "end" | "next";

export function requestsVisualContext(text: string): boolean {
  const phrase = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/\b(?:no|sin)\s+(?:mires|mirar|analices|analizar|describas|describir)\b/.test(phrase)) return false;
  return /\b(?:mira|mire|miren|observa|fijate|veamos)\s+(?:(?:en|la|el|esta|este|esa|ese|mi|mis|tu)\s+)*(?:aca|aqui|esto|eso|imagen|foto|fotografia|camara|objeto|lo que)\b/.test(phrase) ||
    /\b(?:te muestro|te estoy mostrando|que ves|que es lo que ves)\b/.test(phrase) ||
    /\b(?:describe|describeme|analiza|puedes ver|alcanzas a ver)\s+(?:(?:en|la|el|esta|este|esa|ese|mi|mis|tu)\s+)*(?:esto|eso|imagen|foto|fotografia|camara|objeto|lo que)\b/.test(phrase) ||
    /\b(?:que (?:hay|aparece|se ve)|de que color es)\b[^.?!]*\b(?:en|de)\s+(?:esta|esa|la)\s+(?:imagen|foto|fotografia|captura)\b/.test(phrase);
}

export function visualSource(text: string): "camera" | "memory" | "auto" {
  const phrase = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/\b(?:camara|webcam|en vivo|te muestro|te estoy mostrando|mira aca|mira aqui)\b/.test(phrase)) return "camera";
  if (/\b(?:foto|fotografia|recuerdo|album|imagen guardada)\b/.test(phrase)) return "memory";
  return "auto";
}

export function interpretReply(transcript: string): SpokenChoice {
  const reply = transcript.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
    .replace(/^ayni[ ,]+/, "");
  if (/^(?:terminar|paremos|hasta aqui)[.! ]*$/.test(reply) ||
      /^(?:quiero terminar|no quiero seguir|dejemoslo aqui)\b/.test(reply)) return "end";
  if (/^(?:pausa|pausar|descansar)[.! ]*$/.test(reply) ||
      /^(?:quiero descansar|necesito (?:una pausa|descansar)|hagamos una pausa|estoy cansad[oa])\b/.test(reply)) return "pause";
  if (/^(?:cambiar de (?:recuerdo|actividad)|otra actividad)[.! ]*$/.test(reply) ||
      /^(?:quiero cambiar de (?:recuerdo|actividad)|pasemos a otra actividad)\b/.test(reply)) return "next";
  if (/^(?:quiero escuchar (?:la cancion|musica)|escuchemos la cancion|pasemos a la cancion)\b/.test(reply)) return "song";
  if (/^(?:quiero ver (?:la foto|una foto)|miremos (?:la foto|una foto))\b/.test(reply)) return "photo";
  if (/^(?:quiero (?:escuchar|leer) la anecdota|volvamos a la anecdota)\b/.test(reply)) return "anecdote";
  if (/\b(?:no (?:me acuerdo|recuerdo|se)|me cuesta recordar)\b/.test(reply)) return "ease";
  if (/\b(?:lugar|parque|playa|casa|calle|barrio|ciudad)\b/.test(reply)) return "place";
  if (/\b(?:actividad|bail\w*|cant\w*|cocin\w*|jug\w*|camin\w*|hicimos)\b/.test(reply)) return "activity";
  return "detail";
}

export type FaceObservation = "absent" | "multiple" | "present" | "smiling" | "brow";
export type FaceCue = "smile" | "brow" | "away" | "hand";

/** Gesto visible de la cara. Describe la expresión, no lo que la persona siente. */
export type Expression = "smile" | "surprise" | "brow" | "sad" | "calm";

export function readExpression(score: (name: string) => number): Expression {
  const both = (name: string) => (score(name + "Left") + score(name + "Right")) / 2;
  if (both("mouthSmile") >= 0.45) return "smile";
  if (score("jawOpen") >= 0.35 && score("browInnerUp") >= 0.35) return "surprise";
  if (both("browDown") >= 0.5) return "brow";
  if (both("mouthFrown") >= 0.25 || (score("browInnerUp") >= 0.45 && both("mouthSmile") < 0.1)) return "sad";
  return "calm";
}


export function createFaceCueTracker() {
  let previous: FaceObservation | undefined;
  let since = 0;
  let faceSeen = false;
  let emitted = false;
  let lastSample = -Infinity;

  return (observation: FaceObservation, now: number, canFollowExpression = true): FaceCue | undefined => {
    // A suspended tab or a stalled camera does not count as continuous evidence.
    if (observation !== previous || now - lastSample > 700) {
      previous = observation;
      since = now;
      emitted = false;
    }
    lastSample = now;
    if (observation === "multiple") faceSeen = false;
    if (observation !== "absent" && observation !== "multiple") faceSeen = true;
    if (!faceSeen || emitted) return;
    if (observation === "smiling" && now - since >= 1600 && canFollowExpression) {
      emitted = true;
      return "smile";
    }
    if (observation === "brow" && now - since >= 2400 && canFollowExpression) {
      emitted = true;
      return "brow";
    }
    if (observation === "absent" && now - since >= 7000) {
      emitted = true;
      faceSeen = false;
      return "away";
    }
  };
}

const LATIN_AMERICAN_REGIONS = new Set([
  "419", "AR", "BO", "BZ", "CL", "CO", "CR", "CU", "DO", "EC", "GT", "HN", "MX",
  "NI", "PA", "PE", "PR", "PY", "SV", "UY", "VE",
]);

export function latinAmericanVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.flatMap((voice) => {
    const region = /^es(?:-[a-z]{4})?-([a-z]{2}|419)(?:-|$)/i.exec(voice.lang)?.[1].toUpperCase();
    if (!voice.localService || !region || !LATIN_AMERICAN_REGIONS.has(region)) return [];

    const identity = `${voice.name} ${voice.voiceURI ?? ""}`;
    const quality = /natural|neural|premium|enhanced|mejorada|alta calidad/i.test(identity) ? 100 : 0;
    const standardVoice = /^paulina\b/i.test(voice.name) ? 12 : 0;
    const noveltyVoice = /espeak|compact|robot|^(?:eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i.test(voice.name);
    const score = (region === "PE" ? 200 : 0) + quality + standardVoice - (noveltyVoice ? 1000 : 0);
    return [{ voice, score }];
  }).sort((a, b) => b.score - a.score || a.voice.name.localeCompare(b.voice.name))
    .map(({ voice }) => voice);
}

export function speakLocally(text: string, onSpeaking?: (speaking: boolean) => void): boolean {
  const speech = window.speechSynthesis;
  const [voice] = latinAmericanVoices(speech?.getVoices() ?? []);
  if (!voice) return false;
  speech.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.97;
  utterance.pitch = 1;
  if (onSpeaking) {
    utterance.onstart = () => onSpeaking(true);
    utterance.onend = () => onSpeaking(false);
    utterance.onerror = () => onSpeaking(false);
  }
  speech.speak(utterance);
  return true;
}
