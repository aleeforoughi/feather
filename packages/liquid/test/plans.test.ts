import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { REFERENCE_CONTEXTS, compose, type LayoutPlan, type PlanNode } from "../src/index.ts"

// Every valid conformance fixture, composed in every reference context. The plans are snapshots in test/plans/, one
// readable file per fixture, so a change to any rule shows up as a reviewable diff (L3 exit: all fixtures compose
// deterministically, with snapshot tests). Update with `pnpm --filter @aleeforoughi/feather-liquid test -u`.
const dir = path.resolve(import.meta.dirname, "../../../conformance/ir/valid")
const fixtures = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).ir

/** The plan without the IR nodes it carries (already in the fixture), so the snapshot shows only decisions. */
function decisions(plan: LayoutPlan) {
  const strip = (n: PlanNode): unknown => {
    const { merged, items, attached, ...rest } = n
    const kept: Record<string, unknown> = { ...rest }
    delete kept.node
    return { ...kept, ...(merged ? { merged: merged.map(strip) } : {}), ...(items ? { items: items.map(strip) } : {}), ...(attached ? { attached: attached.map(strip) } : {}) }
  }
  return { ...plan, regions: plan.regions.map((r) => ({ id: r.id, nodes: r.nodes.map(strip) })) }
}

describe("every fixture composes in every reference context", () => {
  it.each(fixtures)("%s", async (file) => {
    const ir = load(file)
    const plans: Record<string, unknown> = {}
    for (const [name, { context }] of Object.entries(REFERENCE_CONTEXTS)) {
      const result = compose(ir, context)
      if (!result.ok) throw new Error(`${file} does not validate`)
      expect(compose(structuredClone(ir), structuredClone(context))).toEqual(result)
      expect(JSON.parse(JSON.stringify(result.plan))).toEqual(result.plan)
      plans[name] = decisions(result.plan)
    }
    await expect(`${JSON.stringify(plans, null, 2)}\n`).toMatchFileSnapshot(`plans/${file}`)
  })
})

describe("speed", () => {
  it("composes well under the 5 ms budget", () => {
    const irs = fixtures.map(load)
    const contexts = Object.values(REFERENCE_CONTEXTS).map((c) => c.context)
    for (const ir of irs) for (const c of contexts) compose(ir, c)
    const rounds = 20
    const start = performance.now()
    for (let i = 0; i < rounds; i++) for (const ir of irs) for (const c of contexts) compose(ir, c)
    const average = (performance.now() - start) / (rounds * irs.length * contexts.length)
    expect(average).toBeLessThan(1)
  })
})
