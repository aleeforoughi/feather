// The lifecycle by voice (docs/lifecycle.md section 2): updates are spoken, an armed act is disarmed, a collapse is its summary.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { applyUpdate, type Experience, type ReplyEvent } from "@aleeforoughi/feather-intent"
import { createVoiceDialog, runVoice, type Speech } from "../src/index.ts"
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
const patchOk = (ex: Experience) => {
  const r = applyUpdate(ex, { update: "feather.update/0", experience: "plan_trip", revision: (ex.revision ?? 0) + 1, ops: [{ op: "patch", id: "ok", set: { consequence: { spend: { amount: 2480, currency: "AED" } } } }] })
  if (!r.ok) throw new Error(JSON.stringify(r.issues))
  return r.experience
}
const said = (speech: Speech[]) => speech.map((s) => s.text)

describe("voice: updates", () => {
  it("speaks what is new first, naming act nodes by intent; progress alone is silent", () => {
    const d = createVoiceDialog(plan(at(0)), { experience: at(0) })
    expect(d.hearUpdate(plan(at(1)), { experience: at(1) }).speech).toEqual(expect.not.arrayContaining([expect.objectContaining({ kind: "update" })]))
    const out = d.hearUpdate(plan(at(2)), { experience: at(2) })
    expect(out.speech[0]).toMatchObject({ kind: "update", text: "New: take the recommended flight, approve the booking." })
  })

  it("ignores a plan whose revision is not higher: nothing is said", () => {
    const d = createVoiceDialog(plan(at(2)), { experience: at(2) })
    expect(d.hearUpdate(plan(at(1)), { experience: at(1) }).speech).toEqual([])
    expect(d.hearUpdate(plan(at(2)), { experience: at(2) }).speech).toEqual([])
  })

  it("disarms an armed act whose node changed: it says so, and the keyword commits nothing", () => {
    const d = createVoiceDialog(plan(at(2)), { experience: at(2) })
    d.hear(["approve"])
    expect(d.turn.state).toBe("confirm")
    const changed = patchOk(at(2))
    const out = d.hearUpdate(plan(changed), { experience: changed })
    expect(said(out.speech).join(" ")).toMatch(/changed/)
    expect(d.turn.state).toBe("browse")
    expect(d.hear(["confirm"]).replies).toEqual([])
  })

  it("collapses to the done turn: the summary, then the artifact, no choices", () => {
    const d = createVoiceDialog(plan(at(2)), { experience: at(2) })
    const out = d.hearUpdate(plan(at(3)), { experience: at(3) })
    expect(said(out.speech)).toEqual(["Booked: direct flight, 9:40, 1,240 AED.", "Booking confirmation: https://example.com/booking/42"])
    expect(d.done).toBe(true)
    expect(d.turn.choices).toEqual([])
  })

  it("runVoice applies updates before each listen, and a collapse ends it", async () => {
    const spoken: string[][] = []
    const queue = [{ plan: plan(at(2)), experience: at(2) }, { plan: plan(at(3)), experience: at(3) }]
    const replies: ReplyEvent[] = []
    let first = true
    const result = await runVoice(
      plan(at(1)),
      {
        speak: async (s) => void spoken.push(said(s)),
        listen: async () => {
          if (first) {
            first = false
            return ["nothing useful"]
          }
          return []
        },
      },
      (r) => void replies.push(r),
      { experience: at(1), nextUpdate: () => (first ? queue.shift() : queue.shift()) },
    )
    // Both updates were waiting before the first listen: the second collapsed it.
    expect(result.done).toBe(true)
    expect(spoken.flat()).toContain("Booked: direct flight, 9:40, 1,240 AED.")
    expect(spoken.flat()).toContain("New: take the recommended flight, approve the booking.")
    expect(replies).toEqual([])
  })
})
