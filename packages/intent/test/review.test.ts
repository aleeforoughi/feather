import { describe, expect, it } from "vitest"
import { MAX_ISSUES, validate, validateReply, type Experience } from "../src/index.ts"

// Regression tests for the adversarial review of feather.ir/1 (bugs B1–B11, drift D1, design X1–X8).
const doc = (...nodes: unknown[]) => ({ ir: "feather.ir/1", experience: "e", nodes })
const issues = (input: unknown) => {
  const r = validate(input)
  return r.ok ? [] : r.issues.map((i) => `${i.code} ${i.path}`)
}
const text = { type: "Text", id: "t", text: "Hello." }

describe("hostile input (B1–B3)", () => {
  it.each(["constructor", "toString", "hasOwnProperty", "valueOf", "__proto__"])("never mistakes %s for a node type", (type) => {
    expect(() => validate(doc({ type, id: "a" }))).not.toThrow()
    expect(issues(doc({ type, id: "a" }))).toEqual(["unknown-node-type /nodes/0/type"])
  })
  it("rejects fields named after Object.prototype members, nested ones too", () => {
    expect(issues(doc({ ...text, constructor: "x", toString: 5 }))).toEqual(["unknown-field /nodes/0/constructor", "unknown-field /nodes/0/toString"])
    expect(issues(JSON.parse('{"ir":"feather.ir/1","experience":"e","nodes":[{"type":"Text","id":"t","text":"x","__proto__":{"color":"red"}}]}'))).toEqual(["unknown-field /nodes/0/__proto__"])
    const choice = { type: "Choice", id: "c", intent: "pick", prompt: "?", options: [{ id: "a", label: "A", valueOf: 1 }, { id: "b", label: "B" }] as unknown[] }
    expect(issues(doc(choice))).toEqual(["unknown-field /nodes/0/options/0/valueOf"])
  })
  it("stays fast and bounded on huge or numerous mistakes", () => {
    const start = performance.now()
    expect(issues(doc({ ...text, ["k".repeat(3_000_000)]: 1 }))).toHaveLength(1)
    const many = Object.fromEntries(Array.from({ length: 20_000 }, (_, i) => [`unknown_field_number_${i}`, i]))
    const result = validate(doc({ ...text, ...many }))
    expect(result.ok ? 0 : result.issues.length).toBe(MAX_ISSUES + 1)
    expect(result.ok ? undefined : result.issues.at(-1)?.code).toBe("too-many-issues")
    expect(performance.now() - start).toBeLessThan(2000)
  })
  it("caps text it was not given a limit for", () => {
    expect(issues(doc({ ...text, text: "x".repeat(4001) }))).toEqual(["too-long /nodes/0/text"])
    expect(issues(doc({ ...text, text: "😀".repeat(4000) }))).toEqual([])
  })
})

describe("dates are read the same everywhere (B4, B8)", () => {
  it("never compares a zoned time with a wall-clock one", () => {
    expect(issues(doc({ type: "Date", id: "d", value: "2026-10-03T10:00:00+04:00", until: "2026-10-03T09:00" }))).toEqual([])
    expect(issues(doc({ type: "Date", id: "d", value: "2026-10-03T10:00:00+04:00", until: "2026-10-03T09:00:00+04:00" }))).toEqual(["out-of-range /nodes/0/until"])
    expect(issues(doc({ type: "Date", id: "d", value: "2026-10-03T10:00:00+04:00", until: "2026-10-03T07:00:00Z" }))).toEqual([])
  })
  it("accepts every real calendar day and rejects impossible ones", () => {
    expect(issues(doc({ type: "Date", id: "d", value: "0050-01-01" }))).toEqual([])
    expect(issues(doc({ type: "Date", id: "d", value: "2028-02-29" }))).toEqual([])
    for (const value of ["2026-02-29", "2026-13-01", "2026-02-03T24:00", "2026-02-03T10:00+25:00"]) expect(issues(doc({ type: "Date", id: "d", value }))).toEqual(["invalid-date /nodes/0/value"])
  })
})

