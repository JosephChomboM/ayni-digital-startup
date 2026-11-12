import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { useSessionDictation } from "./useSessionDictation";

const getUserMedia = vi.fn();
const stopTrack = vi.fn();
class Recorder {
  static isTypeSupported() { return true; }
  state = "inactive";
  mimeType = "audio/webm";
  onstop: (() => void) | null = null;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["grabación de prueba"]) });
    this.onstop?.();
  }
}
class Audio {
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  decodeAudioData = vi.fn().mockResolvedValue({ duration: 1 });
  createMediaStreamSource() { return { connect: vi.fn() }; }
  createAnalyser() { return { fftSize: 128, getFloatTimeDomainData: (buffer: Float32Array) => buffer.fill(.01) }; }
}
class OfflineAudio {
  destination = {};
  createBufferSource() { return { connect: vi.fn(), start: vi.fn(), buffer: null }; }
  async startRendering() { return { getChannelData: () => new Float32Array(16000).fill(.1) }; }
}

beforeEach(() => {
  vi.useFakeTimers();
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("AudioContext", Audio);
  vi.stubGlobal("OfflineAudioContext", OfflineAudio);
  vi.spyOn(Blob.prototype, "arrayBuffer").mockResolvedValue(new ArrayBuffer(16));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("vuelve a escuchar sin pulsar reintentar cuando el audio no se entiende", async () => {
  const transcript = vi.fn();
  const cloud = vi.fn().mockRejectedValue(new ApiError("No te entendí bien", "audio_not_understood", 422));
  const { result } = renderHook(() => useSessionDictation(transcript, true, cloud));
  await act(async () => { await vi.advanceTimersByTimeAsync(750); });
  await act(async () => { result.current.finish(); });
  expect(result.current.error).toBe("");
  expect(result.current.notice).toContain("No te entendí bien");
  expect(transcript).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(750); });
  expect(getUserMedia).toHaveBeenCalledTimes(2);
});

it("usa el mismo audio para el dictado local si el servicio mejorado no responde", async () => {
  const cloud = vi.fn().mockRejectedValue(new ApiError("Servicio no disponible", "transcription_unavailable", 503));
  const transcript = vi.fn();
  class LocalWorker {
    onmessage?: (event: { data: { kind: string; text: string } }) => void;
    postMessage() { this.onmessage?.({ data: { kind: "result", text: "Paseamos por el parque" } }); }
    terminate() {}
  }
  vi.stubGlobal("Worker", LocalWorker);
  const { result } = renderHook(() => useSessionDictation(transcript, true, cloud));
  await act(async () => { await vi.advanceTimersByTimeAsync(750); });
  await act(async () => { result.current.finish(); });
  expect(result.current.error).toBe("");
  expect(result.current.notice).toBe("");
  expect(transcript).toHaveBeenCalledWith("Paseamos por el parque");
  await act(async () => { await vi.advanceTimersByTimeAsync(750); });
  expect(getUserMedia).toHaveBeenCalledTimes(2);
});

it("descarta una transcripción tardía cuando se cancela la escucha", async () => {
  let resolve!: (text: string) => void;
  const cloud = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
  const transcript = vi.fn();
  const { result } = renderHook(() => useSessionDictation(transcript, true, cloud));
  await act(async () => { await vi.advanceTimersByTimeAsync(750); });
  await act(async () => { result.current.finish(); });
  act(() => result.current.cancel());
  await act(async () => resolve("Un texto tardío"));
  expect(transcript).not.toHaveBeenCalled();
  expect(stopTrack).toHaveBeenCalled();
});
