import { describe, expect, it } from "vitest"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { RULES, compose, type LayoutPlan, type PlanNode, type RuleId } from "../src/index.ts"

// Every composer rule, proven on small experiences. `rule()` records which rules have tests; the last test fails if a
// rule in RULES has none (L3 exit: each composer rule has a test).
const tested = new Set<RuleId>()
const rule = (id: RuleId, fn: () => void) => {
  tested.add(id)
  describe(id, fn)
}

const doc = (...nodes: unknown[]) => ({ ir: "feather.ir/0", experience: "e", nodes })
function plan(experience: unknown, context: RenderContext = {}): LayoutPlan {
  const result = compose(experience, context)
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.plan
}
const all = (p: LayoutPlan): PlanNode[] => p.regions.flatMap((r) => r.nodes.flatMap((n) => [n, ...(n.items ?? []), ...(n.attached ?? []), ...(n.items ?? []).flatMap((i) => i.attached ?? [])]))
const find = (p: LayoutPlan, id: string) => all(p).find((n) => n.id === id)!
const decided = (p: LayoutPlan, subject: string) => p.trace.find((t) => t.subject === subject)!

const rec = { type: "Recommendation", id: "rec", intent: "launch the test", summary: "7 days, purchase objective", expandable: { why: "Enough to test three directions." } }
const spend = { type: "IrreversibleAction", id: "go", intent: "confirm spend", consequence: { spend: { amount: 1050, currency: "AED" } } }
const alt = { type: "Alternative", id: "less", intent: "spend less", for: "rec" }
const text = { type: "Text", id: "t", text: "Your order is on its way." }
const choice = { type: "Choice", id: "c", intent: "pick a size", prompt: "Which size?", options: [{ id: "s", label: "Small" }, { id: "m", label: "Medium" }] }

rule("one-primary", () => {
  it("takes the node the caller marks", () => {
    const p = plan(doc({ ...rec, primary: true }, spend))
    expect(p.primary).toBe("rec")
    expect(decided(p, "plan.primary").because).toContain("marked")
    expect(find(p, "rec").emphasis).toBe("primary")
  })
  it("otherwise infers the act that most needs the person, IrreversibleAction first", () => {
    expect(plan(doc(rec, spend)).primary).toBe("go")
    expect(plan(doc(choice, rec)).primary).toBe("rec")
    expect(plan(doc(text, choice)).primary).toBe("c")
    expect(decided(plan(doc(rec, spend)), "plan.primary").because).toContain("none marked")
  })
  it("has none when there is no act", () => {
    expect(plan(doc(text)).primary).toBeNull()
  })
})

rule("irreversible-explicit", () => {
  it("never puts the default focus on an irreversible act", () => {
    const p = plan(doc(rec, spend))
    expect(p.focus).toBeNull()
    expect(decided(p, "plan.focus").rule).toBe("irreversible-explicit")
  })
  it("confirms by two deliberate acts on screen, a spoken keyword by voice, a typed one in text", () => {
    expect(find(plan(doc(spend)), "go").confirm).toBe("confirm")
    expect(find(plan(doc(spend), { capability: { output: { visual: "unavailable" } } }), "go").confirm).toBe("spoken-keyword")
    expect(find(plan(doc(spend), { device: { surface: "terminal" } }), "go").confirm).toBe("typed-keyword")
  })
  it("gives a confirm mode to an irreversible act with its own consequence, not to one its IrreversibleAction commits", () => {
    const own = { ...rec, reversible: false, consequence: { statement: "Starts the campaign." } }
    expect(find(plan(doc(own)), "rec").confirm).toBe("confirm")
    expect(find(plan(doc({ ...rec, reversible: false }, spend)), "rec").confirm).toBeUndefined()
  })
  it("never preselects an irreversible choice", () => {
    const p = plan(doc({ ...choice, reversible: false, selected: ["m"] }, { ...spend, confirms: "c" }))
    expect(find(p, "c").preselected).toBeUndefined()
    expect(decided(p, "node c.preselected").rule).toBe("irreversible-explicit")
  })
})

