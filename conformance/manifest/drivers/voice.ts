// The voice driver: createVoiceDialog().hear([...]) with spoken forms. The voice package may not exist yet, so it is
// imported when it can be, and its tests skip when it cannot.
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"
import type { Fixture } from "../fixtures.ts"
import { planFor } from "../fixtures.ts"
import type { Scenario } from "../scenarios.ts"
import { driveTalk, type Talker } from "./talk.ts"
import type { Result } from "./types.ts"

// A variable specifier: the package may be absent, and a missing optional body must skip, not break, the suite.
const specifier = "@aleeforoughi/feather-manifest-voice"
export const voice: typeof import("@aleeforoughi/feather-manifest-voice") | null = await import(/* @vite-ignore */ specifier).catch(() => null)
export const voiceExists = voice !== null

export function voiceTalker(fx: Fixture): { plan: LayoutPlan; talker: Talker } {
  if (!voice) throw new Error("@aleeforoughi/feather-manifest-voice does not exist")
  const plan = planFor(fx.ir, "voice", fx.persona)
  const dialog = voice.createVoiceDialog(plan, { experience: fx.ir })
  return {
    plan,
    talker: {
      get turn() {
        return dialog.turn
      },
      say: (phrase) => dialog.hear([phrase]).replies,
      sayAlternatives: (phrases) => dialog.hear(phrases).replies,
    },
  }
}

export function driveVoice(fx: Fixture, s: Scenario): Result {
  const { plan, talker } = voiceTalker(fx)
  return driveTalk(talker, plan, s, "voice")
}
