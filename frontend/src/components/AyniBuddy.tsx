import { AyniCompanion } from "./AyniCompanion";
import type { CompanionMood, CompanionState, OwlAnimation } from "./AyniCompanion";

/** Gestos disponibles para la misma mascota que aparece en el resto de Ayni. */
export type BuddyPose = OwlAnimation;
export type BuddyMood = CompanionMood;

export function AyniBuddy({ state, pose, mood = "warm" }: {
  state: CompanionState;
  pose: BuddyPose;
  mood?: BuddyMood;
}) {
  return <AyniCompanion state={state} mood={mood} animation={pose} className="session-owl" decorative />;
}
