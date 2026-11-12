// Detector adaptativo: tolera voz suave y pausas breves entre palabras.
export function createVoiceActivity() {
  let floor = 0.002;
  let consecutive = 0;
  let lastSpeech: number | null = null;
  let firstSpeech: number | null = null;
  return (rms: number, now: number) => {
    const threshold = Math.max(0.006, floor * 2.5);
    let started = false;
    if (rms >= threshold) {
      consecutive++;
      if (consecutive >= 3) {
        started = firstSpeech === null;
        firstSpeech ??= now;
        lastSpeech = now;
      }
    } else {
      consecutive = 0;
      if (firstSpeech === null) floor = Math.min(0.015, floor * 0.95 + rms * 0.05);
    }
    return { started, active: firstSpeech !== null, ended: lastSpeech !== null &&
      (now - lastSpeech >= 3200 || now - firstSpeech! >= 30_000) };
  };
}
