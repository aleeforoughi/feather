import { describe, expect, it } from "vitest"
import { actsFor, validate, validateReply, type Experience } from "../src/index.ts"

const result = validate({
  ir: "feather.ir/0",
  experience: "pick_plan",
  nodes: [
    { type: "Choice", id: "plan", intent: "pick a plan", prompt: "Which plan?", options: [{ id: "basic", label: "Basic" }, { id: "pro", label: "Pro" }] },
    { type: "Choice", id: "addons", intent: "pick add-ons", prompt: "Add-ons?", multiple: true, options: [{ id: "sso", label: "SSO" }, { id: "audit", label: "Audit log" }] },
    { type: "PredictedChoice", id: "guess", intent: "likely plan", of: "plan", option: "pro" },
    { type: "IrreversibleAction", id: "buy", intent: "buy the plan", consequence: { spend: { amount: 49, currency: "USD" } } },
    { type: "Alternative", id: "own", intent: "set my own budget", input: "Price" },
    { type: "Warning", id: "note", text: "Prices exclude tax." },
    { type: "Warning", id: "ack", text: "This cannot be refunded.", acknowledge: true },
    { type: "Preference", id: "billing", intent: "billing cycle", key: "cycle", label: "Billing", value: "monthly", options: ["monthly", "yearly"] },
    { type: "Text", id: "hello", text: "Hi." },
  ],
})
if (!result.ok) throw new Error("fixture invalid")
const exp: Experience = result.experience
const reply = (node: string, act: string, value?: unknown) => validateReply(exp, { experience: "pick_plan", node, act, ...(value === undefined ? {} : { value }) })
const codes = (r: ReturnType<typeof reply>) => (r.ok ? [] : r.issues.map((i) => i.code))

describe("validateReply", () => {
  it("accepts the acts each node takes", () => {
    expect(reply("buy", "confirm").ok).toBe(true)
    expect(reply("buy", "cancel").ok).toBe(true)
    expect(reply("plan", "choose", "pro").ok).toBe(true)
    expect(reply("addons", "choose", ["sso", "audit"]).ok).toBe(true)
    expect(reply("guess", "accept").ok).toBe(true)
    expect(reply("guess", "change", "basic").ok).toBe(true)
    expect(reply("own", "choose", 300).ok).toBe(true)
    expect(reply("ack", "acknowledge").ok).toBe(true)
    expect(reply("billing", "set", "yearly").ok).toBe(true)
  })

  it("rejects what does not fit", () => {
    expect(codes(validateReply(exp, { experience: "other", node: "buy", act: "confirm" }))).toEqual(["wrong-experience"])
    expect(codes(reply("nope", "confirm"))).toEqual(["unknown-node"])
    expect(codes(reply("buy", "approve"))).toEqual(["unknown-act"])
    expect(codes(reply("hello", "activate"))).toEqual(["unknown-act"])
    expect(codes(reply("note", "acknowledge"))).toEqual(["unknown-act"])
    expect(codes(reply("buy", "confirm", true))).toEqual(["unexpected-value"])
    expect(codes(reply("plan", "choose"))).toEqual(["missing-value"])
    expect(codes(reply("plan", "choose", "gold"))).toEqual(["invalid-value"])
    expect(codes(reply("plan", "choose", ["pro"]))).toEqual(["invalid-value"])
    expect(codes(reply("addons", "choose", "sso"))).toEqual(["invalid-value"])
    expect(codes(reply("guess", "change", "gold"))).toEqual(["invalid-value"])
    expect(codes(reply("own", "choose"))).toEqual(["missing-value"])
    expect(codes(reply("billing", "set", "weekly"))).toEqual(["invalid-value"])
    expect(codes(validateReply(exp, null))).toEqual(["not-an-object"])
  })

  it("lists a node's acts", () => {
    const node = (id: string) => exp.nodes.find((n) => n.id === id)!
    expect(actsFor(node("buy"))).toEqual(["confirm", "cancel"])
    expect(actsFor(node("note"))).toEqual([])
    expect(actsFor(node("ack"))).toEqual(["acknowledge"])
    expect(actsFor(node("hello"))).toEqual([])
  })
})
