import { createDialog, nodeIndex, type Dialog, type DialogOptions, type Outcome, type UpdateOptions } from "@aleeforoughi/feather-dialog"
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
  /**
   * The experience changed (docs/lifecycle.md section 2): takes the new plan and returns what to say now. It leads with what
   * is new; a collapsed plan is spoken as its summary and artifact, and the dialog is done. A plan whose revision is not
   * higher than the one the dialog has is ignored, and nothing is said.
   */
  hearUpdate(plan: LayoutPlan, options?: UpdateOptions): { speech: Speech[] }
}

/** What happened to a dialog, in order, so a fresh dialog can be brought to the same state. */
type Event = { kind: "answer"; input: string } | { kind: "update"; plan: LayoutPlan; options?: UpdateOptions }

/** A dialog for voice: readback is on (override with `options.readback`), and `hear` takes alternatives. */
export function createVoiceDialog(firstPlan: LayoutPlan, options: DialogOptions = {}): VoiceDialog {
  const dialogOptions: DialogOptions = { ...options, readback: options.readback ?? true }
  let plan = firstPlan
  let irs = nodeIndex(plan)
  const inner = createDialog(plan, dialogOptions)
  const history: Event[] = []

  /** Tries an input on a fresh dialog brought to the current state; the real dialog is never touched. */
  function accepts(input: string): boolean {
    const probe = createDialog(firstPlan, dialogOptions)
    for (const past of history) {
      if (past.kind === "answer") probe.answer(past.input)
      else probe.update(past.plan, past.options)
    }
    return !probe.answer(input).turn.parts.some((p) => p.kind === "problem")
  }

  function apply(input: string): Outcome {
    history.push({ kind: "answer", input })
    return inner.answer(input)
  }

  function answer(transcripts: string[]): Outcome {
    const alternatives = transcripts.length > 0 ? transcripts : [""]
    const tries = alternatives.flatMap((alternative) => candidates(alternative, inner.turn, plan, irs))
    return apply(tries.find(accepts) ?? tries[0]!)
  }

  function update(next: LayoutPlan, opts?: UpdateOptions) {
    const before = inner.turn
    const turn = inner.update(next, opts)
    if (turn === before) return { turn, changed: false }
    history.push({ kind: "update", plan: next, options: opts })
    plan = next
    irs = nodeIndex(next)
    return { turn, changed: true }
  }

  return {
    get turn() {
      return inner.turn
    },
    get done() {
      return inner.done
    },
    get resolved() {
      return inner.resolved
    },
    answer: (input) => answer([input]),
    update: (next, opts) => update(next, opts).turn,
    hear(transcripts) {
      const outcome = answer(transcripts)
      return { speech: speechFor(outcome.turn, plan), replies: outcome.replies }
    },
    hearUpdate(next, opts) {
      const { turn, changed } = update(next, opts)
      return { speech: changed ? speechFor(turn, plan) : [] }
    },
  }
}
