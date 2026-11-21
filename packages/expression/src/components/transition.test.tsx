import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { PERSISTENT_SLOT } from "../core/transition"
import { PersistentSlot, TransitionProvider, useTransitions } from "./transition"

describe("TransitionProvider", () => {
  it("shares one transitions object: go runs the update after disposing", async () => {
    const user = userEvent.setup()
    const order: string[] = []
    function Page() {
      const t = useTransitions()
      return (
        <button
          type="button"
          onClick={() => {
            t.onLeave(() => order.push("leave"))
            void t.go(() => void order.push("update"))
          }}
        >
          go
        </button>
      )
    }
    render(
      <TransitionProvider>
        <Page />
      </TransitionProvider>,
    )
    await user.click(screen.getByRole("button"))
    await act(async () => {})
    expect(order).toEqual(["leave", "update"])
  })

  it("useTransitions outside a provider throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    function Bad() {
      useTransitions()
      return null
    }
    expect(() => render(<Bad />)).toThrow(/TransitionProvider/)
    spy.mockRestore()
  })
})

describe("PersistentSlot", () => {
  it("is a decorative fixed layer with the persistent view-transition-name", () => {
    const { container } = render(<PersistentSlot>x</PersistentSlot>)
    const el = container.querySelector<HTMLElement>('[data-slot="persistent-slot"]')!
    expect(el.getAttribute("aria-hidden")).toBe("true")
    expect(el.className).toContain("fixed")
    expect(el.style.viewTransitionName).toBe(PERSISTENT_SLOT)
  })
})
