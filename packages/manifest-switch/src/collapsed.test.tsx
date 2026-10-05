// Collapsed nodes under scanning: the "Other options" button is one target; once it is selected, the nodes inside become
// targets in plan order (docs/manifestations.md section 4).
import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { FeatherSwitchExperience } from "./index"
import { failOnConsole, fixture } from "./test/fixtures"

const context: RenderContext = { capability: { input: { switch: true } }, persona: { autonomy: "delegate" } }

const press = (key: string) => {
  if (!document.activeElement || document.activeElement === document.body) (document.querySelector("[data-slot=switch-scanner]") as HTMLElement | null)?.focus()
  fireEvent.keyDown(document.activeElement ?? document.body, { key })
}
/** The controls "next" visits in one lap, by what is highlighted each time. */
function lap(): HTMLElement[] {
  const seen: HTMLElement[] = []
  for (let i = 0; i < 40; i++) {
    press("Tab")
    const el = document.activeElement as HTMLElement
    if (seen.includes(el)) break
    seen.push(el)
  }
  return seen
}

describe("collapsed nodes with a switch", () => {
  failOnConsole()

  it("the closed disclosure is one target, and the nodes inside become targets, in order, once it is selected", () => {
    const onReply = vi.fn()
    const { container } = render(<FeatherSwitchExperience experience={fixture("flight-search-tradeoff")} context={context} scan="step" onReply={onReply} />)
    const closed = lap()
    const other = container.querySelector<HTMLElement>('[data-slot="experience-other-options"]')!
    expect(closed.filter((el) => el === other)).toHaveLength(1)
    expect(container.querySelector('[data-feather-node="alt_early"]')).toBeNull()
    expect(closed.some((el) => el.closest('[data-feather-node="alt_early"]'))).toBe(false)

    // Reach the button and select it: nothing is emitted, and the highlight stays on it.
    for (let i = 0; i < 40 && document.activeElement !== other; i++) press("Tab")
    expect(document.activeElement).toBe(other)
    press("Enter")
    expect(onReply).not.toHaveBeenCalled()
    expect(other.getAttribute("aria-expanded")).toBe("true")

    const open = lap()
    const owner = (el: HTMLElement) => el.closest("[data-feather-node]")?.getAttribute("data-feather-node")
    const early = open.findIndex((el) => owner(el) === "alt_early" || el.closest('[data-feather-node="alt_early"]'))
    const budget = open.findIndex((el) => el.closest('[data-feather-node="alt_budget"]'))
    expect(early).toBeGreaterThan(-1)
    expect(budget).toBeGreaterThan(early)
    // The button stays a target: nothing needs it to close.
    expect(open).toContain(other)
  })
})
