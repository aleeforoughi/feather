import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { specFor } from "@aleeforoughi/feather-intent"
import { REFERENCE_CAPABILITIES, REFERENCE_PERSONAS, compose, type LayoutPlan, type PlanNode } from "../src/index.ts"

// L5 exit: five reference personas and five capability profiles, each changing the plan in a measurable way (fewer
// acts in view, larger targets, a voice route), with no persona data persisted or logged.
const fixture = (name: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../conformance/ir/valid", name), "utf8")).ir
function plan(name: string, context: RenderContext): LayoutPlan {
  const result = compose(fixture(name), context)
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.plan
}
const desk: RenderContext = { device: { surface: "desktop", width: 1280 } }
const withPersona = (name: keyof typeof REFERENCE_PERSONAS): RenderContext => ({ ...desk, persona: REFERENCE_PERSONAS[name].persona })
const withCapability = (name: keyof typeof REFERENCE_CAPABILITIES): RenderContext => ({ ...desk, capability: REFERENCE_CAPABILITIES[name].capability })

const deep = (n: PlanNode): PlanNode[] => [n, ...[...(n.merged ?? []), ...(n.attached ?? []), ...(n.items ?? [])].flatMap(deep)]
const find = (p: LayoutPlan, id: string) => p.regions.flatMap((r) => r.nodes.flatMap(deep)).find((n) => n.id === id)!
/** The acts a person sees without opening anything: every act node outside a folded one. */
const actsInView = (p: LayoutPlan) =>
  p.regions.flatMap((r) => r.nodes.filter((n) => !n.collapsed).flatMap(deep)).filter((n) => n.node !== undefined && specFor(n.node.type)?.act === true).length
/** The plan without its trace: what was decided, not how it was explained. */
const decisions = (p: LayoutPlan) => JSON.stringify({ ...p, trace: undefined })

describe("reference personas", () => {
  it("defines five", () => expect(Object.keys(REFERENCE_PERSONAS)).toHaveLength(5))

  it("delegator: fewer acts in view, detail closed, compact", () => {
    const before = plan("flight-search-tradeoff.json", desk)
    const after = plan("flight-search-tradeoff.json", withPersona("delegator"))
    expect(actsInView(after)).toBeLessThan(actsInView(before))
    expect(after.density).toBe("compact")
    expect(find(plan("help-article.json", withPersona("delegator")), "step3").expanded ?? false).toBe(false)
  })

  it("deliberate: nothing preselected for them, detail open", () => {
    expect(find(plan("predicted-news-topic.json", desk), "category").preselected).toBeDefined()
    expect(find(plan("predicted-news-topic.json", withPersona("deliberate")), "category").preselected).toBeUndefined()
    const help = plan("help-article.json", withPersona("deliberate"))
    expect(help.regions[0].nodes.some((n) => n.expanded === true)).toBe(true)
  })

  it("touch-first: larger targets", () => {
    expect(plan("flight-search-tradeoff.json", desk).minTarget).toBe(24)
    expect(plan("flight-search-tradeoff.json", withPersona("touch-first")).minTarget).toBe(44)
  })

  it("calm: reduced motion, more room", () => {
    const p = plan("flight-search-tradeoff.json", withPersona("calm"))
    expect([p.motion, p.density]).toEqual(["reduced", "spacious"])
  })

  it("switch-preferred: the switch body", () => {
    expect(plan("flight-search-tradeoff.json", withPersona("switch-preferred")).manifestation).toBe("switch")
  })
})

describe("reference capability profiles", () => {
  it("defines at least five", () => expect(Object.keys(REFERENCE_CAPABILITIES).length).toBeGreaterThanOrEqual(5))

  it("low-vision: AAA contrast", () => {
    expect(plan("flight-search-tradeoff.json", withCapability("low-vision")).contrast).toBe("AAA")
  })

  it("low-precision: larger targets and more room", () => {
    const p = plan("flight-search-tradeoff.json", withCapability("low-precision"))
    expect([p.minTarget, p.density]).toEqual([44, "spacious"])
  })

  it("no-screen-speaking: a voice route, confirmed by a spoken keyword", () => {
    const p = plan("delete-account.json", withCapability("no-screen-speaking"))
    expect(p.manifestation).toBe("voice")
    expect(p.regions.flatMap((r) => r.nodes.flatMap(deep)).some((n) => n.confirm === "spoken-keyword")).toBe(true)
  })

  it("no-screen-typing: never asked to speak; text, confirmed by a typed keyword", () => {
    const p = plan("delete-account.json", withCapability("no-screen-typing"))
    expect(p.manifestation).toBe("text")
    expect(p.regions.flatMap((r) => r.nodes.flatMap(deep)).some((n) => n.confirm === "typed-keyword")).toBe(true)
  })

  it("plain-reading: fewer acts in view, detail closed", () => {
    expect(actsInView(plan("flight-search-tradeoff.json", withCapability("plain-reading")))).toBeLessThan(actsInView(plan("flight-search-tradeoff.json", desk)))
    expect(find(plan("help-article.json", { ...withCapability("plain-reading"), persona: { explanation: "detailed" } }), "step3").expanded ?? false).toBe(false)
  })

  it("hands-busy: a voice route while it holds", () => {
    expect(plan("flight-search-tradeoff.json", withCapability("hands-busy")).manifestation).toBe("voice")
  })
})

describe("every reference slice changes the plan", () => {
  const fixtures = ["flight-search-tradeoff.json", "predicted-news-topic.json", "help-article.json", "delete-account.json"]
  const changes = (context: RenderContext) => fixtures.some((f) => decisions(plan(f, context)) !== decisions(plan(f, desk)))
  it.each(Object.keys(REFERENCE_PERSONAS) as Array<keyof typeof REFERENCE_PERSONAS>)("persona %s", (name) => expect(changes(withPersona(name))).toBe(true))
  it.each(Object.keys(REFERENCE_CAPABILITIES) as Array<keyof typeof REFERENCE_CAPABILITIES>)("capability %s", (name) => expect(changes(withCapability(name))).toBe(true))
})

describe("Feather stores nothing about people (principle 11)", () => {
  it("leaves the context untouched, writes nothing, logs nothing", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    const context = { ...desk, persona: REFERENCE_PERSONAS.deliberate.persona, capability: REFERENCE_CAPABILITIES["plain-reading"].capability }
    const frozen = structuredClone(context)
    const globalsBefore = Object.keys(globalThis).sort()
    for (const f of ["flight-search-tradeoff.json", "predicted-news-topic.json"]) plan(f, context)
    expect(context).toEqual(frozen)
    expect(Object.keys(globalThis).sort()).toEqual(globalsBefore)
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  })

  it("composes the same plan twice: nothing carried over from an earlier render", () => {
    const a = plan("flight-search-tradeoff.json", desk)
    plan("flight-search-tradeoff.json", withPersona("delegator"))
    expect(plan("flight-search-tradeoff.json", desk)).toEqual(a)
  })

  it("keeps no persona object in the plan: only the decisions it led to", () => {
    const p = plan("flight-search-tradeoff.json", withPersona("delegator"))
    expect(JSON.stringify(p)).not.toContain('"persona"')
    expect(p).not.toHaveProperty("context")
  })
})