describe("every node gets every check (B5, B9)", () => {
  it("checks a node whose id is missing, malformed or taken", () => {
    const dup = { type: "Choice", intent: "pick", prompt: "?", options: [{ id: "a", label: "A" }, { id: "a", label: "B" }] }
    expect(issues(doc(dup))).toEqual(["missing-field /nodes/0/id", "duplicate-option /nodes/0/options/1/id"])
    expect(issues(doc({ type: "Media", id: "1m", kind: "image", src: "x" }))).toEqual(["invalid-id /nodes/0/id", "missing-text-equivalent /nodes/0/alt"])
    const go = { type: "IrreversibleAction", id: "go", intent: "send", consequence: { statement: "Sends it." } }
    expect(issues(doc(go, { ...go, reversible: true }))).toEqual(["duplicate-id /nodes/1/id", "irreversible-marked-reversible /nodes/1/reversible"])
    const act = { type: "Action", id: "a", intent: "do", primary: true }
    expect(issues(doc(act, act))).toEqual(["duplicate-id /nodes/1/id", "multiple-primary /nodes/1/primary"])
  })
  it("resolves references to a node whose id is malformed instead of calling them dangling", () => {
    expect(issues(doc({ type: "Location", id: "1home", name: "Home" }, { type: "Correction", id: "fix", intent: "fix it", target: "1home", prompt: "Where?" }))).toEqual(["invalid-id /nodes/0/id"])
  })
  it("reports every missing text equivalent at once", () => {
    expect(issues(doc({ type: "Media", id: "v", kind: "video", src: "x" }))).toEqual(["missing-text-equivalent /nodes/0/alt", "missing-text-equivalent /nodes/0/captions"])
  })
})

describe("paths and lists (B6, B7)", () => {
  it("escapes keys inside JSON Pointers", () => {
    const a = { type: "Alternative", id: "a", intent: "a" }
    const b = { type: "Alternative", id: "b", intent: "b" }
    expect(issues(doc(a, b, { type: "Comparison", id: "c", items: ["a", "b"], criteria: [{ label: "P", values: { a: 1, b: 2, "x/y~z": {} } }] }))).toEqual([
      "wrong-type /nodes/2/criteria/0/values/x~1y~0z",
      "comparison-mismatch /nodes/2/criteria/0/values",
    ])
    expect(issues(doc({ ...text, expandable: { why: "w", "a/b": 1 } }))).toEqual(["unknown-field /nodes/0/expandable/a~1b"])
  })
  it("compares each item once", () => {
    const a = { type: "Alternative", id: "a", intent: "a" }
    expect(issues(doc(a, { type: "Comparison", id: "c", items: ["a", "a"], criteria: [{ label: "P", values: { a: 1 } }] }))).toEqual(["duplicate-item /nodes/1/items/1"])
  })
})