rule("recommendation-first", () => {
  it("puts the alternatives after the recommendation, as one list", () => {
    const p = plan(doc(rec, alt, { ...alt, id: "own", intent: "set my own budget", input: "Price" }))
    expect(p.regions[0].nodes.map((n) => n.id)).toEqual(["rec"])
    expect(p.regions[1].nodes).toHaveLength(1)
    expect(p.regions[1].nodes[0]).toMatchObject({ id: "~alternatives", organism: "AlternativeList" })
    expect(p.regions[1].nodes[0].items!.map((n) => n.id)).toEqual(["less", "own"])
  })
  it("preselects the predicted option, or the caller's selection", () => {
    expect(find(plan(doc(choice, { type: "PredictedChoice", id: "p", intent: "likely", of: "c", option: "m" })), "c").preselected).toBe("m")
    expect(find(plan(doc({ ...choice, selected: ["s"] })), "c").preselected).toBe("s")
    expect(find(plan(doc(choice)), "c").preselected).toBeUndefined()
  })
  it("starts focus on a reversible primary act", () => {
    expect(plan(doc(rec, alt)).focus).toBe("rec")
  })
})

rule("critical-never-hidden", () => {
  it("opens a critical node's detail, even for a brief persona", () => {
    const p = plan(doc({ ...rec, importance: "critical" }), { persona: { explanation: "brief" } })
    expect(find(p, "rec").expanded).toBe(true)
    expect(find(p, "rec").emphasis).toBe("critical")
    const t = decided(p, "node rec.expanded")
    expect(t.rule).toBe("critical-never-hidden")
    expect(t.overrode?.map((o) => o.rule)).toContain("explanation-depth")
  })
})

rule("density-and-targets", () => {
  it("follows the person, then the brand, within the axis", () => {
    expect(plan(doc(text), { persona: { density: "compact" }, brand: { density: "spacious" } }).density).toBe("compact")
    expect(plan(doc(text), { brand: { density: "spacious" } }).density).toBe("spacious")
    expect(plan(doc(text)).density).toBe("comfortable")
  })
  it("gives low precision 44 px targets and spacious density, over the person's own density", () => {
    const p = plan(doc(text), { capability: { precision: "low" }, persona: { density: "compact" } })
    expect(p.minTarget).toBe(44)
    expect(p.density).toBe("spacious")
    expect(decided(p, "plan.density").overrode?.map((o) => o.value)).toContain("compact")
  })
  it("gives touch surfaces 44 px targets, others the 24 px minimum", () => {
    expect(plan(doc(text), { device: { surface: "phone" } }).minTarget).toBe(44)
    expect(plan(doc(text), { device: { surface: "desktop" } }).minTarget).toBe(24)
  })
  it("ranks a learned density below an explicit one would rank", () => {
    const p = plan(doc(text), { persona: { density: "compact", source: "learned" }, brand: { density: "spacious" } })
    expect(p.density).toBe("compact")
    expect(decided(p, "plan.density").because).toContain("person")
  })
})

rule("output-routing", () => {
  it("speaks when there is no visual output, and falls back to text when there is no audio either", () => {
    expect(plan(doc(text), { capability: { output: { visual: "unavailable" } } }).manifestation).toBe("voice")
    expect(plan(doc(text), { capability: { output: { visual: "unavailable", audio: "unavailable" } } }).manifestation).toBe("text")
  })
  it("routes switch access to the switch manifestation, and follows the surface otherwise", () => {
    expect(plan(doc(text), { capability: { input: { switch: true } } }).manifestation).toBe("switch")
    expect(plan(doc(text), { device: { surface: "terminal" } }).manifestation).toBe("text")
    expect(plan(doc(text), { device: { surface: "speaker" } }).manifestation).toBe("voice")
    expect(plan(doc(text)).manifestation).toBe("web")
  })
  it("puts a need above a preference: no visual output beats a preference for switch", () => {
    expect(plan(doc(text), { capability: { output: { visual: "unavailable" } }, persona: { inputMode: "switch" } }).manifestation).toBe("voice")
  })
  it("makes every cue text when there is no audio output", () => {
    expect(plan(doc(text), { capability: { output: { audio: "unavailable" } } }).cues).toBe("text-only")
    expect(plan(doc(text)).cues).toBe("audio-and-text")
  })
})

rule("explanation-depth", () => {
  it("collapses detail for a brief persona and opens it for a detailed one", () => {
    expect(find(plan(doc(rec), { persona: { explanation: "brief" } }), "rec").expanded).toBe(false)
    expect(find(plan(doc(rec), { persona: { explanation: "detailed" } }), "rec").expanded).toBe(true)
    expect(find(plan(doc(rec)), "rec").expanded).toBe(false)
  })
  it("sets expanded only on nodes that have detail", () => {
    expect(find(plan(doc(spend)), "go").expanded).toBeUndefined()
  })
})

