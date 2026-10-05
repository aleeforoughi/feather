// Collapsed nodes (docs/manifestations.md section 1, browse): hidden behind one "Other options" choice, opened by picking it.
import { describe, expect, it } from "vitest"
import { dialogOf, fixture, labels, numberOf, planOf, texts, TEXT } from "./helpers.ts"

const delegate = { ...TEXT, persona: { autonomy: "delegate" } } as typeof TEXT
const flight = () => fixture("flight-search-tradeoff.json")
const folded = () => dialogOf(flight(), delegate)

describe("collapsed nodes in browse", () => {
  it("the plan folds the alternatives", () => {
    expect(planOf(flight(), delegate).regions.flatMap((r) => r.nodes).some((n) => n.collapsed === true)).toBe(true)
  })

  it("does not read their content or list their acts, and offers Other options after every other act", () => {
    const plain = dialogOf(flight()).turn
    const { turn } = folded()
    const hiddenNodes = ["alt_early", "alt_budget"]
    for (const p of turn.parts) expect(hiddenNodes).not.toContain(p.node)
    for (const c of turn.choices) expect(hiddenNodes).not.toContain(c.node)
    expect(turn.choices.at(-1)).toMatchObject({ label: "Other options", n: turn.choices.length })
    expect(turn.choices.at(-1)?.node).toBeUndefined()
    expect(turn.choices.slice(0, -1).map((c) => [c.node, c.act])).toEqual(plain.choices.filter((c) => !hiddenNodes.includes(c.node ?? "")).map((c) => [c.node, c.act]))
    expect(texts(turn, "question").at(-1)).toContain(`1 to ${turn.choices.length}`)
  })

  it("picking it emits nothing and shows their content and acts in plan order, open for the rest of the experience", () => {
    const d = folded()
    const open = d.answer(String(d.turn.choices.at(-1)!.n))
    expect(open.replies).toEqual([])
    const plain = dialogOf(flight()).turn
    expect(texts(open.turn, "content")).toEqual(texts(plain, "content"))
    expect(open.turn.choices.map((c) => [c.node, c.act])).toEqual(plain.choices.map((c) => [c.node, c.act]))
    expect(labels(open.turn)).not.toContain("Other options")
    // Still open after an act.
    const next = d.answer(numberOf(open.turn, "alt_budget", "choose"))
    expect(next.replies).toHaveLength(1)
    expect(next.replies[0]).toMatchObject({ node: "alt_budget", act: "choose" })
    expect(labels(next.turn)).not.toContain("Other options")
    expect(next.turn.choices.some((c) => c.node === "alt_early")).toBe(true)
  })

  it("picks Other options by its words, and repeat keeps them closed until then", () => {
    const d = folded()
    expect(d.answer("repeat").turn.choices.at(-1)!.label).toBe("Other options")
    expect(d.answer("other options").turn.choices.some((c) => c.node === "alt_early")).toBe(true)
  })

  it("is not offered when nothing is collapsed", () => {
    expect(labels(dialogOf(flight()).turn)).not.toContain("Other options")
  })
})
