import { expect, it } from "vitest";
import { createVoiceActivity } from "./voiceActivity";

it("detecta voz suave sostenida sin tratar un golpe aislado como una frase", () => {
  const detector = createVoiceActivity();
  expect(detector(.1, 0).started).toBe(false);
  detector(.001, 50);
  for (let t = 100; t < 400; t += 50) expect(detector(.001, t).active).toBe(false);
  detector(.009, 400); detector(.009, 450);
  expect(detector(.009, 500).started).toBe(true);
});

it("respeta pausas entre palabras y finaliza una respuesta tras silencio sostenido", () => {
  const detector = createVoiceActivity();
  detector(.02, 0); detector(.02, 50); detector(.02, 100);
  expect(detector(.001, 1900).ended).toBe(false);
  detector(.02, 1950); detector(.02, 2000); detector(.02, 2050);
  expect(detector(.001, 4200).ended).toBe(false);
  expect(detector(.001, 4500).ended).toBe(false);
  expect(detector(.001, 5300).ended).toBe(true);
});

it("limita una intervención continua a treinta segundos", () => {
  const detector = createVoiceActivity();
  detector(.04, 0); detector(.04, 50); detector(.04, 100);
  expect(detector(.04, 30100).ended).toBe(true);
});
