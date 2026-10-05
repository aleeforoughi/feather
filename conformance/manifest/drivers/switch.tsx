// The switch driver: SwitchExperience in step mode, operated ONLY by its next key (Tab) and select key (Enter). Typing a
// value goes to the field the highlight rests on (scanning pauses there), and Escape resumes scanning, as the contract
// says. No pointer, no click().
import { act, fireEvent, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import { SwitchExperience } from "@aleeforoughi/feather-manifest-switch"
import type { Fixture } from "../fixtures.ts"
import { isCollapsed, type Scenario } from "../scenarios.ts"
import { hostOf, otherOptions, scriptOf } from "./web.tsx"
import type { Step } from "./script.ts"
import type { Result } from "./types.ts"

const key = (k: string) => act(() => void fireEvent.keyDown(document.activeElement ?? document.body, { key: k }))
const isField = (el: Element | null) => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !["button", "checkbox", "radio", "submit", "reset"].includes(el.type))

/**
 * Presses "next" until the highlight rests on `el`. When the highlight rests on a text field, scanning is paused and
 * "next" does nothing; Escape resumes it (the contract), and the next "next" carries on.
 */
function reach(el: () => HTMLElement | null, what: string) {
  for (let i = 0; i < 80; i++) {
    const target = el()
    if (!target) throw new Error(`switch: ${what} is not in the page`)
    if (document.activeElement === target) return target
    const was = document.activeElement
    key("Tab")
    if (document.activeElement === was && isField(was)) key("Escape")
  }
  throw new Error(`switch: ${what} was never reached with next presses`)
}

export async function driveSwitch(fx: Fixture, s: Scenario): Promise<Result> {
  const { plan, script } = scriptOf(fx, "switch", s)
  const user = userEvent.setup()
  const replies: ReplyEvent[] = []
  const { container, unmount } = render(<SwitchExperience plan={plan} experience={fx.ir} scan="step" onReply={(r) => void replies.push(r)} />)
  // A switch user starts by focusing the scanner: keys are heard only inside the experience (manifestations.md §4).
  container.querySelector<HTMLElement>("[data-slot=switch-scanner]")?.focus()
  try {
    // The disclosure is one target; it is reached with next presses and opened with the select key.
    if (isCollapsed(plan, s.node)) {
      reach(() => otherOptions(container), "the Other options button")
      key("Enter")
    }
    const run = async (step: Step) => {
      const find = () => step.find(hostOf(container, s.node))
      await waitFor(() => {
        if (!find()) throw new Error(`switch: could not find ${step.what} in node "${s.node}"`)
      })
      if (step.kind === "press") {
        if (step.skip?.(find()!)) return
        reach(find, step.what)
        key("Enter")
      } else {
        const field = reach(find, step.what)
        await user.clear(field)
        await user.keyboard(step.text)
        key("Escape")
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
