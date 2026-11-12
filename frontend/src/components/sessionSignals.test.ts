import { describe, expect, it } from "vitest";
import { createFaceCueTracker, interpretReply } from "./sessionSignals";

describe("spoken session preferences", () => {
  it.each([
    ["Ayni, quiero descansar un rato", "pause"],
    ["No estoy cansado, sigamos", "detail"],
    ["No quiero seguir", "end"],
    ["Pasemos a otra actividad", "next"],
    ["Quiero escuchar música", "song"],
    ["Quiero ver una foto", "photo"],
    ["No me acuerdo de ese lugar", "ease"],
    ["Fuimos al parque", "place"],
    ["Ese día bailamos juntos", "activity"],
  ])("interprets %s as %s", (phrase, choice) => {
    expect(interpretReply(phrase)).toBe(choice);
  });
});

describe("camera cues", () => {
  it("waits for a sustained smile and a free conversational turn", () => {
    const observe = createFaceCueTracker();
    for (let t = 0; t <= 1800; t += 200) expect(observe("smiling", t, false)).toBeUndefined();
    expect(observe("smiling", 2000)).toBe("smile");
    expect(observe("smiling", 2200)).toBeUndefined();
  });

  it("requires prior framing and continuous absence before asking for a pause", () => {
    const observe = createFaceCueTracker();
    for (let t = 0; t < 8000; t += 200) expect(observe("absent", t)).toBeUndefined();
    observe("present", 8000);
    observe("absent", 8200);
    for (let t = 11000; t < 18000; t += 200) expect(observe("absent", t)).toBeUndefined();
    expect(observe("absent", 18000)).toBe("away");
  });

  it("discards framing after more than one face is detected", () => {
    const observe = createFaceCueTracker();
    observe("present", 0);
    observe("multiple", 200);
    for (let t = 400; t < 8000; t += 200) expect(observe("absent", t)).toBeUndefined();
  });
});
