// The L4 exit test (docs/manifestations.md section 5). Every valid fixture is composed for every body, then every
// available act is driven through each body its own way, and the replies must be the same, with a deliberate step
// wherever the plan asks for one. Nothing here works around a body: if a body is wrong, a test fails.
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, describe, expect, it } from "vitest"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import { renderTurn } from "@aleeforoughi/feather-manifest-text"
import { PlanView } from "@aleeforoughi/feather-manifest-web"
import { SwitchExperience } from "@aleeforoughi/feather-manifest-switch"
import { BODIES, FIXTURES as SHARED, planFor, type Body, type Fixture } from "./fixtures.ts"
import { attack, type Armed } from "./attack.ts"
import { offersOf, planNodeOf, scenariosOf, type Scenario } from "./scenarios.ts"
import { driveSwitch } from "./drivers/switch.tsx"
import { driveText, numberPhrase, textTalker } from "./drivers/talk.ts"
import { driveVoice, voice, voiceExists, voiceTalker } from "./drivers/voice.ts"
import { driveWeb, hostOf } from "./drivers/web.tsx"
import type { Result } from "./drivers/types.ts"
import { SYNTHETIC } from "./synthetic.ts"

/** The valid fixtures of conformance/ir, then the synthetic ones that cover what they leave untried. */
const FIXTURES = [...SHARED, ...SYNTHETIC]

const tally = { fixtures: FIXTURES.length, shared: SHARED.length, scenarios: 0, drives: 0, assertions: 0, tests: 0 }
/** An assertion that is counted. */
function eq(actual: unknown, expected: unknown, message: string) {
  tally.assertions++
  expect(actual, message).toEqual(expected)
}
function truth(value: boolean, message: string) {
  tally.assertions++
  expect(value, message).toBe(true)
}
afterAll(() => {
  console.log(`\nL4 conformance: ${tally.fixtures} fixtures (${tally.shared} shared, ${tally.fixtures - tally.shared} synthetic), ${tally.scenarios} scenarios, ${tally.drives} body drives, ${tally.assertions} assertions\n`)
})

const DRIVERS: Record<Body, (fx: Fixture, s: Scenario) => Result | Promise<Result>> = { web: driveWeb, switch: driveSwitch, text: driveText, voice: driveVoice }
const skipped = (body: Body) => body === "voice" && !voiceExists
const pretty = (replies: ReplyEvent[] | null) => JSON.stringify(replies)

/** The scenarios of a fixture, derived from the web plan (the other bodies' acts are checked to be the same). */
function scenarios(fx: Fixture): Scenario[] {
  return scenariosOf(fx.name, fx.ir, planFor(fx.ir, "web"))
}

const CONFIRMING = (fx: Fixture) => scenarios(fx).filter((s) => s.deliberate && !s.backOut)
const nodesWithConsequence = (fx: Fixture) => fx.ir.nodes.filter((n) => "consequence" in n && n.consequence)

// ── (c) Every fixture renders, or produces a first turn, in all four bodies; every node in plan.order is there ─────────
describe("rendering: every fixture, every body, every node", () => {
  for (const fx of FIXTURES) {
    for (const body of BODIES) {
      it.skipIf(skipped(body))(`${fx.name} in ${body}`, () => {
        tally.tests++
        const plan = planFor(fx.ir, body)
        // A collapsed plan (L6) has no nodes: it is the resolution, checked in lifecycle.test.tsx.
        truth(plan.lifecycle === "collapsed" || plan.order.length > 0, `${fx.name}: the plan has nodes`)
        if (body === "web" || body === "switch") {
          const view = body === "web" ? <PlanView plan={plan} experience={fx.ir} onReply={() => {}} /> : <SwitchExperience plan={plan} experience={fx.ir} scan="step" onReply={() => {}} />
          const { container, unmount } = render(view)
          for (const id of plan.order) {
            let found = true
            try {
              hostOf(container, id)
            } catch {
              found = false
            }
            truth(found, `${fx.name}/${body}: node "${id}" of plan.order is not rendered`)
          }
          unmount()
          return
        }
        const { talker } = body === "text" ? textTalker(fx) : voiceTalker(fx)
        const turn = talker.turn
        const said = new Set(turn.parts.map((p) => p.node).filter((n): n is string => n !== undefined))
        for (const id of plan.order) truth(said.has(id), `${fx.name}/${body}: node "${id}" of plan.order is not in the first turn`)
        // What the body then presents is a real string, with every content and consequence part in it.
        if (body === "text") {
          const out = renderTurn(turn, { width: 100000 }).replace(/\s+/g, " ")
          for (const p of turn.parts.filter((x) => x.kind === "content" || x.kind === "consequence")) truth(out.includes(p.text.replace(/\s+/g, " ")), `${fx.name}/text: renderTurn left out "${p.text}"`)
        } else {
          const speech = voice!.speechFor(turn, plan)
          truth(speech.length > 0, `${fx.name}/voice: the first turn is spoken`)
        }
      })
    }
  }
})

