import { afterEach, expect, it, vi } from "vitest";
import { SessionVoice, voiceChunks } from "./sessionVoice";

afterEach(() => vi.unstubAllGlobals());

function setup(synthesize = vi.fn().mockResolvedValue(new Blob(["wav"], { type: "audio/wav" }))) {
  URL.createObjectURL = vi.fn(() => "blob:voz");
  URL.revokeObjectURL = vi.fn();
  const audio = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), removeAttribute: vi.fn(), onended: null as (() => void) | null, onerror: null as (() => void) | null };
  const fallback = vi.fn().mockReturnValue(true);
  const voice = new SessionVoice(synthesize, () => audio as unknown as HTMLAudioElement, fallback);
  return { voice, audio, fallback, synthesize };
}

it("fragmenta respuestas largas sin sobrepasar el límite del servidor", () => {
  const text = Array(120).fill("Recuerdos familiares").join(" ");
  const chunks = voiceChunks(text);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((chunk) => chunk.length <= 380)).toBe(true);
  expect(chunks.join(" ")).toBe(text);
});

it("reproduce carlfm y libera el audio al terminar", async () => {
  const { voice, audio, fallback } = setup();
  const speaking = vi.fn();
  const done = voice.speak("session", "Hola, soy Ayni", speaking, vi.fn());
  await vi.waitFor(() => expect(audio.play).toHaveBeenCalled());
  audio.onended?.();
  await done;
  expect(speaking).toHaveBeenLastCalledWith(false);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:voz");
  expect(fallback).not.toHaveBeenCalled();
});

it("no reproduce una respuesta que llegó después de silenciar", async () => {
  let resolve!: (blob: Blob) => void;
  const { voice, audio, synthesize } = setup(vi.fn(() => new Promise<Blob>((done) => { resolve = done; })));
  const done = voice.speak("session", "Hola", vi.fn(), vi.fn());
  voice.cancel();
  expect(synthesize.mock.calls[0][2].aborted).toBe(true);
  resolve(new Blob(["wav"]));
  await done;
  expect(audio.play).not.toHaveBeenCalled();
});

it("usa la voz disponible del navegador si Piper no responde", async () => {
  const { voice, fallback } = setup(vi.fn().mockRejectedValue(new Error("503")));
  await voice.speak("session", "Seguimos conversando", vi.fn(), vi.fn());
  expect(fallback).toHaveBeenCalledWith("Seguimos conversando", expect.any(Function));
});

it("detiene y libera el audio al pausar o salir", async () => {
  const { voice, audio } = setup();
  const done = voice.speak("session", "Hola", vi.fn(), vi.fn());
  await vi.waitFor(() => expect(audio.play).toHaveBeenCalled());
  voice.cancel();
  await done;
  expect(audio.pause).toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:voz");
});
