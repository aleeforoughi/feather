// Every valid conformance fixture renders, in the phone and the desktop-detailed contexts, with no error or React
// warning, and every plan node sits in a wrapper.
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { compose, REFERENCE_CONTEXTS, type LayoutPlan } from "@aleeforoughi/feather-liquid"
import { experienceOf, FeatherExperience, planNodes } from "./index"
import { failOnConsole, FIXTURES } from "./test/fixtures"

describe.each(["phone", "desktop-detailed"] as const)("every valid fixture in %s", (name) => {
  failOnConsole()
  const { context } = REFERENCE_CONTEXTS[name]

  it.each(FIXTURES)("$name renders, and every plan node has a wrapper", ({ ir }) => {
    const composed = compose(ir, context)
    if (!composed.ok) throw new Error("fixture is invalid")
    const { container } = render(<FeatherExperience experience={ir} context={context} onReply={vi.fn()} />)

    const root = container.querySelector('[data-slot="experience"]')
    expect(root, "the experience root").not.toBeNull()
    expect(root!.getAttribute("data-manifestation")).toBe("web")

    for (const node of planNodes(composed.plan)) {
      const wrapper = container.querySelector(`[data-feather-node="${node.id}"]`)
      expect(wrapper, `a wrapper for ${node.type} "${node.id}"`).not.toBeNull()
      expect(wrapper!.getAttribute("data-organism")).toBe(node.organism)
      expect(wrapper!.getAttribute("data-emphasis")).toBe(node.emphasis)
    }
    // Nothing renders twice or invents a node: every wrapper is a plan node.
    const ids = new Set(planNodes(composed.plan).map((n) => n.id))
    for (const el of container.querySelectorAll("[data-feather-node]")) expect(ids.has(el.getAttribute("data-feather-node")!)).toBe(true)
  })
})

describe("the plan carries every node, so replies can be checked", () => {
  it.each(FIXTURES)("$name: the experience rebuilt from the plan is the experience", ({ ir }) => {
    for (const { context } of Object.values(REFERENCE_CONTEXTS)) {
      const result = compose(ir, context)
      if (!result.ok) throw new Error("fixture is invalid")
      const plan: LayoutPlan = result.plan
      const rebuilt = experienceOf(plan)
      const original = ir as { nodes: Array<{ id: string }> }
      // A collapsed plan (L6) carries no nodes: only its resolution is rendered.
      if (plan.lifecycle === "collapsed") {
        expect(rebuilt.nodes).toEqual([])
        continue
      }
      expect(rebuilt.nodes.map((n) => n.id).sort()).toEqual(original.nodes.map((n) => n.id).sort())
    }
  })
})
