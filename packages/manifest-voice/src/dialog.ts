import { createDialog, nodeIndex, type Dialog, type DialogOptions, type Outcome } from "@aleeforoughi/feather-dialog"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"
import { candidates } from "./hear.ts"
import { speechFor, type Speech } from "./speech.ts"

export interface VoiceDialog extends Dialog {
  /**
   * Takes what the speech engine thought it heard, best first. The first alternative the dialog accepts (answers without a
   * `problem`) is applied; if none is accepted, the first one is, so the person hears why. A rejected alternative never
   * changes anything.
   */
  hear(transcripts: string[]): { speech: Speech[]; replies: ReplyEvent[] }
}

/** A dialog for voice: readback is on (override with `options.readback`), and `hear` takes alternatives. */
export function createVoiceDialog(plan: LayoutPlan, options: DialogOptions = {}): VoiceDialog {
  const dialogOptions: DialogOptions = { ...options, readback: options.readback ?? true }
  const irs = nodeIndex(plan)
  const inner = createDialog(plan, dialogOptions)
  /** Every input the real dialog has been given, so a fresh dialog can be brought to the same state. */
  const history: string[] = []

  /** Tries an input on a fresh dialog brought to the current state; the real dialog is never touched. */
  function accepts(input: string): boolean {
    const probe = createDialog(plan, dialogOptions)
    for (const past of history) probe.answer(past)
    return !probe.answer(input).turn.parts.some((p) => p.kind === "problem")
  }

  function apply(input: string): Outcome {
    history.push(input)
    return inner.answer(input)
  }

  function answer(transcripts: string[]): Outcome {
    const alternatives = transcripts.length > 0 ? transcripts : [""]
    const tries = alternatives.flatMap((alternative) => candidates(alternative, inner.turn, plan, irs))
    return apply(tries.find(accepts) ?? tries[0]!)
  }

  return {
    get turn() {
      return inner.turn
    },
    get done() {
      return inner.done
    },
    answer: (input) => answer([input]),
    hear(transcripts) {
      const outcome = answer(transcripts)
      return { speech: speechFor(outcome.turn, plan), replies: outcome.replies }
    },
  }
}
