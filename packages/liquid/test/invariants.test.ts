import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { specFor, type Experience, type IRNode } from "@aleeforoughi/feather-intent"
import { REFERENCE_CONTEXTS, compose, type LayoutPlan, type PlanNode } from "../src/index.ts"

// What must hold for every plan, whatever the rules decide: every fixture in the reference contexts and in a spread
// of generated contexts. A rule change that breaks one of these is a bug, however reasonable the rule looks.
const dir = path.resolve(import.meta.dirname, "../../../conformance/ir/valid")
const fixtures: Array<[string, Experience]> = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => [f, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).ir])

/** A small deterministic generator (mulberry32), so the contexts are the same on every run. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function contexts(count: number): RenderContext[] {
  const next = random(8)
  const one = <T,>(values: readonly T[]): T | undefined => (next() < 0.3 ? undefined : values[Math.floor(next() * values.length)])
  const out: RenderContext[] = []
  for (let i = 0; i < count; i++) {
    const learned = (["density", "explanation", "motion", "inputMode"] as const).filter(() => next() < 0.3)
    out.push({
      persona: { density: one(["compact", "comfortable", "spacious"]), explanation: one(["brief", "standard", "detailed"]), motion: one(["full", "reduced"]), inputMode: one(["pointer", "touch", "keyboard", "voice", "switch"]), learned },
      capability: {
        input: { pointer: one([true, false]), touch: one([true, false]), keyboard: one([true, false]), voice: one([true, false]), switch: one([true, false]) },
        output: { visual: one(["available", "unavailable"]), audio: one(["available", "unavailable"]) },
        vision: one(["typical", "low"]),
        precision: one(["typical", "low"]),
      },
      device: { surface: one(["phone", "tablet", "desktop", "watch", "speaker", "terminal"]), reducedMotion: one([true, false]) },
      brand: { density: one(["compact", "comfortable", "spacious"]), motion: one(["calm", "snappy"]) },
      locale: one(["en", "fr-CA", "ar-AE", "ja"]),
    })
  }
  return out
}
const CONTEXTS: Array<[string, RenderContext]> = [...Object.entries(REFERENCE_CONTEXTS).map(([name, c]): [string, RenderContext] => [name, c.context]), ...contexts(60).map((c, i): [string, RenderContext] => [`generated ${i}`, c])]

const deep = (n: PlanNode): PlanNode[] => [n, ...[...(n.merged ?? []), ...(n.attached ?? []), ...(n.items ?? [])].flatMap(deep)]
const everyNode = (p: LayoutPlan) => p.regions.flatMap((r) => r.nodes.flatMap(deep))
const isAct = (n: IRNode) => specFor(n.type)?.act === true
const irreversible = (n: IRNode) => n.type === "IrreversibleAction" || (isAct(n) && (n.reversible === false || ("consequence" in n && n.consequence !== undefined)))
const importance = (n: IRNode) => n.importance ?? specFor(n.type)?.defaults?.importance ?? "normal"

describe.each(fixtures)("%s", (_file, ir) => {
  it.each(CONTEXTS)("holds the invariants in %s", (_name, context) => {
    const result = compose(ir, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const p = result.plan
    const byId = new Map(ir.nodes.map((n) => [n.id, n]))

    // A resolved experience collapses (L6): nothing of the interaction remains to read, act on or focus.
    if (ir.resolved) {
      expect([p.lifecycle, p.order, p.primary, p.focus, p.chrome]).toEqual(["collapsed", [], null, null, "none"])
      expect(everyNode(p)).toEqual([])
      expect(p.resolution).toEqual(ir.resolved)
      return
    }
    expect(p.lifecycle).toBe("open")
    // Every IR node renders, and is read once.
    expect([...p.order].sort()).toEqual(ir.nodes.map((n) => n.id).sort())
    expect(new Set(everyNode(p).filter((n) => !n.id.startsWith("~")).map((n) => n.id))).toEqual(new Set(p.order))

    // Focus starts on a real act, never on one that cannot be undone, and never in a body with no focus.
    if (p.focus !== null) {
      const node = byId.get(p.focus)!
      expect(isAct(node)).toBe(true)
      expect(irreversible(node)).toBe(false)
      expect(["web", "switch"]).toContain(p.manifestation)
    }
    expect(p.primary === null || byId.has(p.primary)).toBe(true)

    for (const n of everyNode(p)) {
      if (!n.node) continue
      // Critical is emphasized, and its detail never hidden.
      if (importance(n.node) === "critical") {
        expect(n.emphasis).toBe("critical")
        if (n.node.expandable) expect(n.expanded).toBe(true)
      }
      // Whatever commits an irreversible effect is confirmed in the body's own way, with a keyword where one is said.
      if (n.node.type === "IrreversibleAction") expect(n.confirm).toBe(p.manifestation === "voice" ? "spoken-keyword" : p.manifestation === "text" ? "typed-keyword" : "confirm")
      if (n.confirm) expect(irreversible(n.node)).toBe(true)
      expect(n.keyword !== undefined).toBe(n.confirm === "spoken-keyword" || n.confirm === "typed-keyword")
      // An irreversible choice is never preselected.
      if (n.node.type === "Choice" && irreversible(n.node)) expect(n.preselected).toBeUndefined()
    }

    // No body the output cannot carry.
    const output = context.capability?.output ?? {}
    if (output.visual === "unavailable" || context.device?.surface === "speaker") expect(["voice", "text"]).toContain(p.manifestation)
    if (p.manifestation === "voice") expect(output.audio).not.toBe("unavailable")
    if (context.device?.surface === "terminal" && output.visual !== "unavailable") expect(p.manifestation).toBe("text")
    if (context.device?.reducedMotion || context.persona?.motion === "reduced") expect(p.motion).toBe("reduced")
    if (context.capability?.precision === "low") expect(p.minTarget).toBe(44)

    // The plan is data: it survives JSON, and composing again gives the same plan.
    expect(JSON.parse(JSON.stringify(p))).toEqual(p)
    expect(compose(structuredClone(ir), structuredClone(context))).toEqual(result)
  })
})

describe("speed", () => {
  it("composes a large experience well inside the 5 ms budget", () => {
    // 481 nodes: ten times the largest fixture.
    const nodes: unknown[] = [{ type: "Recommendation", id: "rec", intent: "launch", summary: "Launch now", expandable: { why: "It is ready." } }]
    for (let i = 0; i < 160; i++) {
      nodes.push({ type: "Alternative", id: `a${i}`, intent: `option ${i}`, for: "rec" })
      nodes.push({ type: "Tradeoff", id: `t${i}`, of: `a${i}`, gains: ["Cheaper"] })
      nodes.push({ type: "Text", id: `x${i}`, text: `Line ${i}` })
    }
    const ir = { ir: "feather.ir/1", experience: "large", nodes }
    expect(compose(ir).ok).toBe(true)
    const context = REFERENCE_CONTEXTS["desktop-detailed"].context
    for (let i = 0; i < 5; i++) compose(ir, context)
    // The fastest of 20 runs: the composer's own cost, not whatever else the machine is doing at the time.
    let fastest = Infinity
    for (let i = 0; i < 20; i++) {
      const start = performance.now()
      compose(ir, context)
      fastest = Math.min(fastest, performance.now() - start)
    }
    expect(fastest).toBeLessThan(5)
  })
})