// ── The available acts are the same in the four plans ────────────────────────────────────────────────────────────────
describe("the available acts agree across the four bodies' plans", () => {
  for (const fx of FIXTURES) {
    it(fx.name, () => {
      tally.tests++
      const reference = offersOf(planFor(fx.ir, "web"))
      for (const body of BODIES) {
        if (skipped(body)) continue
        eq(offersOf(planFor(fx.ir, body)), reference, `${fx.name}: the acts (node, act, whether it is deliberate) the ${body} plan offers differ from web's`)
      }
    })
  }
})

// ── (e) What a consequence says is the same everywhere (section 1, Words) ──────────────────────────────────────────────
describe("a consequence reads the same on web, in text and in voice", () => {
  for (const fx of FIXTURES.filter((f) => nodesWithConsequence(f).length > 0)) {
    it(fx.name, () => {
      tally.tests++
      const { container, unmount } = render(<PlanView plan={planFor(fx.ir, "web")} experience={fx.ir} onReply={() => {}} />)
      const first = (body: "text" | "voice") => (body === "text" ? textTalker(fx) : voiceTalker(fx)).talker.turn.parts
      for (const node of nodesWithConsequence(fx)) {
        const web = Array.from(hostOf(container, node.id).querySelectorAll('[data-slot="consequence-statement-item"]')).map((el) => el.textContent)
        const spoken = (parts: ReturnType<typeof first>) => parts.filter((p) => p.kind === "consequence" && p.node === node.id).map((p) => p.text)
        eq(spoken(first("text")), web, `${fx.name}/${node.id}: text says the consequence differently from the web organism`)
        if (voiceExists) eq(spoken(first("voice")), web, `${fx.name}/${node.id}: voice says the consequence differently from the web organism`)
      }
      unmount()
    })
  }
})

// ── (a) and (b): every fixture × scenario × body ────────────────────────────────────────────────────────────────────
for (const fx of FIXTURES) {
  describe(`${fx.name}`, () => {
    let list: Scenario[] = []
    let problem: Error | undefined
    try {
      list = scenarios(fx)
    } catch (e) {
      problem = e as Error
    }
    it("has scenarios derived without error", () => {
      tally.tests++
      expect(problem?.message).toBeUndefined()
    })
    tally.scenarios += list.length

    for (const s of list) {
      describe(s.id, () => {
        const results = new Map<Body, Result | Error>()
        for (const body of BODIES) {
          it.skipIf(skipped(body))(`${body}: ${s.deliberate ? "the single act emits nothing, the deliberate step emits the reply" : "emits the reply"}`, async () => {
            tally.tests++
            tally.drives++
            let result: Result
            try {
              result = await DRIVERS[body](fx, s)
            } catch (e) {
              results.set(body, e as Error)
              throw e
            }
            results.set(body, result)
            const where = `${fx.name} ${s.node}.${s.act} on ${body}`
            if (s.deliberate) {
              eq(result.before, [], `${where}: the single act must emit nothing (it emitted ${pretty(result.before)})`)
              eq(result.after, [s.expected], `${where}: after the deliberate step`)
            } else {
              eq(result.before, [s.expected], `${where}: after the single act`)
            }
          })
        }
        it("the reply is identical in all four bodies", () => {
          tally.tests++
          const final = (r: Result) => r.after ?? r.before
          const reference = results.get("web")
          for (const body of BODIES) {
            if (skipped(body)) continue
            const r = results.get(body)
            if (r === undefined || r instanceof Error) {
              tally.assertions++
              throw new Error(`${fx.name} ${s.node}.${s.act}: ${body} produced no reply to compare${r ? ` (${r.message})` : ""}`)
            }
            if (!reference || reference instanceof Error) throw new Error(`${fx.name} ${s.node}.${s.act}: web produced no reply to compare against`)
            eq(final(r), final(reference), `${fx.name} ${s.node}.${s.act}: ${body} replied differently from web`)
          }
        })
      })
    }
  })
}

