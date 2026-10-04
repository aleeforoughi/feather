// The harness tested against bodies that are wrong on purpose: a test that cannot fail proves nothing.
import { describe, expect, it } from "vitest"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import { createDialog, type Turn } from "@aleeforoughi/feather-dialog"
import { attack, type Armed } from "./attack.ts"
import { driveTalk, type Talker } from "./drivers/talk.ts"
import { FIXTURES, planFor } from "./fixtures.ts"
import { scenariosOf } from "./scenarios.ts"

const reply: ReplyEvent = { experience: "x", node: "go", act: "confirm" }
const turn = (state: Turn["state"]): Turn => ({ state, parts: [], choices: [] })

/** An armed body whose commit rule is `commits(input)`. */
function body(commits: (input: string) => boolean, emitsOnArm = false): () => Armed {
  return () => {
    let state: Turn["state"] = "confirm"
    const talker: Talker = {
      get turn() {
        return turn(state)
      },
      say(input) {
        if (commits(input)) {
          state = "done"
          return [reply]
        }
        return []
      },
    }
    return { talker, replies: emitsOnArm ? [reply] : [], label: "Confirm spend", keyword: "confirm" }
  }
}

describe("the adversarial check", () => {
  it("passes a body that commits on the keyword only", () => {
    expect(attack(body((i) => i === "confirm"), reply, false)).toEqual([])
  })
  for (const word of ["yes", "1", "y", "Confirm spend", "confirm please", "confir", "confirms"]) {
    it(`catches a body that also commits on ${JSON.stringify(word)}`, () => {
      expect(attack(body((i) => i === "confirm" || i === word), reply, false).length).toBeGreaterThan(0)
    })
  }
  it("catches a body that emits on arming", () => {
    expect(attack(body((i) => i === "confirm", true), reply, false).length).toBeGreaterThan(0)
  })
})

describe("the driver", () => {
  const fx = FIXTURES.find((f) => f.name === "ad-campaign-launch")!
  const plan = planFor(fx.ir, "text")
  const scenario = scenariosOf(fx.name, fx.ir, planFor(fx.ir, "web")).find((s) => s.node === "go" && s.act === "confirm")!
  /** A talker that commits straight away, without the deliberate step. */
  const eager: Talker = { turn: { state: "browse", parts: [], choices: [{ n: 1, label: "Confirm spend", words: [], node: "go", act: "confirm" }] }, say: () => [scenario.expected] }

  it("shows a body that commits on the single act: `before` is not empty", () => {
    expect(driveTalk(eager, plan, scenario, "text").before).toEqual([scenario.expected])
  })
  it("throws when the body does not offer the act", () => {
    const mute: Talker = { turn: { state: "browse", parts: [], choices: [] }, say: () => [] }
    expect(() => driveTalk(mute, plan, scenario, "text")).toThrow(/offers no "confirm"/)
  })
})

describe("the form driver", () => {
  const fx = FIXTURES.find((f) => f.name === "shipping-address-form")!
  const plan = planFor(fx.ir, "text")
  const scenario = scenariosOf(fx.name, fx.ir, planFor(fx.ir, "web")).find((s) => s.id === "address.submit")!
  const real = () => {
    const dialog = createDialog(plan, { experience: fx.ir })
    return { get turn() { return dialog.turn }, say: (l: string) => dialog.answer(l).replies } satisfies Talker
  }

  it("passes the real engine: one reply, only after the send", () => {
    expect(driveTalk(real(), plan, scenario, "text").before).toEqual([scenario.expected])
  })
  it("throws for a body that sends field by field", () => {
    const inner = real()
    const eager: Talker = { get turn() { return inner.turn }, say: (l) => (inner.say(l), l === "Answer for name" ? [scenario.expected] : []) }
    expect(() => driveTalk(eager, plan, scenario, "text")).toThrow(/before it was sent/)
  })
  it("throws for a body that asks the questions in another order", () => {
    const inner = real()
    const swapped: Talker = {
      get turn() {
        const t = inner.turn
        return { ...t, parts: t.parts.map((p) => ({ ...p, text: p.text.replace("Full name", "City") })) }
      },
      say: inner.say,
    }
    expect(() => driveTalk(swapped, plan, scenario, "text")).toThrow(/should ask "Full name"/)
  })
  it("throws for a body that leaves a field out of the read-back", () => {
    const inner = real()
    const lossy: Talker = {
      get turn() {
        const t = inner.turn
        return t.state === "review" ? { ...t, parts: t.parts.filter((p) => !p.text.includes("City")) } : t
      },
      say: inner.say,
    }
    expect(() => driveTalk(lossy, plan, scenario, "text")).toThrow(/leaves out "City"/)
  })
})