rule("reduced-motion", () => {
  it("reduces motion when the OS asks, over the brand and over a request for full motion", () => {
    const p = plan(doc(text), { device: { reducedMotion: true }, brand: { motion: "snappy" }, persona: { motion: "full" } })
    expect(p.motion).toBe("reduced")
    expect(decided(p, "plan.motion").overrode?.map((o) => o.because)).toEqual(["the person asked for full motion", "the brand's motion (snappy)", "nothing asks to reduce motion"])
  })
  it("reduces motion when the person asks", () => {
    expect(plan(doc(text), { persona: { motion: "reduced" } }).motion).toBe("reduced")
    expect(plan(doc(text), { brand: { motion: "calm" } }).motion).toBe("full")
  })
})

rule("text-without-decision", () => {
  it("renders one line of text with no decision as plain text, with no card", () => {
    expect(plan(doc(text)).chrome).toBe("none")
  })
  it("keeps the card for a decision, or for more than a line", () => {
    expect(plan(doc(text, choice)).chrome).toBe("card")
    expect(plan(doc({ ...text, text: "x".repeat(121) })).chrome).toBe("card")
    expect(plan(doc({ ...text, text: "two\nlines" })).chrome).toBe("card")
  })
})

rule("contrast", () => {
  it("asks for AAA where vision is low, AA otherwise", () => {
    expect(plan(doc(text), { capability: { vision: "low" } }).contrast).toBe("AAA")
    expect(plan(doc(text)).contrast).toBe("AA")
  })
})

rule("structure", () => {
  it("merges a prediction into its Choice", () => {
    const p = plan(doc(choice, { type: "PredictedChoice", id: "p", intent: "likely", of: "c", option: "m" }))
    expect(p.regions[0].nodes.map((n) => n.id)).toEqual(["c"])
    expect(find(p, "c")).toMatchObject({ organism: "PredictedChoice", merged: [{ id: "p" }] })
  })
  it("attaches a tradeoff to its option and an approval's requester to the approval", () => {
    const p = plan(doc(rec, alt, { type: "Tradeoff", id: "tr", of: "less", gains: ["Cheaper"], costs: ["Slower results"] }))
    expect(p.regions[1].nodes[0].items![0].attached!.map((n) => n.id)).toEqual(["tr"])
    const a = plan(doc({ type: "Person", id: "maya", name: "Maya" }, { type: "Approval", id: "ok", intent: "approve", request: "Approve the budget?", requester: "maya" }))
    expect(a.regions[0].nodes.map((n) => n.id)).toEqual(["ok"])
    expect(find(a, "ok").attached!.map((n) => n.id)).toEqual(["maya"])
  })
  it("keeps the IR's order in the main region", () => {
    const p = plan(doc(text, { type: "Price", id: "price", amount: 5, currency: "USD" }, choice))
    expect(p.regions[0].nodes.map((n) => n.id)).toEqual(["t", "price", "c"])
  })
})

rule("defaults", () => {
  it("says out loud what it assumed", () => {
    const p = plan(doc(text))
    for (const subject of ["plan.manifestation", "plan.density", "plan.minTarget", "plan.motion"]) expect(decided(p, subject).rule).toBe("defaults")
  })
})

describe("compose", () => {
  it("refuses an invalid experience and lists why, never throws", () => {
    const r = compose({ ir: "feather.ir/0", experience: "e", nodes: [{ type: "IrreversibleAction", id: "go", intent: "pay" }] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues.map((i) => i.code)).toEqual(["irreversible-without-consequence"])
    expect(() => compose(null)).not.toThrow()
  })
  it("uses the context's locale, else the experience's, else en", () => {
    expect(plan({ ...doc(text), locale: "ar-AE" }).locale).toBe("ar-AE")
    expect(plan({ ...doc(text), locale: "ar-AE" }, { locale: "fr" }).locale).toBe("fr")
    expect(plan(doc(text)).locale).toBe("en")
  })
})

describe("coverage", () => {
  it("tests every rule", () => {
    expect(RULES.map((r) => r.id).filter((id) => !tested.has(id))).toEqual([])
  })
})
