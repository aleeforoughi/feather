// The lifecycle in the terminal (docs/lifecycle.md section 2): runText applies updates as they arrive.
import fs from "node:fs"
import path from "node:path"
import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"
import { applyUpdate, type Experience, type ReplyEvent } from "@aleeforoughi/feather-intent"
import { runText, type TextUpdate } from "../src/index.ts"
import { plan } from "./helpers.ts"

const trip = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../../conformance/update/valid/streamed-trip.json"), "utf8")) as { experience: Experience; updates: unknown[] }

function at(n: number): Experience {
  let ex = trip.experience
  for (const u of trip.updates.slice(0, n)) {
    const r = applyUpdate(ex, u)
    if (!r.ok) throw new Error(JSON.stringify(r.issues))
    ex = r.experience
  }
  return ex
}
const update = (n: number): TextUpdate => ({ plan: plan(at(n)), experience: at(n) })

/** An async iterable fed by hand. */
function feed() {
  const queue: TextUpdate[] = []
  let wake: (() => void) | undefined
  let closed = false
  return {
    push(u: TextUpdate) {
      queue.push(u)
      wake?.()
    },
    close() {
      closed = true
      wake?.()
    },
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (queue.length > 0) yield queue.shift()!
        else if (closed) return
        else await new Promise<void>((resolve) => (wake = resolve))
      }
    },
  }
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 20))

describe("runText with updates", () => {
  it("writes what is new when an update arrives, then the summary when it collapses, and ends", async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    let text = ""
    output.on("data", (c: Buffer) => (text += c.toString("utf8")))
    const updates = feed()
    const replies: ReplyEvent[] = []
    const running = runText(plan(at(0)), { input, output, onReply: (r) => void replies.push(r), experience: at(0), updates })
    await tick()
    updates.push(update(1))
    updates.push(update(2))
    await tick()
    expect(text).toContain("New: take the recommended flight, approve the booking.")
    updates.push(update(3))
    const result = await running
    expect(result.done).toBe(true)
    expect(text).toContain("Booked: direct flight, 9:40, 1,240 AED.")
    expect(text).toContain("Booking confirmation: https://example.com/booking/42")
    expect(replies).toEqual([])
    updates.close()
  })
})
