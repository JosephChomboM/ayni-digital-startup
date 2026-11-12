import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SessionCamera } from "./SessionCamera";

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
  expect(screen.getByText("Sonrisa en cuadro.")).toBeInTheDocument();
  expect(onCue).toHaveBeenCalledOnce();
  expect(onCue).toHaveBeenCalledWith("smile");
  unmount();
  expect(stop).toHaveBeenCalledOnce();
  expect(detector.close).toHaveBeenCalledOnce();
});
