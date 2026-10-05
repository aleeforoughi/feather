import { describe, expect, it } from "vitest"
import { applyUpdate, validate, validateReply, type Experience, type ExperienceUpdate } from "../src/index.ts"

// L6: open → update → resolve → collapse. A streamed experience, step by step: progress, then a recommendation, then
// an approval, then done, leaving only a summary and an artifact.
const open: Experience = {
  ir: "feather.ir/1",
  experience: "plan_trip",
  nodes: [{ type: "Progress", id: "work", label: "Finding flights", steps: [{ id: "search", label: "Search", state: "active" }, { id: "rank", label: "Rank", state: "pending" }] }],
}
const update = (revision: number, ops: unknown[]): ExperienceUpdate => ({ update: "feather.update/1", experience: "plan_trip", revision, ops }) as ExperienceUpdate
const apply = (experience: Experience, u: unknown) => {
  const result = applyUpdate(experience, u)
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.experience
}
const codes = (experience: Experience, u: unknown) => {
  const result = applyUpdate(experience, u)
  return result.ok ? [] : result.issues.map((i) => i.code)
}
const paths = (experience: Experience, u: unknown) => {
  const result = applyUpdate(experience, u)
  return result.ok ? [] : result.issues.map((i) => i.path)
}

describe("applyUpdate: the streamed experience", () => {
  const r1 = apply(open, update(1, [{ op: "patch", id: "work", set: { value: 0.5, steps: [{ id: "search", label: "Search", state: "done" }, { id: "rank", label: "Rank", state: "active" }] } }]))
  const r2 = apply(r1, update(2, [
    { op: "patch", id: "work", set: { value: 1 } },
    { op: "add", node: { type: "Recommendation", id: "rec", intent: "take the recommended flight", summary: "Direct, 9:40, 1,240 AED" } },
    { op: "add", node: { type: "Approval", id: "ok", intent: "approve the booking", request: "Book it for 1,240 AED?", consequence: { spend: { amount: 1240, currency: "AED" } } } },
  ]))
  const r3 = apply(r2, update(3, [{ op: "resolve", outcome: "done", summary: "Booked: direct flight, 9:40, 1,240 AED.", artifact: { label: "Booking confirmation", href: "https://example.com/booking/42", kind: "document" } }]))

  it("moves the revision by one each time and keeps the experience valid", () => {
    expect([r1.revision, r2.revision, r3.revision]).toEqual([1, 2, 3])
    for (const e of [r1, r2, r3]) expect(validate(e).ok).toBe(true)
  })
  it("changes fields in place, adds nodes in order", () => {
    expect(r1.nodes[0]).toMatchObject({ id: "work", value: 0.5 })
    expect(r2.nodes.map((n) => n.id)).toEqual(["work", "rec", "ok"])
  })
  it("resolves: the experience keeps its outcome, summary and artifact, and takes no more replies or updates", () => {
    expect(r3.resolved).toEqual({ outcome: "done", summary: "Booked: direct flight, 9:40, 1,240 AED.", artifact: { label: "Booking confirmation", href: "https://example.com/booking/42", kind: "document" } })
    const reply = validateReply(r3, { experience: "plan_trip", node: "ok", act: "approve" })
    expect(reply.ok ? [] : reply.issues.map((i) => i.code)).toEqual(["resolved"])
    expect(codes(r3, update(4, [{ op: "remove", id: "rec" }]))).toEqual(["already-resolved"])
  })
  it("never changes the experience it is given", () => {
    const before = structuredClone(r1)
    apply(r1, update(2, [{ op: "patch", id: "work", set: { label: "Changed" } }]))
    expect(r1).toEqual(before)
  })
})

describe("applyUpdate: ops", () => {
  it("adds after a named node", () => {
    const e = apply(open, update(1, [{ op: "add", node: { type: "Text", id: "t", text: "Hi." } }, { op: "add", node: { type: "Text", id: "u", text: "First." }, after: "work" }]))
    expect(e.nodes.map((n) => n.id)).toEqual(["work", "u", "t"])
  })
  it("replaces a node whole, and removes one", () => {
    const e = apply(open, update(1, [{ op: "replace", node: { type: "Status", id: "work", label: "Found 3 flights", state: "done" } }]))
    expect(e.nodes[0]).toEqual({ type: "Status", id: "work", label: "Found 3 flights", state: "done" })
    const f = apply(open, update(1, [{ op: "add", node: { type: "Text", id: "t", text: "Hi." } }, { op: "remove", id: "work" }]))
    expect(f.nodes.map((n) => n.id)).toEqual(["t"])
  })
  it("removes a field patched to null", () => {
    const e = apply(open, update(1, [{ op: "patch", id: "work", set: { steps: null } }]))
    expect("steps" in e.nodes[0]).toBe(false)
  })
  it("resolves with no nodes left", () => {
    const e = apply(open, update(1, [{ op: "remove", id: "work" }, { op: "resolve", outcome: "cancelled", summary: "Search stopped." }]))
    expect(e.nodes).toEqual([])
    expect(validate(e).ok).toBe(true)
  })
})

