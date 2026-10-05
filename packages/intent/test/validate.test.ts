import { describe, expect, it } from "vitest"
import { formatIssues, validate, type IssueCode } from "../src/index.ts"

// The rules, one at a time, on a small valid experience. The conformance fixtures exercise them on realistic ones.
const base = () => ({
  ir: "feather.ir/1",
  experience: "approve_campaign",
  nodes: [
    { type: "Recommendation", id: "rec", intent: "launch the recommended test", importance: "high", reversible: false, summary: "Recommended test: 7 days, purchase objective", expandable: { why: "Enough to test three creative directions without overspending." } },
    { type: "Price", id: "cap", amount: 1050, currency: "AED", label: "Maximum spend" },
    { type: "IrreversibleAction", id: "go", intent: "confirm spend", importance: "critical", reversible: false, consequence: { spend: { amount: 1050, currency: "AED" } } },
    { type: "Alternative", id: "less", intent: "spend less" },
    { type: "Alternative", id: "own", intent: "set my own budget", input: "Price" },
  ] as Record<string, unknown>[],
})

function issues(change: (doc: ReturnType<typeof base>) => void) {
  const doc = base()
  change(doc)
  const result = validate(doc)
  return result.ok ? [] : result.issues.map((i) => `${i.code} ${i.path}`)
}
const only = (code: IssueCode, path: string) => [`${code} ${path}`]

