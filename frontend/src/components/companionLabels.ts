/** Textos accesibles del acompañante: describen lo que hace Ayni, no lo que siente la persona. */
export type CompanionState = "idle" | "listening" | "thinking" | "speaking" | "paused";

export const companionLabels: Record<CompanionState, string> = {
  idle: "Ayni está contigo", listening: "Ayni está escuchando", thinking: "Ayni está preparando su respuesta",
  speaking: "Ayni está hablando", paused: "Ayni está en pausa",
};
