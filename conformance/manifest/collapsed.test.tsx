// L5: collapsed nodes (docs/manifestations.md sections 1 and 4, docs/composer.md "Rendering on the web"). For a person who
// delegates, the composer folds the other ways to go behind one "Other options" disclosure. Folding hides, it never removes:
// every act inside is still chosen, in every body, and the reply is the one an unfolded plan gives.
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PlanView } from "@aleeforoughi/feather-manifest-web"
import { SwitchExperience } from "@aleeforoughi/feather-manifest-switch"
import { BODIES, FIXTURES, planFor, type Body, type Fixture } from "./fixtures.ts"
import { isCollapsed, scenariosOf } from "./scenarios.ts"
import { driveSwitch } from "./drivers/switch.tsx"
import { driveText, textTalker } from "./drivers/talk.ts"
import { driveVoice, voiceExists, voiceTalker } from "./drivers/voice.ts"
import { driveWeb, hostOf } from "./drivers/web.tsx"
import type { Result } from "./drivers/types.ts"

const DELEGATE = { autonomy: "delegate" } as const
const DRIVERS = { web: driveWeb, switch: driveSwitch, text: driveText, voice: driveVoice }
const skipped = (body: Body) => body === "voice" && !voiceExists

/** Fixtures that have something to fold for a person who delegates. */
const FOLDING: Fixture[] = FIXTURES.filter((fx) => planFor(fx.ir, "web", DELEGATE).regions.some((r) => r.nodes.some((n) => n.collapsed === true))).map((fx) => ({ ...fx, persona: DELEGATE }))

describe("collapsed nodes: the fixtures that fold", () => {
  it("there are fixtures that fold, and an Alternative among them", () => {
    expect(FOLDING.length).toBeGreaterThan(0)
    const alternatives = FOLDING.flatMap((fx) => fx.ir.nodes.filter((n) => n.type === "Alternative" && isCollapsed(planFor(fx.ir, "web", DELEGATE), n.id)))
    expect(alternatives.length).toBeGreaterThan(0)
  })
})

for (const fx of FOLDING) {
  describe(`${fx.name} for a person who delegates`, () => {
    const plan = planFor(fx.ir, "web", DELEGATE)
    const folded = scenariosOf(fx.name, fx.ir, plan).filter((s) => isCollapsed(plan, s.node))
    const unfolded: Fixture = { name: fx.name, ir: fx.ir }

    it("the four plans fold the same nodes", () => {
      const ids = (body: Body) => planFor(fx.ir, body, DELEGATE).regions.flatMap((r) => r.nodes.filter((n) => n.collapsed === true).map((n) => n.id))
      for (const body of BODIES) expect(ids(body), body).toEqual(ids("web"))
    })

    for (const s of folded) {
      describe(s.id, () => {
        for (const body of BODIES) {
          it.skipIf(skipped(body))(`${body}: chosen from inside the disclosure, the same reply as unfolded`, async () => {
            const folded: Result = await DRIVERS[body](fx, s)
            const reference: Result = await DRIVERS[body](unfolded, s)
            const final = (r: Result) => r.after ?? r.before
            if (s.deliberate) {
              expect(folded.before, "the single act emits nothing").toEqual([])
              expect(folded.after).toEqual([s.expected])
            } else expect(folded.before).toEqual([s.expected])
            expect(final(folded), "same reply as without folding").toEqual(final(reference))
          })
        }
      })
    }

    it("web and switch: closed, the folded nodes are not rendered; the button is one target, closed, controlling a region", () => {
      for (const view of [<PlanView key="w" plan={plan} experience={fx.ir} onReply={() => {}} />, <SwitchExperience key="s" plan={planFor(fx.ir, "switch", DELEGATE)} experience={fx.ir} scan="step" onReply={() => {}} />]) {
        const { container, unmount } = render(view)
        const button = container.querySelector<HTMLElement>('[data-slot="experience-other-options"]')!
        expect(button.textContent).toBe("Other options")
        expect(button.getAttribute("aria-expanded")).toBe("false")
        expect(button.getAttribute("aria-controls")).toBeTruthy()
        for (const n of fx.ir.nodes.filter((n) => isCollapsed(plan, n.id))) expect(() => hostOf(container, n.id), n.id).toThrow()
        unmount()
      }
    })

    for (const body of ["text", "voice"] as const) {
      it.skipIf(skipped(body))(`${body}: browse leaves the folded content and acts out, and offers "Other options" last`, () => {
        const { talker } = body === "text" ? textTalker(fx) : voiceTalker(fx)
        const turn = talker.turn
        const hidden = new Set(fx.ir.nodes.filter((n) => isCollapsed(plan, n.id)).map((n) => n.id))
        for (const p of turn.parts) expect(hidden.has(p.node ?? ""), `"${p.text}" of a folded node was read`).toBe(false)
        for (const c of turn.choices) expect(hidden.has(c.node ?? ""), `${c.label} of a folded node is listed`).toBe(false)
        expect(turn.choices.at(-1)!.label).toBe("Other options")
        expect(turn.choices.filter((c) => c.label === "Other options")).toHaveLength(1)
      })
    }
  })
}
