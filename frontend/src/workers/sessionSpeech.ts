import { env, pipeline } from "@huggingface/transformers";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;

const MODEL = "onnx-community/whisper-tiny";
const REVISION = "ff4177021cc41f7db950912b73ea4fdf7d01d8e7";
// Narrow the library's large cross-model overload to this one pipeline.
const createSpeechPipeline = pipeline as unknown as (
  task: "automatic-speech-recognition",
  model: string,
  options: { revision: string; device: "wasm"; dtype: "q8" },
) => Promise<AutomaticSpeechRecognitionPipeline>;
let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | undefined;

self.onmessage = async (event: MessageEvent<{ samples: Float32Array }>) => {
  try {
    if (!recognizer) {
      self.postMessage({ kind: "loading" });
      recognizer = createSpeechPipeline("automatic-speech-recognition", MODEL, {
        revision: REVISION,
        device: "wasm",
        dtype: "q8",
      });
    }
    const transcribe = await recognizer;
    self.postMessage({ kind: "transcribing" });
    const result = await transcribe(event.data.samples, {
      language: "spanish",
      task: "transcribe",
      max_new_tokens: 100,
    });
    const text = (Array.isArray(result) ? result[0]?.text : result.text)?.trim() ?? "";
    self.postMessage({ kind: "result", text });
  } catch {
    recognizer = undefined;
    self.postMessage({ kind: "error" });
  }
};
