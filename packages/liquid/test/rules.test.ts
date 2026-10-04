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
const deep = (n: PlanNode): PlanNode[] => [n, ...[...(n.merged ?? []), ...(n.attached ?? []), ...(n.items ?? [])].flatMap(deep)]
const all = (p: LayoutPlan): PlanNode[] => p.regions.flatMap((r) => r.nodes.flatMap(deep))
const find = (p: LayoutPlan, id: string) => all(p).find((n) => n.id === id)!
const decided = (p: LayoutPlan, subject: string) => p.trace.find((t) => t.subject === subject)!

const rec = { type: "Recommendation", id: "rec", intent: "launch the test", summary: "7 days, purchase objective", expandable: { why: "Enough to test three directions." } }
const spend = { type: "IrreversibleAction", id: "go", intent: "confirm spend", consequence: { spend: { amount: 1050, currency: "AED" } } }
const alt = { type: "Alternative", id: "less", intent: "spend less", for: "rec" }
const text = { type: "Text", id: "t", text: "Your order is on its way." }
const person = { type: "Person", id: "maya", name: "Maya" }
const approval = { type: "Approval", id: "ok", intent: "approve", request: "Approve the budget?", requester: "maya" }
const predicted = { type: "PredictedChoice", id: "p", intent: "likely", of: "c", option: "m" }
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
    // A Form asks more of the person than one Input does, so it comes first; a Choice still comes before both.
    const form = { type: "Form", id: "f", intent: "give details", fields: [{ id: "a", prompt: "A", kind: "text" }] }
    const input = { type: "Input", id: "i", intent: "give one", prompt: "One?", kind: "text" }
    expect(plan(doc(input, form)).primary).toBe("f")
    expect(plan(doc(form, choice)).primary).toBe("c")
    expect(decided(plan(doc(rec, spend)), "plan.primary").because).toContain("none marked")
  })
  it("has none when there is no act", () => {
    const p = plan(doc(text))
    expect(p.primary).toBeNull()
    expect(decided(p, "plan.primary").because).toBe("the experience has no act that can be primary")
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
  it("treats an act stating a consequence as irreversible: a consent Approval takes no focus and confirms", () => {
    const consent = { ...approval, consequence: { consent: { to: "Acme", scope: "your calendar" } } }
    const p = plan(doc(person, consent))
    expect(p.focus).toBeNull()
    expect(find(p, "ok").confirm).toBe("confirm")
  })
  it("confirms once: an act its IrreversibleAction commits gets no confirm of its own, named or implied", () => {
    const own = { ...rec, reversible: false, consequence: { statement: "Starts the campaign." } }
    for (const go of [{ ...spend, confirms: "rec" }, spend]) {
      const p = plan(doc(own, go))
      expect(find(p, "rec").confirm).toBeUndefined()
      expect(find(p, "go").confirm).toBe("confirm")
    }
  })
  it("gives a spoken or typed keyword in the plan's locale, falling back to English", () => {
    const voice = { capability: { output: { visual: "unavailable" as const } } }
    expect(find(plan(doc(spend), voice), "go").keyword).toBe("confirm")
    expect(find(plan({ ...doc(spend), locale: "fr-FR" }, voice), "go").keyword).toBe("confirmer")
    expect(find(plan(doc(spend), { ...voice, locale: "ar" }), "go").keyword).toBe("تأكيد")
    const ja = plan(doc(spend), { device: { surface: "terminal" }, locale: "ja" })
    expect(find(ja, "go").keyword).toBe("confirm")
    expect(decided(ja, "plan.keyword").rule).toBe("defaults")
    expect(find(plan(doc(spend)), "go").keyword).toBeUndefined()
  })
  it("never preselects an irreversible choice", () => {
    const p = plan(doc({ ...choice, reversible: false, selected: ["m"] }, { ...spend, confirms: "c" }))
    expect(find(p, "c").preselected).toBeUndefined()
    expect(decided(p, "node c.preselected").rule).toBe("irreversible-explicit")
  })
  it("shows an irreversible choice's prediction as a note, never merged and preselected", () => {
    const p = plan(doc({ ...choice, reversible: false }, predicted, { ...spend, confirms: "c" }))
    const c = find(p, "c")
    expect(c.organism).toBe("Choice")
    expect(c.preselected).toBeUndefined()
    expect(c.merged).toBeUndefined()
    expect(c.attached).toMatchObject([{ id: "p", organism: "PredictionNote" }])
  })
})

