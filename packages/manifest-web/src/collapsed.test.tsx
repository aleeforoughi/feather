// Collapsed secondary nodes: one "Other options" disclosure, closed at first render (docs/composer.md, "Rendering on the web").
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { compose, REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { FeatherExperience, planNodes } from "./index"
import { failOnConsole, fixture } from "./test/fixtures"

const delegate: RenderContext = { ...REFERENCE_CONTEXTS.phone.context, persona: { autonomy: "delegate" } }
const view = (context: RenderContext, onReply = vi.fn()) => render(<FeatherExperience experience={fixture("flight-search-tradeoff")} context={context} onReply={onReply} />)
const button = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-slot="experience-other-options"]')
const hosts = (c: HTMLElement) => Array.from(c.querySelectorAll("[data-feather-node]"), (el) => el.getAttribute("data-feather-node"))

describe("collapsed nodes", () => {
  failOnConsole()

  it("renders one closed disclosure after the rest of the secondary region, with nothing inside rendered", () => {
    const composed = compose(fixture("flight-search-tradeoff"), delegate)
    if (!composed.ok) throw new Error("invalid")
    const folded = planNodes(composed.plan).filter((n) => n.node && composed.plan.regions[1]?.nodes.some((t) => t.collapsed === true && planNodes({ ...composed.plan, regions: [{ ...composed.plan.regions[1]!, nodes: [t] }] }).includes(n)))
    expect(folded.length).toBeGreaterThan(0)
    const { container } = view(delegate)
    const b = button(container)!
    expect(container.querySelectorAll('[data-slot="experience-other-options"]')).toHaveLength(1)
    expect(b.textContent).toBe("Other options")
    expect(b.getAttribute("aria-expanded")).toBe("false")
    expect(b.getAttribute("aria-controls")).toBeTruthy()
    expect(b.closest('[data-slot="experience-region"]')?.getAttribute("data-variant")).toBe("secondary")
    for (const n of folded) expect(hosts(container)).not.toContain(n.node!.id)
    expect(container.querySelector('[data-slot="experience-other-content"]')).toBeNull()
  })

  it("opens on click: no reply, the nodes appear in plan order inside the region the button controls, and it stays open", async () => {
    const onReply = vi.fn()
    const { container } = view(delegate, onReply)
    const user = userEvent.setup()
    await user.click(button(container)!)
    expect(onReply).not.toHaveBeenCalled()
    const b = button(container)!
    expect(b.getAttribute("aria-expanded")).toBe("true")
    const content = container.querySelector<HTMLElement>('[data-slot="experience-other-content"]')!
    expect(content.id).toBe(b.getAttribute("aria-controls"))
    const inside = Array.from(content.querySelectorAll("[data-feather-node]"), (el) => el.getAttribute("data-feather-node"))
    expect(inside).toEqual(expect.arrayContaining(["alt_early", "alt_budget"]))
    expect(inside.indexOf("alt_early")).toBeLessThan(inside.indexOf("alt_budget"))
    await user.click(b)
    expect(button(container)!.getAttribute("aria-expanded")).toBe("true")
    expect(content.isConnected).toBe(true)
    // An act inside is still a checked reply.
    await user.click(screen.getByRole("button", { name: /budget/i }))
    expect(onReply).toHaveBeenCalledTimes(1)
    expect(onReply.mock.calls[0]![0]).toMatchObject({ node: "alt_budget", act: "choose" })
  })

  it("is absent when nothing is collapsed", () => {
    const { container } = view(REFERENCE_CONTEXTS.phone.context)
    expect(button(container)).toBeNull()
    expect(hosts(container)).toContain("alt_early")
  })
})