describe("the contract's design (X1–X8)", () => {
  const rec = { type: "Recommendation", id: "rec", intent: "take the offer", summary: "Take it.", reversible: false }
  const go = { type: "IrreversibleAction", id: "go", intent: "pay", consequence: { spend: { amount: 10, currency: "USD" } } }
  it("links an irreversible act to the IrreversibleAction that confirms it (X2)", () => {
    expect(issues(doc(rec, go))).toEqual([])
    expect(issues(doc(rec, go, { ...go, id: "go2" }))).toEqual(["irreversible-without-consequence /nodes/0/reversible"])
    expect(issues(doc(rec, { ...go, confirms: "rec" }, { ...go, id: "go2" }))).toEqual([])
    expect(issues(doc({ ...rec, reversible: true }, { ...go, confirms: "rec" }))).toEqual(["unneeded-confirmation /nodes/1/confirms"])
    const approval = { type: "Approval", id: "ok", intent: "approve", request: "Approve?", reversible: false }
    expect(issues(doc(approval, { ...go, consequence: { statement: "harmless" } }, { ...go, id: "go2", confirms: "rec2" }, { ...rec, id: "rec2" }))).toEqual(["irreversible-without-consequence /nodes/0/reversible"])
  })
  it("keeps an IrreversibleAction at high or critical importance (X3)", () => {
    expect(issues(doc({ ...go, importance: "low" }))).toEqual(["invalid-value /nodes/0/importance"])
    expect(issues(doc({ ...go, importance: "high" }))).toEqual([])
  })
  it("types references and keeps alternatives after what they are alternatives to (X5)", () => {
    const alt = { type: "Alternative", id: "alt", intent: "something else", for: "rec" }
    expect(issues(doc(rec, go, alt))).toEqual([])
    expect(issues(doc(alt, rec, go))).toEqual(["out-of-order /nodes/0/for"])
    expect(issues(doc(text, { ...alt, for: "t" }))).toEqual(["wrong-reference-type /nodes/1/for"])
    const r1 = { type: "Recommendation", id: "r1", intent: "a", summary: "A" }
    const r2 = { type: "Recommendation", id: "r2", intent: "b", summary: "B" }
    expect(issues(doc(r1, r2, { type: "Alternative", id: "x", intent: "neither" }))).toEqual(["ambiguous-alternative /nodes/2/for"])
  })
  it("decides preselection once (X6)", () => {
    const choice = { type: "Choice", id: "c", intent: "pick", prompt: "?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }
    const p = { type: "PredictedChoice", id: "p", intent: "likely", of: "c", option: "a" }
    expect(issues(doc(choice, p, { ...p, id: "p2", option: "b" }))).toEqual(["conflicting-prediction /nodes/2/of"])
    expect(issues(doc({ ...choice, selected: ["b"] }, p))).toEqual(["conflicting-prediction /nodes/1/option"])
    expect(issues(doc({ ...choice, selected: ["a"] }, p))).toEqual([])
  })
  it("holds option and step ids to the id pattern (X7)", () => {
    const choice = { type: "Choice", id: "c", intent: "pick", prompt: "?", options: [{ id: "has space", label: "A" }, { id: "b", label: "B" }] }
    expect(issues(doc(choice))).toEqual(["invalid-id /nodes/0/options/0/id"])
  })
  it('treats "primary": false as saying nothing (X8)', () => {
    expect(issues(doc({ ...text, primary: false }))).toEqual([])
  })
})

describe("replies (B10, B11, X7)", () => {
  const exp = (...nodes: unknown[]) => doc(...nodes) as unknown as Experience
  const codes = (e: Experience, reply: unknown) => {
    const r = validateReply(e, reply)
    return r.ok ? [] : r.issues.map((i) => i.code)
  }
  const send = (node: string, act: string, value?: unknown) => ({ experience: "e", node, act, ...(value === undefined ? {} : { value }) })

  it("never throws on a malformed experience", () => {
    for (const e of [{ experience: "e" }, doc({ type: "constructor", id: "a" }), doc({ type: "Choice", id: "c", intent: "x", prompt: "?" }), null]) {
      expect(() => validateReply(e as unknown as Experience, send("a", "x"))).not.toThrow()
      expect(codes(e as unknown as Experience, send("a", "x"))).toEqual(["invalid-experience"])
    }
  })
  it("checks Input answers by kind", () => {
    const n = { type: "Input", id: "n", intent: "count", prompt: "How many?", kind: "number", min: 1, max: 10, required: true }
    const m = { type: "Input", id: "m", intent: "budget", prompt: "How much?", kind: "money", currency: "AED" }
    const mail = { type: "Input", id: "mail", intent: "email", prompt: "Email?", kind: "email", maxLength: 20 }
    const when = { type: "Input", id: "when", intent: "date", prompt: "When?", kind: "date" }
    const e = exp(n, m, mail, when)
    expect(codes(e, send("n", "submit", 5))).toEqual([])
    for (const v of [999, "abc", { evil: 1 }, 0]) expect(codes(e, send("n", "submit", v))).toEqual(["invalid-value"])
    expect(codes(e, send("m", "submit", 800))).toEqual([])
    expect(codes(e, send("m", "submit", "800 AED"))).toEqual(["invalid-value"])
    expect(codes(e, send("mail", "submit", "a@b.co"))).toEqual([])
    expect(codes(e, send("mail", "submit", "not an email"))).toEqual(["invalid-value"])
    expect(codes(e, send("mail", "submit", "someone.long@example.com"))).toEqual(["invalid-value"])
    expect(codes(e, send("when", "submit", "2026-10-03"))).toEqual([])
    expect(codes(e, send("when", "submit", "tomorrow"))).toEqual(["invalid-value"])
    expect(codes(e, send("m", "skip"))).toEqual([])
    expect(codes(e, send("n", "skip"))).toEqual(["unknown-act"])
  })
  it("checks the other values", () => {
    const c = { type: "Choice", id: "c", intent: "pick", prompt: "?", multiple: true, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }
    const p = { type: "PredictedChoice", id: "p", intent: "likely", of: "c", option: "a" }
    const own = { type: "Alternative", id: "own", intent: "own budget", input: "Price" }
    const pref = { type: "Preference", id: "pref", intent: "units", key: "units", label: "Units", value: "metric" }
    const appr = { type: "Approval", id: "appr", intent: "approve", request: "OK?" }
    const more = { type: "ExploreMore", id: "more", intent: "learn more", topics: ["pricing", "privacy"] }
    const e = exp(c, p, own, pref, appr, more)
    expect(codes(e, send("c", "choose", []))).toEqual(["invalid-value"])
    expect(codes(e, send("c", "choose", ["a", "a"]))).toEqual(["invalid-value"])
    expect(codes(e, send("p", "change", "a"))).toEqual(["invalid-value"])
    expect(codes(e, send("own", "choose", { amount: 500, currency: "AED" }))).toEqual([])
    expect(codes(e, send("own", "choose", "lots"))).toEqual(["invalid-value"])
    expect(codes(e, send("pref", "set", "imperial"))).toEqual([])
    expect(codes(e, send("pref", "set", { a: 1 }))).toEqual(["invalid-value"])
    expect(codes(e, send("pref", "set", Number.NaN))).toEqual(["invalid-value"])
    expect(codes(e, send("appr", "reject", "Too expensive"))).toEqual([])
    expect(codes(e, send("appr", "reject", [1, 2]))).toEqual(["invalid-value"])
    expect(codes(e, send("more", "expand", "pricing"))).toEqual([])
    expect(codes(e, send("more", "expand", "weather"))).toEqual(["invalid-value"])
    expect(codes(e, { ...send("appr", "approve"), color: "red" })).toEqual(["unknown-field"])
  })
})

describe("composer review (L3)", () => {
  it("reports an unreadable document instead of throwing", () => {
    const circular: Record<string, unknown> = { ir: "feather.ir/1", nodes: [] }
    circular.experience = circular
    for (const input of [{ ir: "feather.ir/1", experience: 1n, nodes: [] }, circular, Object.defineProperty({ ir: "feather.ir/1", experience: "e" }, "nodes", { get: () => { throw new Error("boom") }, enumerable: true })]) {
      expect(() => validate(input)).not.toThrow()
      const r = validate(input)
      expect(r.ok).toBe(false)
    }
    const r = validate(Object.defineProperty({ ir: "feather.ir/1", experience: "e" }, "nodes", { get: () => { throw new Error("boom") }, enumerable: true }))
    expect(r.ok ? [] : r.issues.map((i) => i.code)).toEqual(["unreadable"])
  })
  it("treats an act that states a consequence as irreversible", () => {
    const approval = { type: "Approval", id: "ok", intent: "grant access", request: "Share your data?", consequence: { consent: { to: "Acme", scope: "purchase history" } } }
    expect(issues(doc(approval))).toEqual([])
    expect(issues(doc({ ...approval, reversible: true }))).toEqual(["irreversible-marked-reversible /nodes/0/reversible"])
  })
  it("stays fast on a large experience", () => {
    const nodes = Array.from({ length: 500 }, (_, i) => (i % 2 === 0 ? { type: "Choice", id: `c${i}`, intent: "pick", prompt: "?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] } : { type: "PredictedChoice", id: `p${i}`, intent: "likely", of: `c${i - 1}`, option: "a" }))
    validate(doc(...nodes))
    // The fastest of 10 runs: the validator's own cost, not whatever else the machine is doing (a quadratic
    // validator takes hundreds of milliseconds here, so the budget still catches one).
    let fastest = Infinity
    for (let i = 0; i < 10; i++) {
      const start = performance.now()
      validate(doc(...nodes))
      fastest = Math.min(fastest, performance.now() - start)
    }
    expect(fastest).toBeLessThan(20)
  })
  it("lets an IrreversibleAction confirm an act made irreversible by its consequence", () => {
    const r = validate({ ir: "feather.ir/1", experience: "e", nodes: [
      { type: "Approval", id: "ok", intent: "approve", request: "Share your calendar?", consequence: { consent: { to: "Acme", scope: "your calendar" } } },
      { type: "IrreversibleAction", id: "go", intent: "confirm sharing", consequence: { consent: { to: "Acme", scope: "your calendar" } }, confirms: "ok" },
    ] })
    expect(r.ok).toBe(true)
  })
})
