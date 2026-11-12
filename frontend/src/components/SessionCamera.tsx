import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { createFaceCueTracker } from "./sessionSignals";
import type { FaceCue, FaceObservation } from "./sessionSignals";
import { imageForConversation } from "../api/sessions";

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
  present: "Seguimiento activo.",
  smiling: "Seguimiento activo.",
  brow: "Seguimiento activo.",
};

interface SessionCameraProps {
  onCue: (cue: FaceCue) => void;
  canFollowExpression: () => boolean;
  onAnalyzeFrame?: (image: string) => void;
  analyzing?: boolean;
}

export function SessionCamera({ onCue, canFollowExpression, onAnalyzeFrame, analyzing }: SessionCameraProps) {
  const preview = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Esperando permiso de cámara…");
  const [ratio, setRatio] = useState("4 / 3");
  const [face, setFace] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
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
      setFace(null);
      setStatus("La cámara se desconectó. Puedes seguir conversando sin video.");
    }

    function stopAnalysis() {
      window.clearTimeout(timer);
      detector?.close();
      detector = undefined;
      setFace(null);
      setStatus("Vista en vivo. El seguimiento no pudo iniciar.");
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
          const points = result.faceLandmarks.length === 1 ? result.faceLandmarks[0] : [];
          if (points.length) {
            const left = Math.max(0, Math.min(...points.map((point) => point.x)) - 0.025);
            const right = Math.min(1, Math.max(...points.map((point) => point.x)) + 0.025);
            const top = Math.max(0, Math.min(...points.map((point) => point.y)) - 0.025);
            const bottom = Math.min(1, Math.max(...points.map((point) => point.y)) + 0.025);
            setFace({ x: (1 - right) * 100, y: top * 100, width: (right - left) * 100, height: (bottom - top) * 100 });
          } else setFace(null);
          setStatus(statusText[observation]);
          const cue = trackCue(observation, now, turnAvailable());
          if (cue) handleCue(cue);
        }
        if (!stopped) timer = window.setTimeout(sample, 150);
      } catch {
        stopAnalysis();
      }
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("camera unavailable");
        }
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
      } catch (error) {
        if (stopped) return;
        stop();
        setStatus(error instanceof DOMException && error.name === "NotAllowedError"
          ? "La cámara está bloqueada. Permite el acceso desde el icono del navegador y vuelve a activarla."
          : "No pudimos abrir la cámara. Comprueba que esté conectada y libre.");
        return;
      }
      if (stopped || !video) return;
      if (video.videoWidth && video.videoHeight) setRatio(`${video.videoWidth} / ${video.videoHeight}`);
      setStatus("Vista en vivo. Preparando el seguimiento…");
      try {
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
        sample();
      } catch {
        if (!stopped) stopAnalysis();
      }
    }

    function onVisibilityChange() {
      if (document.hidden && !stopped) {
        stop();
        setFace(null);
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
    <div className="relative overflow-hidden rounded-xl bg-[#17232d]" style={{ aspectRatio: ratio }}>
      <video ref={preview} muted playsInline aria-label="Vista de la cámara" className="absolute inset-0 size-full object-contain [transform:scaleX(-1)]" />
      {face && <div aria-hidden="true" className="pointer-events-none absolute rounded-lg border-2 border-[#d1edaa] motion-safe:transition-[left,top,width,height] motion-safe:duration-150"
        style={{ left: `${face.x}%`, top: `${face.y}%`, width: `${face.width}%`, height: `${face.height}%` }} />}
    </div>
    <p role="status" className="text-sm text-slate-600">{status}</p>
    {onAnalyzeFrame && <div className="space-y-2">
      <button type="button" disabled={analyzing} className="min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50" onClick={async () => {
        if (!preview.current) return;
        try { onAnalyzeFrame(await imageForConversation(preview.current)); }
        catch { setStatus("Espera a que la cámara muestre la imagen e inténtalo otra vez."); }
      }}>Conversar sobre esta imagen</button>
      <p className="text-xs">Al pulsar, compartes una captura con Groq. El video continuo permanece en tu dispositivo.</p>
    </div>}
  </div>;
}
