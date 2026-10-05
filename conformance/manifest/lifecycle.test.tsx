// L6: the experience lifecycle through all four bodies (docs/lifecycle.md section 3). The streamed trip is applied update by
// update, every body recomposes in its own context, and each must give the same replies and end in the same collapse with
// nothing left to act on. A safety scenario arms the approval and then changes what it would commit: no body commits it.
//
// Written against the documented behaviour only. A body that fails this is a bug in the body, never in the driver.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { applyUpdate, type Experience, type ReplyEvent } from "@aleeforoughi/feather-intent"
import { BODIES, type Body } from "./fixtures.ts"
import { SESSIONS } from "./drivers/session.tsx"
import { voiceExists } from "./drivers/voice.ts"

const fixture = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../update/valid/streamed-trip.json"), "utf8")) as {
  experience: Experience
  updates: unknown[]
  replies: Record<string, ReplyEvent>
}

/** The experience after the first n updates. */
function at(n: number): Experience {
  let ex = fixture.experience
  for (const update of fixture.updates.slice(0, n)) {
    const r = applyUpdate(ex, update)
    if (!r.ok) throw new Error(`the streamed trip does not apply: ${r.issues.map((i) => i.message).join("; ")}`)
    ex = r.experience
  }
  return ex
}

/** An update written here, applied to `ex`. */
function after(ex: Experience, ops: unknown[]): Experience {
  const r = applyUpdate(ex, { update: "feather.update/1", experience: ex.experience, revision: (ex.revision ?? 0) + 1, ops })
  if (!r.ok) throw new Error(`the update does not apply: ${r.issues.map((i) => i.message).join("; ")}`)
  return r.experience
}

const approval = fixture.replies["2"]!
const changeConsequence = [{ op: "patch", id: "ok", set: { consequence: { spend: { amount: 2480, currency: "AED" } } } }]
const bodies = BODIES.filter((b) => b !== "voice" || voiceExists)
const each = (name: string, run: (body: Body) => Promise<void>) => {
  for (const body of bodies) it(`${body}: ${name}`, () => run(body))
}

describe("the streamed trip, update by update", () => {


  each("the approval between update 2 and 3 is the same reply, and the stale plan between is ignored", async (body) => {
    const session = SESSIONS[body](at(0))
    try {
      session.show(at(1))
      session.show(at(2))
      // A plan that is not newer is not applied: the person can still act.
      session.show(at(1))
      expect(await session.act("ok", "approve")).toEqual([approval])
    } finally {
      session.unmount()
    }
  })

  each("collapses to the summary and the artifact, with nothing left to act on", async (body) => {
    const session = SESSIONS[body](at(0))
    try {
      for (const n of [1, 2, 3]) session.show(at(n))
      const resolved = session.resolved()
      expect(resolved.lines).toEqual(["Booked: direct flight, 9:40, 1,240 AED.", "Booking confirmation: https://example.com/booking/42"])
      expect(resolved.controls).toBe(0)
    } finally {
      session.unmount()
    }
  })

  each("a non-http artifact link is the label alone, and a resolution with no artifact is the summary alone", async (body) => {
    const resolve = (artifact?: unknown) => after(at(2), [{ op: "remove", id: "work" }, { op: "remove", id: "rec" }, { op: "remove", id: "ok" }, { op: "resolve", outcome: "failed", summary: "Could not book.", ...(artifact ? { artifact } : {}) }])
    for (const [artifact, lines] of [
      [{ label: "Receipt", href: "javascript:alert(1)" }, ["Could not book.", "Receipt"]],
      [{ label: "Receipt" }, ["Could not book.", "Receipt"]],
      [undefined, ["Could not book."]],
    ] as const) {
      const session = SESSIONS[body](at(2))
      try {
        session.show(resolve(artifact))
        expect(session.resolved().lines).toEqual(lines)
        expect(session.resolved().controls).toBe(0)
      } finally {
        session.unmount()
      }
    }
  })

  each("an update that leaves the approval alone does not disarm it", async (body) => {
    const session = SESSIONS[body](at(2))
    try {
      await session.arm("ok", "approve")
      session.show(after(at(2), [{ op: "patch", id: "work", set: { label: "Finding flights again" } }]))
      expect(await session.confirm()).toEqual([approval])
    } finally {
      session.unmount()
    }
  })
})

describe("safety: an update that changes what an armed act would commit", () => {
  each("confirming after the consequence changed commits nothing", async (body) => {
    const session = SESSIONS[body](at(2))
    try {
      await session.arm("ok", "approve")
      session.show(after(at(2), changeConsequence))
      expect(await session.confirm()).toEqual([])
    } finally {
      session.unmount()
    }
  })

  each("confirming after the approval was removed commits nothing", async (body) => {
    const session = SESSIONS[body](at(2))
    try {
      await session.arm("ok", "approve")
      session.show(after(at(2), [{ op: "remove", id: "ok" }]))
      expect(await session.confirm()).toEqual([])
    } finally {
      session.unmount()
    }
  })

  each("the changed approval can still be approved afresh, by a deliberate act", async (body) => {
    const session = SESSIONS[body](at(2))
    try {
      await session.arm("ok", "approve")
      session.show(after(at(2), changeConsequence))
      expect(await session.confirm()).toEqual([])
      expect(await session.act("ok", "approve")).toEqual([approval])
    } finally {
      session.unmount()
    }
  })
})
