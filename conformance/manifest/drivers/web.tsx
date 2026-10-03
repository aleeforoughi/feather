// The web driver: PlanView, rendered with Testing Library, clicked and typed into with user-event.
import { render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import { PlanView } from "@aleeforoughi/feather-manifest-web"
import { planFor, type Fixture } from "../fixtures.ts"
import { irNodesOf, type Scenario } from "../scenarios.ts"
import { scriptFor, type Step } from "./script.ts"
import type { Result } from "./types.ts"

export function hostOf(container: HTMLElement, node: string): HTMLElement {
  const host = Array.from(container.querySelectorAll<HTMLElement>("[data-feather-node]")).find((el) => el.getAttribute("data-feather-node") === node)
  if (!host) throw new Error(`no element with data-feather-node="${node}" in what was rendered`)
  return host
}

export function scriptOf(fx: Fixture, body: "web" | "switch", s: Scenario) {
  const plan = planFor(fx.ir, body)
  const irs = irNodesOf(plan)
  const ir = irs.get(s.node)!
  const predicted = ir.type === "PredictedChoice" ? irs.get(ir.of) : undefined
  const predictedOptions = predicted?.type === "Choice" ? predicted.options.map((o) => o.id) : []
  return { plan, script: scriptFor(ir, s, { predictedOptions }) }
}

export async function driveWeb(fx: Fixture, s: Scenario): Promise<Result> {
  const { plan, script } = scriptOf(fx, "web", s)
  const user = userEvent.setup()
  const replies: ReplyEvent[] = []
  const { container, unmount } = render(<PlanView plan={plan} experience={fx.ir} onReply={(r) => void replies.push(r)} />)
  try {
    const run = async (step: Step) => {
      // A control may appear a moment after the act that opens it (a menu), so it is waited for.
      const el = await waitFor(() => {
        const found = step.find(hostOf(container, s.node))
        if (!found) throw new Error(`web: could not find ${step.what} in node "${s.node}"`)
        return found
      })
      if (step.kind === "press") {
        if (step.skip?.(el)) return
        await user.click(el)
      } else {
        await user.clear(el)
        await user.type(el, step.text)
      }
    }
    for (const step of script.act) await run(step)
    const before = [...replies]
    if (script.deliberate.length === 0) return { before, after: null }
    for (const step of script.deliberate) await run(step)
    return { before, after: [...replies] }
  } finally {
    unmount()
  }
}
