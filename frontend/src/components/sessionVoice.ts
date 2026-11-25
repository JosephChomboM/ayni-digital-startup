import { synthesizeSpeech } from "../api/sessions";
import { speakLocally } from "./sessionSignals";

// Fragmentos breves para empezar a hablar pronto y limitar cada solicitud.
export function voiceChunks(text: string): string[] {
  const words = text.replace(/[*#`]/g, "").trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (const word of words) {
    if (word.length > 380) {
      for (let offset = 0; offset < word.length; offset += 380) chunks.push(word.slice(offset, offset + 380));
    } else if (chunks.length && chunks.at(-1)!.length + word.length < 380) {
      chunks[chunks.length - 1] += ` ${word}`;
    } else chunks.push(word);
  }
  return chunks;
}

export class SessionVoice {
  private controller?: AbortController;
  private audio?: HTMLAudioElement;
  private url?: string;
  private release?: () => void;
  private onSpeaking?: (value: boolean) => void;
  private synthesize: typeof synthesizeSpeech;
  private makeAudio: (url: string) => HTMLAudioElement;
  private fallback: typeof speakLocally;

  constructor(
    synthesize = synthesizeSpeech,
    makeAudio = (url: string) => new Audio(url),
    fallback = speakLocally,
  ) {
    this.synthesize = synthesize;
    this.makeAudio = makeAudio;
    this.fallback = fallback;
  }

  cancel() {
    this.controller?.abort();
    this.controller = undefined;
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio = undefined;
    }
    this.release?.();
    this.release = undefined;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = undefined;
    window.speechSynthesis?.cancel();
    this.onSpeaking?.(false);
    this.onSpeaking = undefined;
  }

  async speak(sessionId: string, text: string, onSpeaking: (value: boolean) => void, unavailable: (value: boolean) => void) {
    this.cancel();
    const chunks = voiceChunks(text);
    if (!chunks.length) return;
    const controller = new AbortController();
    this.controller = controller;
    this.onSpeaking = onSpeaking;
    onSpeaking(true);
    unavailable(false);
    let index = 0;
    try {
      for (; index < chunks.length; index++) {
        const blob = await this.synthesize(sessionId, chunks[index], AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
        if (controller.signal.aborted) return;
        this.url = URL.createObjectURL(blob);
        const audio = this.makeAudio(this.url);
        this.audio = audio;
        await new Promise<void>((resolve, reject) => {
          this.release = resolve;
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Audio no disponible"));
          void audio.play().catch(reject);
        });
        if (controller.signal.aborted) return;
        audio.onended = null;
        audio.onerror = null;
        URL.revokeObjectURL(this.url);
        this.url = undefined;
        this.audio = undefined;
        this.release = undefined;
      }
      onSpeaking(false);
    } catch {
      if (controller.signal.aborted) return;
      this.cancel();
      const available = this.fallback(chunks.slice(index).join(" "), onSpeaking);
      onSpeaking(available);
      unavailable(!available);
    }
  }
}