describe("validate", () => {
  it("accepts the campaign example from docs/PLAN.md", () => {
    const result = validate(base())
    expect(result.ok).toBe(true)
  })

  it("never throws, whatever it is given", () => {
    for (const input of [null, undefined, 42, "x", [], { nodes: "x" }, { ir: "feather.ir/1", experience: "e", nodes: [null, 3, { type: 1 }] }]) {
      expect(() => validate(input)).not.toThrow()
      expect(validate(input).ok).toBe(false)
    }
  })

  it.each<[string, (d: ReturnType<typeof base>) => void, string[]]>([
    ["a newer IR", (d) => void (d.ir = "feather.ir/2"), only("unsupported-version", "/ir")],
    ["no nodes", (d) => void (d.nodes = []), only("empty-experience", "/nodes")],
    ["a bad experience name", (d) => void (d.experience = "approve campaign"), only("invalid-id", "/experience")],
    ["an unknown top-level field", (d) => void ((d as Record<string, unknown>).nodez = []), only("unknown-field", "/nodez")],
    ["a misspelled type", (d) => void (d.nodes[1].type = "Prise"), only("unknown-node-type", "/nodes/1/type")],
    ["a color", (d) => void (d.nodes[3].color = "red"), only("presentational-field", "/nodes/3/color")],
    ["a component name", (d) => void (d.nodes[0].component = "Card"), only("presentational-field", "/nodes/0/component")],
    ["a missing intent on an act", (d) => void delete d.nodes[3].intent, only("missing-field", "/nodes/3/intent")],
    ["a duplicate id", (d) => void (d.nodes[4].id = "less"), only("duplicate-id", "/nodes/4/id")],
    ["a bad id", (d) => void (d.nodes[1].id = "1cap"), only("invalid-id", "/nodes/1/id")],
    ["two primary acts", (d) => { d.nodes[0].primary = true; d.nodes[2].primary = true }, only("multiple-primary", "/nodes/2/primary")],
    ["a primary Alternative", (d) => void (d.nodes[3].primary = true), only("not-primary-capable", "/nodes/3/primary")],
    ["a primary Alternative beside a primary act", (d) => { d.nodes[2].primary = true; d.nodes[3].primary = true }, only("not-primary-capable", "/nodes/3/primary")],
    ["an IrreversibleAction without consequence", (d) => void delete d.nodes[2].consequence, only("irreversible-without-consequence", "/nodes/2/consequence")],
    ["an empty consequence", (d) => void (d.nodes[2].consequence = {}), only("empty-consequence", "/nodes/2/consequence")],
    ["a reversible IrreversibleAction", (d) => void (d.nodes[2].reversible = true), only("irreversible-marked-reversible", "/nodes/2/reversible")],
    ["an irreversible act with nothing stating its consequence", (d) => void d.nodes.splice(2, 1), only("irreversible-without-consequence", "/nodes/0/reversible")],
    ["a lowercase currency", (d) => void (d.nodes[1].currency = "aed"), only("invalid-currency", "/nodes/1/currency")],
    ["a negative amount", (d) => void (d.nodes[1].amount = -5), only("out-of-range", "/nodes/1/amount")],
    ["a string amount", (d) => void (d.nodes[1].amount = "1050"), only("wrong-type", "/nodes/1/amount")],
    ["an unknown importance", (d) => void (d.nodes[0].importance = "urgent"), only("invalid-value", "/nodes/0/importance")],
    ["an empty expandable", (d) => void (d.nodes[0].expandable = {}), only("empty-expandable", "/nodes/0/expandable")],
    ["an empty summary", (d) => void (d.nodes[0].summary = "  "), only("empty-text", "/nodes/0/summary")],
    ["a dangling reference", (d) => void (d.nodes[3].for = "nope"), only("dangling-reference", "/nodes/3/for")],
    ["a self-reference", (d) => void (d.nodes[3].for = "less"), only("self-reference", "/nodes/3/for")],
    ["an unknown Alternative input", (d) => void (d.nodes[4].input = "Slider"), only("invalid-value", "/nodes/4/input")],
  ])("rejects %s", (_, change, expected) => expect(issues(change)).toEqual(expected))

  it("reports every problem at once", () => {
    expect(issues((d) => { d.nodes[1].currency = "aed"; d.nodes[3].color = "red"; delete d.nodes[2].consequence })).toHaveLength(3)
  })

  it("checks node-specific rules", () => {
    const doc = (...nodes: Record<string, unknown>[]) => ({ ir: "feather.ir/1", experience: "e", nodes })
    const codes = (d: unknown) => {
      const r = validate(d)
      return r.ok ? [] : r.issues.map((i) => i.code)
    }
    const choice = { type: "Choice", id: "c", intent: "pick", prompt: "Which?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }
    expect(codes(doc({ ...choice, options: [{ id: "a", label: "A" }] }))).toEqual(["too-few-items"])
    expect(codes(doc({ ...choice, options: [{ id: "a", label: "A" }, { id: "a", label: "B" }] }))).toEqual(["duplicate-option"])
    expect(codes(doc({ ...choice, selected: ["z"] }))).toEqual(["unknown-option"])
    expect(codes(doc({ ...choice, selected: ["a", "b"] }))).toEqual(["too-many-selected"])
    expect(codes(doc({ ...choice, multiple: true, selected: ["a", "b"] }))).toEqual([])
    expect(codes(doc(choice, { type: "PredictedChoice", id: "p", intent: "likely", of: "c", option: "z" }))).toEqual(["unknown-option"])
    expect(codes(doc(choice, { type: "Text", id: "t", text: "hi" }, { type: "PredictedChoice", id: "p", intent: "likely", of: "t", option: "a" }))).toEqual(["wrong-reference-type"])
    expect(codes(doc({ type: "Media", id: "m", kind: "image", src: "https://x/y.png" }))).toEqual(["missing-text-equivalent"])
    expect(codes(doc({ type: "Media", id: "m", kind: "audio", src: "https://x/y.mp3" }))).toEqual(["missing-text-equivalent"])
    expect(codes(doc({ type: "Media", id: "m", kind: "video", src: "https://x/y.mp4", alt: "A demo" }))).toEqual(["missing-text-equivalent"])
    expect(codes(doc({ type: "Media", id: "m", kind: "video", src: "https://x/y.mp4", alt: "A demo", captions: "https://x/y.vtt" }))).toEqual([])
    expect(codes(doc({ type: "Date", id: "d", value: "2026-02-30" }))).toEqual(["invalid-date"])
    expect(codes(doc({ type: "Date", id: "d", value: "2026-10-05", until: "2026-10-03" }))).toEqual(["out-of-range"])
    expect(codes(doc({ type: "Date", id: "d", value: "2026-10-03T14:00:00+04:00" }))).toEqual([])
    expect(codes(doc({ type: "Input", id: "i", intent: "budget", prompt: "How much?", kind: "money" }))).toEqual(["missing-field"])
    expect(codes(doc({ type: "Input", id: "i", intent: "count", prompt: "How many?", kind: "number", min: 10, max: 1 }))).toEqual(["out-of-range"])
    expect(codes(doc({ type: "Progress", id: "p", label: "Upload", value: 1.5 }))).toEqual(["out-of-range"])
    expect(codes(doc({ type: "Progress", id: "p", label: "Plan", steps: [{ id: "s", label: "A", state: "done" }, { id: "s", label: "B", state: "active" }] }))).toEqual(["duplicate-step"])
    expect(codes(doc({ type: "Tradeoff", id: "t", summary: "Hmm" }))).toEqual(["empty-tradeoff"])
    expect(codes(doc({ type: "Preference", id: "p", intent: "units", key: "units", label: "Units", value: "feet", options: ["metric", "imperial"] }))).toEqual(["unknown-option"])
    const a = { type: "Alternative", id: "a", intent: "plan a" }
    const b = { type: "Alternative", id: "b", intent: "plan b" }
    expect(codes(doc(a, b, { type: "Comparison", id: "cmp", items: ["a", "b"], criteria: [{ label: "Price", values: { a: 10 } }] }))).toEqual(["comparison-mismatch"])
    expect(codes(doc(a, b, { type: "Comparison", id: "cmp", items: ["a", "b"], criteria: [{ label: "Price", values: { a: 10, b: 12 } }] }))).toEqual([])
    expect(codes(doc({ type: "Warning", id: "w", text: "Careful", acknowledge: "yes" }))).toEqual(["wrong-type"])
  })

  it("says what to change, in a sentence", () => {
    const result = validate({ ...base(), nodes: [{ type: "IrreversibleAction", id: "go", intent: "send it" }] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(formatIssues(result.issues)).toBe(
        '- /nodes/0/consequence: IrreversibleAction "go" cannot be undone, so it must state its consequence exactly (spend, publish, send, consent, delete or a statement). Principle 6: irreversible means explicit. [irreversible-without-consequence]'
      )
      expect(result.issues[0].node).toBe("go")
    }
  })

  it("suggests the name a typo meant", () => {
    const r = validate({ ...base(), nodes: [{ type: "Recomendation", id: "r", intent: "x", summary: "y" }, { type: "Text", id: "t", txt: "hi" }] })
    expect(r.ok ? [] : r.issues.map((i) => i.message)).toEqual([
      '"Recomendation" is not a feather.ir/1 node type; did you mean Recommendation?',
      'Text "t" has no field "txt"; did you mean "text"?',
      'Text "t" needs "text": the words.',
    ])
  })
})
