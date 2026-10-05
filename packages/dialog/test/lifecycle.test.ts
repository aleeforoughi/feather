// The lifecycle in the dialog (docs/lifecycle.md section 2): updates change the conversation in place.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { applyUpdate, type Experience } from "@aleeforoughi/feather-intent"
import { createDialog } from "../src/index.ts"
import { planOf, texts } from "./helpers.ts"

const trip = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../../conformance/update/valid/streamed-trip.json"), "utf8")) as { experience: Experience; updates: unknown[] }

/** The experience after the first n updates of the streamed trip. */
function at(n: number, updates: unknown[] = trip.updates): Experience {
  let ex = trip.experience
  for (const u of updates.slice(0, n)) {
    const r = applyUpdate(ex, u)
    if (!r.ok) throw new Error(JSON.stringify(r.issues))
    ex = r.experience
  }
  return ex
}
const feed = (d: ReturnType<typeof createDialog>, ex: Experience) => d.update(planOf(ex), { experience: ex })

describe("dialog update", () => {
  it("leads with what is new, naming act nodes by intent, and says nothing for progress", () => {
    const d = createDialog(planOf(at(0)), { experience: at(0) })
    const progress = feed(d, at(1))
    expect(texts(progress, "update")).toEqual([])
    const turn = feed(d, at(2))
    expect(turn.parts[0]).toMatchObject({ kind: "update", text: "New: take the recommended flight, approve the booking." })
    expect(turn.choices.map((c) => c.node)).toEqual(expect.arrayContaining(["rec", "ok"]))
  })

  it("keeps a node answered, and does not offer it again", () => {
    const base = { ir: "feather.ir/0", experience: "ask", nodes: [{ type: "Action", id: "go", intent: "go on", label: "Go" }, { type: "Action", id: "stay", intent: "stay", label: "Stay" }] } as unknown as Experience
    const d = createDialog(planOf(base), { experience: base })
    expect(d.answer(String(d.turn.choices.find((c) => c.node === "go")!.n)).replies).toHaveLength(1)
    const added = applyUpdate(base, { update: "feather.update/0", experience: "ask", revision: 1, ops: [{ op: "add", node: { type: "Action", id: "more", intent: "do more", label: "More" } }] })
    if (!added.ok) throw new Error(JSON.stringify(added.issues))
    const turn = feed(d, added.experience)
    expect(turn.choices.map((c) => c.node).sort()).toEqual(["more", "stay"])
    expect(texts(turn, "update")).toEqual(["New: do more."])
  })

  it("ignores a plan whose revision is not higher", () => {
    const d = createDialog(planOf(at(2)), { experience: at(2) })
    const before = d.turn
    expect(feed(d, at(1))).toBe(before)
    expect(feed(d, at(2))).toBe(before)
    expect(d.turn).toBe(before)
  })

  it("disarms an armed act whose node changed: says so, and confirming commits nothing", () => {
    const ex2 = at(2)
    const d = createDialog(planOf(ex2), { experience: ex2 })
    const ok = d.turn.choices.find((c) => c.node === "ok" && c.act === "approve")!
    expect(d.answer(String(ok.n)).turn.state).toBe("confirm")
    const patched = applyUpdate(ex2, { update: "feather.update/0", experience: "plan_trip", revision: 3, ops: [{ op: "patch", id: "ok", set: { consequence: { spend: { amount: 2480, currency: "AED" } } } }] })
    if (!patched.ok) throw new Error("update refused")
    const turn = feed(d, patched.experience)
    expect(turn.state).toBe("browse")
    expect(texts(turn, "problem").join(" ")).toMatch(/changed.*nothing was done/i)
    const confirm = d.answer("confirm")
    expect(confirm.replies).toEqual([])
    // Approving again goes through the new consequence.
    const again = d.answer(String(d.turn.choices.find((c) => c.node === "ok" && c.act === "approve")!.n))
    expect(again.turn.state).toBe("confirm")
    expect(texts(again.turn, "consequence").join(" ")).toMatch(/2,?480/)
    expect(d.answer("confirm").replies).toHaveLength(1)
  })

  it("cancels an armed act whose node was removed", () => {
    const ex2 = at(2)
    const d = createDialog(planOf(ex2), { experience: ex2 })
    d.answer(String(d.turn.choices.find((c) => c.node === "ok" && c.act === "approve")!.n))
    const removed = applyUpdate(ex2, { update: "feather.update/0", experience: "plan_trip", revision: 3, ops: [{ op: "remove", id: "ok" }] })
    if (!removed.ok) throw new Error("update refused")
    const turn = feed(d, removed.experience)
    expect(texts(turn, "problem").join(" ")).toMatch(/no longer there/)
    expect(d.answer("confirm").replies).toEqual([])
  })

  it("keeps a pending value step whose node is unchanged", () => {
    const base = { ir: "feather.ir/0", experience: "ask", nodes: [{ type: "Input", id: "name", intent: "name it", prompt: "Name?", kind: "text" }] } as unknown as Experience
    const d = createDialog(planOf(base), { experience: base })
    d.answer("1")
    expect(d.turn.state).toBe("value")
    const added = applyUpdate(base, { update: "feather.update/0", experience: "ask", revision: 1, ops: [{ op: "add", node: { type: "Text", id: "note", text: "Hello" } }] })
    if (!added.ok) throw new Error(JSON.stringify(added.issues))
    const turn = feed(d, added.experience)
    expect(turn.state).toBe("value")
    const done = d.answer("Ada")
    expect(done.replies).toHaveLength(1)
  })

  it("cancels a pending value step whose node changed", () => {
    const base = { ir: "feather.ir/0", experience: "ask", nodes: [{ type: "Input", id: "name", intent: "name it", prompt: "Name?", kind: "text" }] } as unknown as Experience
    const d = createDialog(planOf(base), { experience: base })
    d.answer("1")
    const patched = applyUpdate(base, { update: "feather.update/0", experience: "ask", revision: 1, ops: [{ op: "patch", id: "name", set: { prompt: "Full name?" } }] })
    if (!patched.ok) throw new Error(JSON.stringify(patched.issues))
    const turn = feed(d, patched.experience)
    expect(turn.state).toBe("browse")
    expect(texts(turn, "problem").join(" ")).toMatch(/changed/)
    expect(d.answer("Ada").replies).toEqual([])
  })

  it("collapses to the done turn: summary, then the artifact as label and http link; no choices", () => {
    const d = createDialog(planOf(at(2)), { experience: at(2) })
    const turn = feed(d, at(3))
    expect(turn.state).toBe("done")
    expect(turn.choices).toEqual([])
    expect(turn.parts.map((p) => p.text)).toEqual(["Booked: direct flight, 9:40, 1,240 AED.", "Booking confirmation: https://example.com/booking/42"])
    expect(d.done).toBe(true)
    expect(d.answer("1").replies).toEqual([])
  })

  it("says the label alone for an artifact without an http(s) href, and only the summary for none", () => {
    const resolve = (artifact?: unknown) => {
      const r = applyUpdate(at(2), { update: "feather.update/0", experience: "plan_trip", revision: 3, ops: [{ op: "remove", id: "work" }, { op: "remove", id: "rec" }, { op: "remove", id: "ok" }, { op: "resolve", outcome: "failed", summary: "Could not book.", ...(artifact ? { artifact } : {}) }] })
      if (!r.ok) throw new Error(JSON.stringify(r.issues))
      return createDialog(planOf(at(2)), { experience: at(2) }).update(planOf(r.experience), { experience: r.experience })
    }
    expect(resolve({ label: "Receipt", href: "javascript:alert(1)" }).parts.map((p) => p.text)).toEqual(["Could not book.", "Receipt"])
    expect(resolve({ label: "Receipt" }).parts.map((p) => p.text)).toEqual(["Could not book.", "Receipt"])
    expect(resolve().parts.map((p) => p.text)).toEqual(["Could not book."])
  })

  it("starts as the done turn when opened already collapsed", () => {
    const d = createDialog(planOf(at(3)), { experience: at(3) })
    expect(d.turn.state).toBe("done")
    expect(d.turn.parts).toHaveLength(2)
  })
})
