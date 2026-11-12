import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { FaceLandmarker, HandLandmarker, NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import { Annoyed, Frown, Meh, Smile, Sparkles } from "lucide-react";
import type { RefObject } from "react";
import { createFaceCueTracker, readExpression } from "./sessionSignals";
import type { Expression } from "./sessionSignals";
import type { FaceCue, FaceObservation } from "./sessionSignals";
import { imageForConversation } from "../api/sessions";

const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const HAND_LINKS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
// Pocos puntos de la cara: contorno, cejas, ojos, nariz y boca, para no taparla.
const FACE_POINTS = [10, 297, 284, 389, 454, 361, 397, 378, 152, 149, 172, 132, 234, 162, 54, 67,
  70, 105, 107, 336, 334, 300, 33, 159, 133, 145, 362, 386, 263, 374, 1, 61, 0, 291, 17];
// Solo la parte superior del cuerpo: en casa la persona suele estar sentada.
const BODY_LINKS: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];

const expressions: Record<Expression, { label: string; Icon: typeof Smile }> = {
  smile: { label: "Sonriendo", Icon: Smile },
  surprise: { label: "Sorprendido", Icon: Sparkles },
  brow: { label: "Ceño fruncido", Icon: Annoyed },
  sad: { label: "Gesto triste", Icon: Frown },
  calm: { label: "Tranquilo", Icon: Meh },
};

function drawTracking(canvas: HTMLCanvasElement | null, video: HTMLVideoElement | null, face: NormalizedLandmark[], hands: NormalizedLandmark[][], body: NormalizedLandmark[]) {
  const context = canvas?.getContext?.("2d");
  if (!canvas || !context) return;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  context.clearRect(0, 0, width, height);
  // Los puntos vienen normalizados al cuadro del video; se proyectan sobre la zona donde
  // el video se ve realmente (object-fit: contain), aunque el marco tenga otra proporción.
  const sourceWidth = video?.videoWidth || width;
  const sourceHeight = video?.videoHeight || height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const offsetX = (width - sourceWidth * scale) / 2;
  const offsetY = (height - sourceHeight * scale) / 2;
  const at = (point: NormalizedLandmark) => [offsetX + point.x * sourceWidth * scale, offsetY + point.y * sourceHeight * scale] as const;
  // Solo el cuerpo trae una visibilidad útil; en cara y manos MediaPipe la deja en 0.
  const seen = (point: NormalizedLandmark, checked: boolean) => !checked || (point.visibility ?? 1) >= 0.5;
  const lines = (points: NormalizedLandmark[], links: [number, number][], color: string, checked = false) => {
    context.strokeStyle = color;
    context.lineWidth = 2.5 * ratio;
    context.lineCap = "round";
    for (const [from, to] of links) {
      const a = points[from];
      const b = points[to];
      if (!a || !b || !seen(a, checked) || !seen(b, checked)) continue;
      context.beginPath();
      context.moveTo(...at(a));
      context.lineTo(...at(b));
      context.stroke();
    }
  };
  const dots = (points: NormalizedLandmark[], color: string, radius: number, checked = false) => {
    context.fillStyle = color;
    for (const point of points) {
      if (!seen(point, checked)) continue;
      context.beginPath();
      context.arc(...at(point), radius * ratio, 0, Math.PI * 2);
      context.fill();
    }
  };
  if (body.length) {
    lines(body, BODY_LINKS, "#e7a07ccc", true);
    dots([11, 12, 13, 14, 15, 16, 23, 24].map((index) => body[index]).filter(Boolean), "#f3c09b", 3.5, true);
  }
  for (const hand of hands) {
    lines(hand, HAND_LINKS, "#edce84dd");
    dots(hand, "#fff3c4", 2.6);
  }
  if (face.length) dots(FACE_POINTS.map((index) => face[index]).filter(Boolean), "#d6efbbe6", 1.9);
}
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
  captureRef?: RefObject<(() => Promise<string>) | null>;
  onCue: (cue: FaceCue) => void;
  canFollowExpression: () => boolean;
  onAnalyzeFrame?: (image: string) => void;
  analyzing?: boolean;
  live?: boolean;
  canObserve?: () => boolean;
  onObserveFrame?: (image: string) => Promise<void>;
  /** Dibuja y sigue también manos y cuerpo (más trabajo para el celular). */
  bodyTracking?: boolean;
}

