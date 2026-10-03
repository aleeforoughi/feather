import type { DialogOptions } from "@aleeforoughi/feather-dialog"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"
import { createVoiceDialog } from "./dialog.ts"
import { speechFor, type Speech } from "./speech.ts"

export interface VoiceEngine {
  speak(speech: Speech[]): Promise<void>
  /** The engine's alternatives for what was said, best first; an empty list when nothing was heard. */
  listen(): Promise<string[]>
}

export interface RunVoiceOptions extends DialogOptions {
  /** How many times in a row nothing may be heard before it stops. Default 3. */
  maxSilences?: number
}

export interface RunVoiceResult {
  replies: ReplyEvent[]
  done: boolean
  /** True when it stopped because nothing was heard. */
  silent: boolean
}

/** Speaks, listens, answers, until the dialog is done or nothing is heard three times in a row. */
export async function runVoice(plan: LayoutPlan, engine: VoiceEngine, onReply: (reply: ReplyEvent) => void | Promise<void>, options: RunVoiceOptions = {}): Promise<RunVoiceResult> {
  const { maxSilences = 3, ...dialogOptions } = options
  const dialog = createVoiceDialog(plan, dialogOptions)
  const replies: ReplyEvent[] = []
  let silences = 0
  await engine.speak(speechFor(dialog.turn, plan))
  while (!dialog.done) {
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
  return { replies, done: true, silent: false }
}
