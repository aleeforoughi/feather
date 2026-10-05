// A conversation in the terminal: a readline loop over a dialog. The streams are injected, so it runs the same over a
// TTY, a pipe or a test.
import { createInterface } from "node:readline"
import process from "node:process"
import type { Readable, Writable } from "node:stream"
import { createDialog } from "@aleeforoughi/feather-dialog"
import type { Experience, ReplyEvent } from "@aleeforoughi/feather-intent"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"
import { renderTurn } from "./render.ts"

export interface RunTextOptions {
  /** Where the person's lines come from. */
  input: Readable
  /** Where the conversation is written (a CLI sends it to stderr, so stdout holds only replies). */
  output: Writable
  /** Called with every reply, in order, as it goes out. */
  onReply: (reply: ReplyEvent) => void | Promise<void>
  /** The experience the plan came from; replies are checked against it. */
  experience?: Experience
  /** Where lines wrap. Default 80. */
  width?: number
  /** Read each value back and ask "is that right?" first. */
  readback?: boolean
  /** Bold the critical and primary parts. Default: only when the output is a TTY and NO_COLOR is not set. */
  color?: boolean
  /** Write each line the person typed after the prompt. Default: when the input is not a TTY (a pipe has no echo). */
  echo?: boolean
  /**
   * Newer plans, composed from the experience as the caller updates it (docs/lifecycle.md). Each is applied as it arrives:
   * what is new is written, and a collapsed plan writes its summary and ends the conversation.
   */
  updates?: AsyncIterable<TextUpdate>
}

/** A newer plan, with the experience it was composed from so replies are checked against it. */
export interface TextUpdate {
  plan: LayoutPlan
  experience?: Experience
}

export interface RunTextResult {
  /** The dialog reached its end (nothing left to act on), rather than the input closing first. */
  done: boolean
  /** Every reply that went out. */
  replies: ReplyEvent[]
}

const isTTY = (stream: unknown) => (stream as { isTTY?: boolean } | undefined)?.isTTY === true

/** Whether styling is allowed on this output: a TTY, with NO_COLOR unset or empty (no-color.org). */
export function canStyle(output: unknown, env: Record<string, string | undefined> = process.env): boolean {
  return isTTY(output) && (env.NO_COLOR === undefined || env.NO_COLOR === "")
}

/** Runs the dialog until it is done or the input closes. */
export async function runText(plan: LayoutPlan, options: RunTextOptions): Promise<RunTextResult> {
  const { input, output, onReply } = options
  const dialog = createDialog(plan, { experience: options.experience, readback: options.readback })
  const render = { width: options.width, color: options.color ?? canStyle(output) }
  const echo = options.echo ?? !isTTY(input)
  const replies: ReplyEvent[] = []

  output.write(renderTurn(dialog.turn, render))
  // With updates coming, nothing to act on yet is not the end: it waits until the experience collapses.
  const over = () => (options.updates ? dialog.resolved : dialog.done)
  if (over()) return { done: true, replies }

  const rl = createInterface({ input, crlfDelay: Infinity, terminal: false })
  const watcher = options.updates?.[Symbol.asyncIterator]()
  let stopped = false
  const watching = (async () => {
    if (!watcher) return
    while (!stopped) {
      const next = await watcher.next()
      if (next.done || stopped) return
      const before = dialog.turn
      const turn = dialog.update(next.value.plan, { experience: next.value.experience })
      if (turn === before) continue
      output.write(`\n${renderTurn(turn, render)}`)
      if (dialog.resolved) {
        rl.close()
        return
      }
    }
  })()
  try {
    for await (const line of rl) {
      if (echo) output.write(`${line}\n`)
      const result = dialog.answer(line)
      for (const reply of result.replies) {
        replies.push(reply)
        await onReply(reply)
      }
      output.write(renderTurn(result.turn, render))
      if (over()) break
    }
  } finally {
    stopped = true
    rl.close()
    void watcher?.return?.()
    void watching.catch(() => undefined)
  }
  if (!dialog.done) output.write("\n")
  return { done: dialog.done, replies }
}