export function SessionCamera({ captureRef, onCue, canFollowExpression, onAnalyzeFrame, analyzing, live, canObserve, onObserveFrame, bodyTracking = false }: SessionCameraProps) {
  const preview = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const trackBody = useRef(bodyTracking);
  useEffect(() => { trackBody.current = bodyTracking; }, [bodyTracking]);
  const [expression, setExpression] = useState<Expression | null>(null);
  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = async () => {
      if (document.hidden || !preview.current || preview.current.readyState < 2 || !preview.current.srcObject) {
        throw new Error("La cámara todavía no está lista. Espera a ver la imagen e inténtalo otra vez.");
      }
      return imageForConversation(preview.current);
    };
    return () => { captureRef.current = null; };
  }, [captureRef]);
  const [status, setStatus] = useState("Esperando permiso de cámara…");
  const [ratio, setRatio] = useState("4 / 3");
  const handleCue = useEffectEvent(onCue);
  const turnAvailable = useEffectEvent(canFollowExpression);
  const observe = useEffectEvent(async () => {
    if (!document.hidden && preview.current && preview.current.readyState >= 2 && canObserve?.()) {
      await onObserveFrame?.(await imageForConversation(preview.current));
    }
  });
  useEffect(() => {
    if (!live) return;
    let stopped = false;
    let timer: number;
    const tick = async () => {
      try { await observe(); } catch { /* La conversación sigue aunque una captura falle. */ }
      if (!stopped) timer = window.setTimeout(tick, 15_000);
    };
    timer = window.setTimeout(tick, 1500);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [live]);

  useEffect(() => {
    const video = preview.current;
    if (!video) return;

    let stopped = false;
    let stream: MediaStream | undefined;
    let detector: FaceLandmarker | undefined;
    let handDetector: HandLandmarker | undefined;
    let poseDetector: PoseLandmarker | undefined;
    let loadingBody = false;
    let raisedSince = 0;
    let raisedSent = false;
    const smooth = new Map<string, number>();
    let vision: typeof import("@mediapipe/tasks-vision") | undefined;
    let assets: { wasmLoaderPath: string; wasmBinaryPath: string } | undefined;
    let timer: number | undefined;
    let lastVideoTime = -1;
    const trackCue = createFaceCueTracker();
    const square = document.createElement("canvas");
    const fit = () => { if (video.videoWidth && video.videoHeight) setRatio(`${video.videoWidth} / ${video.videoHeight}`); };

    function stop() {
      stopped = true;
      video?.removeEventListener("resize", fit);
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => {
        track.removeEventListener("ended", cameraEnded);
        track.stop();
      });
      stream = undefined;
      detector?.close();
      detector = undefined;
      handDetector?.close();
      handDetector = undefined;
      poseDetector?.close();
      poseDetector = undefined;
      drawTracking(overlay.current, null, [], [], []);
      if (video) video.srcObject = null;
    }

    async function loadBody() {
      if (loadingBody || !vision || !assets || handDetector || poseDetector) return;
      loadingBody = true;
      // Manos y cuerpo son opcionales: si un modelo falla, la cara sigue funcionando.
      const [hands, pose] = await Promise.allSettled([
        vision.HandLandmarker?.createFromOptions(assets, { baseOptions: { modelAssetPath: HAND_MODEL, delegate: "CPU" }, runningMode: "VIDEO", numHands: 2 }),
        vision.PoseLandmarker?.createFromOptions(assets, { baseOptions: { modelAssetPath: POSE_MODEL, delegate: "CPU" }, runningMode: "VIDEO", numPoses: 1 }),
      ]);
      if (stopped) {
        if (hands.status === "fulfilled") hands.value?.close();
        if (pose.status === "fulfilled") pose.value?.close();
        return;
      }
      if (hands.status === "fulfilled") handDetector = hands.value;
      if (pose.status === "fulfilled") poseDetector = pose.value;
    }

    function cameraEnded() {
      stop();
      setExpression(null);
      setStatus("La cámara se desconectó. Puedes seguir conversando sin video.");
    }

    function stopAnalysis() {
      window.clearTimeout(timer);
      detector?.close();
      detector = undefined;
      setExpression(null);
      setStatus("Vista en vivo. El seguimiento no pudo iniciar.");
    }

    function sample() {
      if (stopped || !video || !detector) return;
      try {
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const now = performance.now();
          // MediaPipe ubica mal los puntos en video no cuadrado: se analiza un cuadro
          // cuadrado con bordes de relleno y luego se devuelven al cuadro del video.
          const side = Math.max(video.videoWidth, video.videoHeight);
          const padX = (side - video.videoWidth) / 2;
          const padY = (side - video.videoHeight) / 2;
          const squareContext = side ? square.getContext("2d") : null;
          let input: HTMLVideoElement | HTMLCanvasElement = video;
          let back = (point: NormalizedLandmark) => point;
          if (squareContext && video.videoWidth && video.videoHeight) {
            if (square.width !== side) { square.width = side; square.height = side; }
            squareContext.fillStyle = "#000";
            squareContext.fillRect(0, 0, side, side);
            squareContext.drawImage(video, padX, padY, video.videoWidth, video.videoHeight);
            input = square;
            back = (point) => ({ ...point, x: (point.x * side - padX) / video.videoWidth, y: (point.y * side - padY) / video.videoHeight });
          }
          const result = detector.detectForVideo(input, now);
          const scores = result.faceBlendshapes[0]?.categories ?? [];
          const score = (name: string) => scores.find((item) => item.categoryName === name)?.score ?? 0;
          // Suaviza los valores para que la etiqueta no parpadee entre cuadros.
          const steady = (name: string) => {
            const value = (smooth.get(name) ?? score(name)) * 0.6 + score(name) * 0.4;
            smooth.set(name, value);
            return value;
          };
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
          const points = result.faceLandmarks.length === 1 ? result.faceLandmarks[0].map(back) : [];
          setExpression(points.length ? readExpression(steady) : null);
          let hands: NormalizedLandmark[][] = [];
          let body: NormalizedLandmark[] = [];
          if (trackBody.current) {
            void loadBody();
            hands = (handDetector?.detectForVideo(input, now).landmarks ?? []).map((hand) => hand.map(back));
            body = (poseDetector?.detectForVideo(input, now).landmarks[0] ?? []).map(back);
          }
          drawTracking(overlay.current, video, points, hands, body);
          // Mano levantada por encima del hombro durante un momento: Ayni lo nota.
          const raised = [[15, 11], [16, 12]].some(([wrist, shoulder]) => body[wrist] && body[shoulder] &&
            (body[wrist].visibility ?? 0) > 0.5 && body[wrist].y < body[shoulder].y - 0.08);
          if (!raised) { raisedSince = 0; raisedSent = false; }
          else if (!raisedSince) raisedSince = now;
          else if (!raisedSent && now - raisedSince >= 1200) { raisedSent = true; handleCue("hand"); }
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
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } },
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
      fit();
      // La cámara puede cambiar de resolución después de empezar.
      video.addEventListener("resize", fit);
      setStatus("Vista en vivo. Preparando el seguimiento…");
      try {
        vision = await import("@mediapipe/tasks-vision");
        if (stopped) return;
        const simd = await vision.FilesetResolver.isSimdSupported();
        if (stopped) return;
        assets = simd ? wasmAssets.simd : wasmAssets.basic;
        const model = await vision.FaceLandmarker.createFromOptions(assets, {
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
        setExpression(null);
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

  const shown = expression ? expressions[expression] : null;
  return <div className="session-camera">
    <div className="camera-frame" style={{ aspectRatio: ratio }}>
      <video ref={preview} muted playsInline aria-label="Vista de la cámara" />
      <canvas ref={overlay} aria-hidden="true" />
    </div>
    <div className="camera-meta">
      {shown && <p className="camera-expression" aria-live="polite"><shown.Icon aria-hidden="true" />{shown.label}</p>}
      <p role="status" className="camera-status">{status}</p>
    </div>
    {onAnalyzeFrame && <button type="button" disabled={analyzing} className="camera-analyze" title="Comparte una captura con Groq. El video continuo permanece en tu dispositivo." onClick={async () => {
      if (!preview.current) return;
      try { onAnalyzeFrame(await imageForConversation(preview.current)); }
      catch { setStatus("Espera a que la cámara muestre la imagen e inténtalo otra vez."); }
    }}>Conversar sobre esta imagen</button>}
  </div>;
}