describe("applyUpdate: what it refuses", () => {
  it("a revision that does not follow", () => {
    expect(codes(open, update(2, [{ op: "remove", id: "work" }]))).toEqual(["stale-revision"])
    expect(codes(open, update(0, [{ op: "remove", id: "work" }]))).toEqual(["stale-revision"])
  })
  it("another experience, another format, or no ops", () => {
    expect(codes(open, { ...update(1, [{ op: "remove", id: "work" }]), experience: "other" })).toEqual(["wrong-experience"])
    expect(codes(open, { ...update(1, []), update: "feather.update/9" })).toEqual(["unsupported-version"])
    expect(codes(open, update(1, []))).toEqual(["empty-update"])
    expect(codes(open, "nope")).toEqual(["not-an-object"])
  })
  it("ops on nodes that are not there, ids that are, and unknown ops", () => {
    expect(codes(open, update(1, [{ op: "patch", id: "nope", set: { value: 1 } }]))).toEqual(["unknown-node"])
    expect(codes(open, update(1, [{ op: "remove", id: "nope" }]))).toEqual(["unknown-node"])
    expect(codes(open, update(1, [{ op: "replace", node: { type: "Text", id: "nope", text: "x" } }]))).toEqual(["unknown-node"])
    expect(codes(open, update(1, [{ op: "add", node: { type: "Text", id: "work", text: "x" } }]))).toEqual(["duplicate-id"])
    expect(codes(open, update(1, [{ op: "add", node: { type: "Text", id: "t", text: "x" }, after: "nope" }]))).toEqual(["unknown-node"])
    expect(codes(open, update(1, [{ op: "move", id: "work" }]))).toEqual(["unknown-op"])
  })
  it("a patch of the id or the type, or of nothing", () => {
    expect(codes(open, update(1, [{ op: "patch", id: "work", set: { type: "Status" } }]))).toEqual(["invalid-value"])
    expect(codes(open, update(1, [{ op: "patch", id: "work", set: {} }]))).toEqual(["empty-update"])
  })
  it("any op after resolve", () => {
    expect(codes(open, update(1, [{ op: "resolve", outcome: "done", summary: "Done." }, { op: "remove", id: "work" }]))).toEqual(["after-resolve"])
  })
  it("a resolution that is not one: no outcome, a summary over one line", () => {
    expect(codes(open, update(1, [{ op: "resolve", summary: "Done." }]))).toEqual(["missing-field"])
    expect(codes(open, update(1, [{ op: "resolve", outcome: "done", summary: "Line one\nline two" }]))).toEqual(["too-long"])
    expect(codes(open, update(1, [{ op: "resolve", outcome: "won", summary: "Done." }]))).toEqual(["invalid-value"])
  })
  it("a result that is not valid feather.ir/1, reported under /result", () => {
    expect(paths(open, update(1, [{ op: "patch", id: "work", set: { value: 2 } }]))).toEqual(["/result/nodes/0/value"])
    expect(codes(open, update(1, [{ op: "remove", id: "work" }]))).toEqual(["empty-experience"])
  })
  it("lands every op or none", () => {
    const result = applyUpdate(open, update(1, [{ op: "patch", id: "work", set: { value: 0.9 } }, { op: "remove", id: "nope" }]))
    expect(result.ok).toBe(false)
    expect(open.nodes[0]).not.toHaveProperty("value")
  })
})

describe("validate: the resolution", () => {
  const resolved = (resolution: unknown, nodes: unknown[] = []) => validate({ ir: "feather.ir/1", experience: "x", revision: 2, resolved: resolution, nodes })
  const issueCodes = (r: ReturnType<typeof validate>) => (r.ok ? [] : r.issues.map((i) => `${i.code} ${i.path}`))
  it("accepts a resolved experience with no nodes", () => {
    expect(resolved({ outcome: "failed", summary: "The card was declined." }).ok).toBe(true)
  })
  it("still needs nodes while open", () => {
    expect(issueCodes(validate({ ir: "feather.ir/1", experience: "x", nodes: [] }))).toEqual(["empty-experience /nodes"])
  })
  it("checks the outcome, the summary, the artifact and the revision", () => {
    expect(issueCodes(resolved({ outcome: "done", summary: "x".repeat(121) }))).toEqual(["too-long /resolved/summary"])
    expect(issueCodes(resolved({ outcome: "done", summary: " " }))).toEqual(["empty-text /resolved/summary"])
    expect(issueCodes(resolved({ outcome: "done", summary: "Done.", artifact: { href: "https://x.y" } }))).toEqual(["missing-field /resolved/artifact/label"])
    expect(issueCodes(resolved({ outcome: "done", summary: "Done.", artifact: { label: "File", kind: "zip" } }))).toEqual(["invalid-value /resolved/artifact/kind"])
    expect(issueCodes(resolved({ outcome: "done", summary: "Done.", note: "x" }))).toEqual(["unknown-field /resolved/note"])
    expect(issueCodes(validate({ ir: "feather.ir/1", experience: "x", revision: -1, nodes: [{ type: "Text", id: "t", text: "Hi." }] }))).toEqual(["invalid-value /revision"])
  })
})

describe("the freeze (feather.ir/1)", () => {
  it("reads feather.ir/0 and feather.update/0 as their earlier names, unchanged", () => {
    const legacy = { ...open, ir: "feather.ir/0" } as Experience
    expect(validate(legacy).ok).toBe(true)
    const e = apply(legacy, { ...update(1, [{ op: "patch", id: "work", set: { value: 0.2 } }]), update: "feather.update/0" })
    expect(e.ir).toBe("feather.ir/0")
  })
  it("refuses a version it does not know", () => {
    expect(validate({ ...open, ir: "feather.ir/2" }).ok).toBe(false)
    expect(codes(open, { ...update(1, [{ op: "remove", id: "work" }]), update: "feather.update/2" })).toEqual(["unsupported-version"])
  })
})