// ── (d) An armed act is not committed by anything but its keyword, in text and in voice ─────────────────────────────
describe("adversarial: only the keyword commits an armed act", () => {
  for (const fx of FIXTURES) {
    for (const s of CONFIRMING(fx)) {
      for (const body of ["text", "voice"] as const) {
        it.skipIf(skipped(body))(`${fx.name} ${s.node}.${s.act} in ${body}`, () => {
          tally.tests++
          // Arms with the act's own number on a fresh body.
          const arm = (): Armed => {
            const { plan, talker } = body === "text" ? textTalker(fx) : voiceTalker(fx)
            const choice = talker.turn.choices.find((c) => c.node === s.node && c.act === s.act)
            if (!choice) throw new Error(`${body}: no "${s.act}" on "${s.node}"`)
            const replies = talker.say(numberPhrase(choice.n, body))
            return { talker, replies, label: choice.label, keyword: planNodeOf(plan, s.node)!.keyword! }
          }
          eq(attack(arm, s.expected, body === "voice"), [], `${fx.name}/${body}: ${s.node}.${s.act} was not held by its keyword`)
        })
      }
    }
  }
})

// ── Forms: what the web markup contract promises beyond the replies (docs/manifestations.md section 5) ───────────────────
describe("a form on the web: errors, the skip control and the sent status", () => {
  const form = (name: string) => FIXTURES.find((f) => f.name === name)!
  const mount = (name: string, replies: ReplyEvent[]) => {
    const fx = form(name)
    return render(<PlanView plan={planFor(fx.ir, "web")} experience={fx.ir} onReply={(r) => void replies.push(r)} />)
  }
  const slot = (root: HTMLElement, name: string) => root.querySelector<HTMLElement>(`[data-slot="${name}"]`)

  it("offers skip only when no field is required", () => {
    const a = mount("shipping-address-form", [])
    truth(slot(a.container, "form-group-skip") === null, "shipping-address-form has a required field, so it has no skip control")
    a.unmount()
    const b = mount("poster-details-form", [])
    truth(slot(b.container, "form-group-skip") !== null, "poster-details-form has no required field, so it has a skip control")
    b.unmount()
  })

  it("sends nothing and says what is wrong when a required field is empty", async () => {
    const replies: ReplyEvent[] = []
    const { container, unmount } = mount("shipping-address-form", replies)
    await userEvent.setup().click(slot(container, "form-group-submit")!)
    eq(replies, [], "a form with an empty required field must not send")
    truth(container.querySelectorAll('[data-slot="form-group-error"]').length > 0, "an empty required field shows a form-group-error")
    unmount()
  })

  it("sends nothing for an answer that does not fit its kind", async () => {
    const replies: ReplyEvent[] = []
    const { container, unmount } = mount("poster-details-form", replies)
    const user = userEvent.setup()
    const email = container.querySelector<HTMLElement>('[data-slot="form-group-field"][data-field-id="contact"] [data-slot="form-group-control"]')!
    await user.type(email, "not an email")
    await user.click(slot(container, "form-group-submit")!)
    eq(replies, [], "an invalid email must not be sent")
    truth(container.querySelectorAll('[data-slot="form-group-error"]').length > 0, "an invalid email shows a form-group-error")
    unmount()
  })

  it("shows the sent status after the one reply", async () => {
    const replies: ReplyEvent[] = []
    const { container, unmount } = mount("poster-details-form", replies)
    const user = userEvent.setup()
    await user.type(container.querySelector<HTMLElement>('[data-slot="form-group-field"][data-field-id="market_time"] [data-slot="form-group-control"]')!, "9am")
    await user.click(slot(container, "form-group-submit")!)
    eq(replies.length, 1, "one reply for the whole form")
    truth(slot(container, "form-group-status") !== null, "after sending, a form-group-status says so")
    unmount()
  })
})
