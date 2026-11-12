import type { ConversationTopic } from "../api/conversation";

export type SessionActivity = "anecdote" | "photo" | "song";
export type SpokenChoice = ConversationTopic | SessionActivity | "pause" | "end" | "next";

export function requestsVisualContext(text: string): boolean {
  const phrase = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/\b(?:no|sin)\s+(?:mires|mirar|analices|analizar|describas|describir)\b/.test(phrase)) return false;
  return /\b(?:mira|mire|miren|observa|fijate|veamos)\s+(?:(?:en|la|el|esta|este|esa|ese)\s+)*(?:aca|aqui|esto|eso|imagen|foto|fotografia|camara|objeto|lo que)\b/.test(phrase) ||
    /\b(?:te muestro|te estoy mostrando|que ves|que es lo que ves)\b/.test(phrase) ||
    /\b(?:describe|describeme|analiza|puedes ver|alcanzas a ver)\s+(?:(?:en|la|el|esta|este|esa|ese)\s+)*(?:esto|eso|imagen|foto|fotografia|camara|objeto|lo que)\b/.test(phrase) ||
    /\b(?:que (?:hay|aparece|se ve)|de que color es)\b[^.?!]*\b(?:en|de)\s+(?:esta|esa|la)\s+(?:imagen|foto|fotografia|captura)\b/.test(phrase);
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
export type FaceCue = "smile" | "brow" | "away";

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

const VOICE_PREFERENCE_KEY = "ayni_voice_uri";

export function preferredVoiceURI(): string {
  try { return localStorage.getItem(VOICE_PREFERENCE_KEY) ?? ""; }
  catch { return ""; }
}

export function saveVoicePreference(voiceURI: string): void {
  try {
    if (voiceURI) localStorage.setItem(VOICE_PREFERENCE_KEY, voiceURI);
    else localStorage.removeItem(VOICE_PREFERENCE_KEY);
  } catch {
    // The selected voice still works for this session if storage is blocked.
  }
}

const spanishRegions = new Intl.DisplayNames("es", { type: "region" });

export function spanishVoiceLabel(voice: SpeechSynthesisVoice): string {
  const region = new Intl.Locale(voice.lang).region;
  return `${voice.name} · ${region ? spanishRegions.of(region) : "Español"}`;
}

export function spanishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const score = (voice: SpeechSynthesisVoice) => {
    const region = new Intl.Locale(voice.lang).region;
    const accent = region === "PE" ? 600
      : region && ["419", "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "GT", "HN", "MX", "NI", "PA", "PR", "PY", "SV", "UY", "VE"].includes(region) ? 400
      : region === "ES" ? 200 : 0;
    const identity = `${voice.name} ${voice.voiceURI ?? ""}`;
    const quality = /natural|neural|premium|enhanced|mejorada|alta calidad/i.test(identity) ? 100 : 0;
    const standardVoice = /^(?:paulina|m[oó]nica)\b/i.test(voice.name) ? 12 : 0;
    const noveltyVoice = /espeak|compact|robot|^(?:eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i.test(voice.name);
    return accent + quality + standardVoice - (noveltyVoice ? 1000 : 0);
  };
  return voices.filter((voice) => voice.localService && /^es(?:-[a-z\d]{2,8})*$/i.test(voice.lang))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

export function speakLocally(text: string, onSpeaking?: (speaking: boolean) => void, voiceURI = preferredVoiceURI()): boolean {
  const speech = window.speechSynthesis;
  const voices = spanishVoices(speech?.getVoices() ?? []);
  const voice = voices.find((item) => item.voiceURI === voiceURI) ?? voices[0];
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
