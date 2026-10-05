import type { DialogOptions, UpdateOptions } from "@aleeforoughi/feather-dialog"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"
import { createVoiceDialog } from "./dialog.ts"
import { speechFor, type Speech } from "./speech.ts"

export interface VoiceEngine {
  speak(speech: Speech[]): Promise<void>
  /** The engine's alternatives for what was said, best first; an empty list when nothing was heard. */
  listen(): Promise<string[]>
}

/** A newer plan, composed from the experience after an update (docs/lifecycle.md). */
export interface VoiceUpdate extends UpdateOptions {
  plan: LayoutPlan
}

export interface RunVoiceOptions extends DialogOptions {
  /** How many times in a row nothing may be heard before it stops. Default 3. */
  maxSilences?: number
  /**
   * Asked before each time it listens: the next update, or nothing. It is drained, so every update waiting is applied, in
   * order, and what is new is spoken. A collapsed plan ends the conversation with its summary.
   */
  nextUpdate?: () => VoiceUpdate | undefined | Promise<VoiceUpdate | undefined>
}

export interface RunVoiceResult {
  replies: ReplyEvent[]
  done: boolean
  /** True when it stopped because nothing was heard. */
  silent: boolean
}

/** Speaks, listens, answers, until the dialog is done or nothing is heard three times in a row. */
export async function runVoice(plan: LayoutPlan, engine: VoiceEngine, onReply: (reply: ReplyEvent) => void | Promise<void>, options: RunVoiceOptions = {}): Promise<RunVoiceResult> {
  const { maxSilences = 3, nextUpdate, ...dialogOptions } = options
  const dialog = createVoiceDialog(plan, dialogOptions)
  const replies: ReplyEvent[] = []
  let silences = 0
  await engine.speak(speechFor(dialog.turn, plan))
  // With updates coming, nothing to act on yet is not the end: it waits until the experience collapses.
  const over = () => (nextUpdate ? dialog.resolved : dialog.done)
  while (!over()) {
    if (nextUpdate) {
      for (let waiting = await nextUpdate(); waiting; waiting = dialog.resolved ? undefined : await nextUpdate()) {
        const { plan: next, ...updateOptions } = waiting
        const said = dialog.hearUpdate(next, updateOptions).speech
        if (said.length > 0) await engine.speak(said)
      }
      if (over()) break
    }
    const heard = (await engine.listen()).filter((t) => t.trim() !== "")
    if (heard.length === 0) {
      silences++
      if (silences >= maxSilences) {
        await engine.speak([{ text: "I did not hear anything, so I am stopping.", lang: plan.locale, kind: "hint" }])
        return { replies, done: false, silent: true }
      }
    } else silences = 0
    const out = dialog.hear(heard)
    for (const reply of out.replies) {
      replies.push(reply)
      await onReply(reply)
    }
    await engine.speak(out.speech)
  }
  return { replies, done: dialog.done, silent: false }
}