rule("recommendation-first", () => {
  it("puts the alternatives after the recommendation, as one list", () => {
    const p = plan(doc(rec, alt, { ...alt, id: "own", intent: "set my own budget", input: "Price" }))
    expect(p.regions[0].nodes.map((n) => n.id)).toEqual(["rec"])
    expect(p.regions[1].nodes).toHaveLength(1)
    expect(p.regions[1].nodes[0]).toMatchObject({ id: "~alternatives:rec", organism: "AlternativeList" })
    expect(p.regions[1].nodes[0].items!.map((n) => n.id)).toEqual(["less", "own"])
  })
  it("keeps one list per recommendation", () => {
    const rec2 = { ...rec, id: "rec2", intent: "pause instead" }
    const p = plan(doc(rec, { ...alt, id: "a1" }, rec2, { ...alt, id: "a2", for: "rec2" }, { ...alt, id: "a3" }))
    expect(p.regions[1].nodes.map((g) => [g.id, g.items!.map((i) => i.id)])).toEqual([
      ["~alternatives:rec", ["a1", "a3"]],
      ["~alternatives:rec2", ["a2"]],
    ])
  })
  it("preselects the predicted option, or the caller's selection", () => {
    expect(find(plan(doc(choice, predicted)), "c").preselected).toBe("m")
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
  it("applies the IR's defaults: an IrreversibleAction is critical unless it says high", () => {
    expect(find(plan(doc(rec, spend)), "go").emphasis).toBe("critical")
    expect(find(plan(doc(rec, { ...spend, importance: "high" })), "go").emphasis).toBe("primary")
  })
})

rule("importance", () => {
  it("makes high importance stand out and low importance quiet, with the IR's defaults", () => {
    expect(find(plan(doc(text, { ...text, id: "h", importance: "high" })), "h").emphasis).toBe("high")
    expect(find(plan(doc(text, { ...text, id: "l", importance: "low" })), "l").emphasis).toBe("quiet")
    expect(find(plan(doc({ type: "Warning", id: "w", text: "Prices rise tomorrow." })), "w").emphasis).toBe("high")
  })
  it("lets a list of alternatives stand out as much as its strongest member", () => {
    expect(plan(doc(rec, { ...alt, importance: "low" })).regions[1].nodes[0].emphasis).toBe("quiet")
    expect(plan(doc(rec, { ...alt, importance: "low" }, { ...alt, id: "x", importance: "critical" })).regions[1].nodes[0].emphasis).toBe("critical")
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
  it("ranks a learned preference below an explicit setting, field by field", () => {
    const p = plan(doc(rec), { persona: { density: "compact", explanation: "detailed", learned: ["density"] }, brand: { density: "spacious" } })
    expect(p.density).toBe("compact")
    expect(decided(p, "plan.density").level).toBe("learned")
    expect(decided(p, "node rec.expanded").level).toBe("user-setting")
    expect(decided(plan(doc(text), { persona: { density: "compact" } }), "plan.density").level).toBe("user-setting")
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
  it("never takes a body the output cannot carry", () => {
    expect(plan(doc(text), { persona: { inputMode: "voice" } }).manifestation).toBe("web")
    expect(plan(doc(text), { device: { surface: "speaker" }, capability: { input: { switch: true } } }).manifestation).toBe("voice")
    expect(plan(doc(text), { device: { surface: "terminal" }, capability: { input: { switch: true } } }).manifestation).toBe("text")
    expect(plan(doc(text), { device: { surface: "speaker" }, capability: { output: { audio: "unavailable" } } }).manifestation).toBe("text")
  })
  it("renders the text equivalent of audio and video when there is no audio output", () => {
    const clip = { type: "Media", id: "m", kind: "audio", src: "https://example.com/a.mp3", transcript: "Hello." }
    expect(find(plan(doc(clip), { capability: { output: { audio: "unavailable" } } }), "m").textEquivalent).toBe(true)
    expect(find(plan(doc(clip)), "m").textEquivalent).toBeUndefined()
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
    expect(decided(p, "plan.motion").overrode?.map((o) => o.because)).toEqual(["the person asked for full motion", "nothing asks to reduce motion"])
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
  it("counts one node of Text, Confirmation or Status, with no detail, in code points", () => {
    expect(plan(doc({ type: "Status", id: "s", state: "done", label: "Sent" })).chrome).toBe("none")
    expect(plan(doc(text, { ...text, id: "t2" })).chrome).toBe("card")
    expect(plan(doc({ ...text, expandable: { why: "Because." } })).chrome).toBe("card")
    expect(plan(doc({ ...text, text: "😀".repeat(100) })).chrome).toBe("none")
    expect(plan(doc({ type: "Price", id: "pr", amount: 5, currency: "USD" })).chrome).toBe("card")
  })
})

rule("contrast", () => {
  it("asks for AAA where vision is low, AA otherwise", () => {
    expect(plan(doc(text), { capability: { vision: "low" } }).contrast).toBe("AAA")
    expect(plan(doc(text)).contrast).toBe("AA")
  })
})

rule("structure", () => {
  it("merges a prediction into its Choice, composed like any node", () => {
    const p = plan(doc(choice, { ...predicted, importance: "low" }))
    expect(p.regions[0].nodes.map((n) => n.id)).toEqual(["c"])
    expect(find(p, "c")).toMatchObject({ organism: "PredictedChoice", merged: [{ id: "p", organism: "PredictedChoice", emphasis: "quiet" }] })
  })
  it("attaches a tradeoff to its option and an approval's requester to the approval", () => {
    const p = plan(doc(rec, alt, { type: "Tradeoff", id: "tr", of: "less", gains: ["Cheaper"], costs: ["Slower results"] }))
    expect(p.regions[1].nodes[0].items![0].attached!.map((n) => n.id)).toEqual(["tr"])
    const a = plan(doc(person, approval))
    expect(a.regions[0].nodes.map((n) => n.id)).toEqual(["ok"])
    expect(find(a, "ok").attached!.map((n) => n.id)).toEqual(["maya"])
  })
  it("attaches the requester to every approval it asks for, and lists it once in the order", () => {
    const p = plan(doc(person, approval, { ...approval, id: "ok2", request: "Approve the dates?" }))
    expect(p.regions[0].nodes.map((n) => [n.id, n.attached!.map((a) => a.id)])).toEqual([
      ["ok", ["maya"]],
      ["ok2", ["maya"]],
    ])
    expect(p.order).toEqual(["ok", "maya", "ok2"])
  })
  it("orders every node once: main, then secondary, each followed by what it holds", () => {
    const p = plan(doc(text, rec, alt, { type: "Tradeoff", id: "tr", of: "less", gains: ["Cheaper"] }, { type: "ExploreMore", id: "more", intent: "learn more" }, choice, predicted))
    expect(p.order).toEqual(["t", "rec", "c", "p", "less", "tr", "more"])
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
  it("never throws on input it cannot read", () => {
    const circular: Record<string, unknown> = { ...doc(text) }
    circular.self = circular
    const getter = { ...doc(text) }
    Object.defineProperty(getter, "nodes", { enumerable: true, get: () => { throw new Error("no") } })
    for (const input of [{ ...doc(text), big: 1n }, circular, getter]) {
      expect(() => compose(input)).not.toThrow()
      expect(compose(input).ok).toBe(false)
    }
  })
  it("drops context it cannot trust, says so in the trace, and composes anyway", () => {
    const bad = { persona: { density: "huge", learned: ["density", "colour"] }, device: { surface: 7, width: -1 }, capability: "low", locale: "not a locale!" }
    for (const context of [null, 5, "phone", bad]) {
      const r = compose(doc(text), context as unknown as RenderContext)
      expect(r.ok).toBe(true)
    }
    const p = plan(doc(text), bad as unknown as RenderContext)
    expect(p.density).toBe("comfortable")
    expect(p.locale).toBe("en")
    expect(p.trace.filter((t) => t.subject.startsWith("context.")).map((t) => t.subject)).toEqual([
      "context.persona.density",
      "context.persona.learned",
      "context.capability",
      "context.device.surface",
      "context.device.width",
      "context.locale",
    ])
  })
  it("keeps the plan apart from the caller's document", () => {
    const ir = doc({ ...text })
    const p = plan(ir)
    ;(ir.nodes[0] as { text: string }).text = "changed"
    expect((p.regions[0].nodes[0].node as { text: string }).text).toBe("Your order is on its way.")
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
