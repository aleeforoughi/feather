import { describe, expect, it } from "vitest"
import { REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"
import { createDialog } from "../src/index.ts"
import { fixture, fixtureNames, planOf } from "./helpers.ts"

describe("every valid fixture, in every reference context", () => {
  it.each(fixtureNames)("%s", (name) => {
    const ir = fixture(name)
    for (const [context, { context: ctx }] of Object.entries(REFERENCE_CONTEXTS)) {
      const plan = planOf(ir, ctx)
      for (const readback of [false, true]) {
        const dialog = createDialog(plan, { readback })
        const turn = dialog.turn
        const present = new Set<string>([...turn.parts.map((p) => p.node), ...turn.choices.map((c) => c.node)].filter((x): x is string => x !== undefined))
        for (const id of plan.order) expect(present.has(id), `${name} (${context}): ${id} is in the first turn`).toBe(true)
        expect(turn.choices.map((c) => c.n)).toEqual(turn.choices.map((_, i) => i + 1))
        expect(dialog.done).toBe(turn.choices.length === 0)
      }
    }
  })

  it.each(fixtureNames)("%s: every offered act can be taken, and an irreversible one only with the keyword", (name) => {
    const ir = fixture(name)
    const plan = planOf(ir, REFERENCE_CONTEXTS.screenless.context)
    const first = createDialog(plan).turn
    for (const choice of first.choices) {
      const d = createDialog(plan)
      const out = d.answer(String(choice.n))
      const armed = out.turn.state === "confirm"
      if (armed) expect(out.replies, `${name} ${choice.node} ${choice.act}`).toEqual([])
      expect(["browse", "value", "confirm", "done"]).toContain(out.turn.state)
    }
  })
})
