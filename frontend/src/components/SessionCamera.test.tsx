import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SessionCamera } from "./SessionCamera";
import { FaceLandmarker } from "@mediapipe/tasks-vision";

const detector = vi.hoisted(() => ({
  detectForVideo: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { isSimdSupported: vi.fn().mockResolvedValue(true) },
  FaceLandmarker: { createFromOptions: vi.fn().mockResolvedValue(detector) },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  detector.close.mockClear();
});

it("opens the live preview before loading the model and keeps it open if the model fails", async () => {
  const stop = vi.fn();
  const track = Object.assign(new EventTarget(), { stop });
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal("navigator", Object.create(navigator, { mediaDevices: { value: { getUserMedia } } }));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  let failModel: (reason: Error) => void = () => {};
  const createModel = vi.mocked(FaceLandmarker.createFromOptions);
  createModel.mockImplementationOnce(() => new Promise((_resolve, reject) => { failModel = reject; }));

  const { unmount } = render(<SessionCamera onCue={vi.fn()} canFollowExpression={() => true} />);
  const video = screen.getByLabelText("Vista de la cámara") as HTMLVideoElement;
  await waitFor(() => expect(createModel).toHaveBeenCalled());
  expect(video.srcObject).toBe(stream);
  expect(screen.getByText(/Vista en vivo. Preparando/)).toBeInTheDocument();
  await act(async () => { failModel(new Error("Model unavailable")); });
  expect(screen.getByText(/El seguimiento no pudo iniciar/)).toBeInTheDocument();
  expect(video.srcObject).toBe(stream);
  expect(stop).not.toHaveBeenCalled();
  unmount();
  expect(stop).toHaveBeenCalledOnce();
});

it("uses video frames locally, reports a sustained smile and releases the camera on exit", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const stop = vi.fn();
  const track = Object.assign(new EventTarget(), { stop });
  const getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [track],
    getVideoTracks: () => [track],
  });
  vi.stubGlobal("navigator", Object.create(navigator, { mediaDevices: { value: { getUserMedia } } }));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(2);
  vi.spyOn(HTMLMediaElement.prototype, "currentTime", "get").mockImplementation(() => performance.now() / 1000);
  detector.detectForVideo.mockReturnValue({
    faceLandmarks: [[]],
    faceBlendshapes: [{ categories: [
      { categoryName: "mouthSmileLeft", score: 0.82 },
      { categoryName: "mouthSmileRight", score: 0.8 },
    ] }],
  });

  const onCue = vi.fn();
  const { unmount } = render(<SessionCamera onCue={onCue} canFollowExpression={() => true} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(1800); });
  expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
  expect(screen.getByText("Seguimiento activo.")).toBeInTheDocument();
  expect(onCue).toHaveBeenCalledOnce();
  expect(onCue).toHaveBeenCalledWith("smile");
  unmount();
  expect(stop).toHaveBeenCalledOnce();
  expect(detector.close).toHaveBeenCalledOnce();
});
