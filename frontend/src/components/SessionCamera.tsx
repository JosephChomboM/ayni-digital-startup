import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { createFaceCueTracker } from "./sessionSignals";
import type { FaceCue, FaceObservation } from "./sessionSignals";

const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const wasmAssets = {
  simd: {
    wasmLoaderPath: new URL("../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js", import.meta.url).href,
    wasmBinaryPath: new URL("../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm", import.meta.url).href,
  },
  basic: {
    wasmLoaderPath: new URL("../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js", import.meta.url).href,
    wasmBinaryPath: new URL("../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm", import.meta.url).href,
  },
};
const statusText: Record<FaceObservation, string> = {
  absent: "Colócate frente a la cámara.",
  multiple: "Deja un solo rostro en cuadro para usar las señales.",
  present: "Rostro en cuadro.",
  smiling: "Sonrisa en cuadro.",
  brow: "Gesto de ceño en cuadro.",
};

interface SessionCameraProps {
  onCue: (cue: FaceCue) => void;
  canFollowExpression: () => boolean;
}

export function SessionCamera({ onCue, canFollowExpression }: SessionCameraProps) {
  const preview = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Preparando la cámara…");
  const handleCue = useEffectEvent(onCue);
  const turnAvailable = useEffectEvent(canFollowExpression);

  useEffect(() => {
    const video = preview.current;
    if (!video) return;

    let stopped = false;
    let stream: MediaStream | undefined;
    let detector: FaceLandmarker | undefined;
    let timer: number | undefined;
    let lastVideoTime = -1;
    const trackCue = createFaceCueTracker();

    function stop() {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => {
        track.removeEventListener("ended", cameraEnded);
        track.stop();
      });
      stream = undefined;
      detector?.close();
      detector = undefined;
      if (video) video.srcObject = null;
    }

    function cameraEnded() {
      stop();
      setStatus("La cámara se desconectó. Pueden seguir con los botones.");
    }

    function sample() {
      if (stopped || !video || !detector) return;
      try {
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const now = performance.now();
          const result = detector.detectForVideo(video, now);
          const scores = result.faceBlendshapes[0]?.categories ?? [];
          const score = (name: string) => scores.find((item) => item.categoryName === name)?.score ?? 0;
          let observation: FaceObservation = "absent";
          if (result.faceLandmarks.length > 1) observation = "multiple";
          else if (result.faceLandmarks.length === 1) {
            observation = "present";
            if (score("mouthSmileLeft") >= 0.65 && score("mouthSmileRight") >= 0.65) {
              observation = "smiling";
            } else if (score("browDownLeft") >= 0.75 && score("browDownRight") >= 0.75) {
              observation = "brow";
            }
          }
          setStatus(statusText[observation]);
          const cue = trackCue(observation, now, turnAvailable());
          if (cue) handleCue(cue);
        }
        if (!stopped) timer = window.setTimeout(sample, 150);
      } catch {
        stop();
        setStatus("El análisis de cámara se detuvo. Pueden seguir con los botones.");
      }
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("camera unavailable");
        }
        const vision = await import("@mediapipe/tasks-vision");
        if (stopped) return;
        const simd = await vision.FilesetResolver.isSimdSupported();
        if (stopped) return;
        const model = await vision.FaceLandmarker.createFromOptions(simd ? wasmAssets.simd : wasmAssets.basic, {
          baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
          runningMode: "VIDEO",
          numFaces: 2,
          outputFaceBlendshapes: true,
        });
        if (stopped) {
          model.close();
          return;
        }
        detector = model;
        const captured = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        });
        if (stopped || !video) {
          captured.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = captured;
        stream.getVideoTracks().forEach((track) => track.addEventListener("ended", cameraEnded, { once: true }));
        video.srcObject = stream;
        await video.play();
        if (!stopped) sample();
      } catch {
        if (stopped) return;
        stop();
        setStatus("No pudimos activar la cámara. Revisen el permiso o continúen con los botones.");
      }
    }

    function onVisibilityChange() {
      if (document.hidden && !stopped) {
        stop();
        setStatus("La cámara se apagó al salir de esta pestaña. Pueden volver a activarla.");
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    void start();
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, []);

  return <div className="space-y-2">
    <video ref={preview} muted playsInline aria-label="Vista de la cámara" className="aspect-[4/3] w-full max-w-56 rounded-lg bg-slate-100 object-cover [transform:scaleX(-1)]" />
    <p role="status" className="text-sm text-slate-600">{status}</p>
  </div>;
}
