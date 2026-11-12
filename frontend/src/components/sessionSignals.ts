import type { ConversationTopic } from "../api/conversation";

export type SessionActivity = "anecdote" | "photo" | "song";
export type SpokenChoice = ConversationTopic | SessionActivity | "pause" | "end" | "next";

export function requestsVisualContext(text: string): boolean {
  const phrase = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/\b(?:no|sin)\s+(?:mires|mirar|analices|analizar|describas|describir)\b/.test(phrase)) return false;
  return /\b(?:mira|mire|miren|observa|fijate|veamos)\s+(?:(?:en|la|el|esta|este|esa|ese)\s+)*(?:aca|aqui|esto|eso|imagen|foto|fotografia|camara|objeto|lo que)\b/.test(phrase) ||
    /\b(?:te muestro|te estoy mostrando|que ves|que es lo que ves)\b/.test(phrase) ||
    /\b(?:describe|describeme|analiza|puedes ver|alcanzas a ver)\s+(?:(?:en|la|el|esta|este|esa|ese)\s+)*(?:esto|eso|imagen|foto|fotografia|camara|objeto|lo que)\b/.test(phrase) ||
    /\b(?:en|de)\s+(?:esta|esa|la)\s+(?:imagen|foto|fotografia|captura)\b/.test(phrase);
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

export function spanishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const score = (voice: SpeechSynthesisVoice) =>
    (/natural|neural|premium|enhanced|mejorada/i.test(voice.name) ? 100 : 0) +
    (/^es-PE$/i.test(voice.lang) ? 40 : /^es-(MX|US|CO|CL|AR)/i.test(voice.lang) ? 30 : 0);
  return voices.filter((voice) => voice.localService && /^es(?:-|$)/i.test(voice.lang))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

export function speakLocally(text: string, onSpeaking?: (speaking: boolean) => void, voiceURI?: string): boolean {
  const speech = window.speechSynthesis;
  const voices = spanishVoices(speech?.getVoices() ?? []);
  const voice = voices.find((item) => item.voiceURI === voiceURI) ?? voices[0];
  if (!voice) return false;
  speech.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.95;
  if (onSpeaking) {
    utterance.onstart = () => onSpeaking(true);
    utterance.onend = () => onSpeaking(false);
    utterance.onerror = () => onSpeaking(false);
  }
  speech.speak(utterance);
  return true;
}
