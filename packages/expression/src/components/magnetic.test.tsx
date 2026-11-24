import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { clock } from "../core/clock"
import { Cursor, Magnetic } from "./magnetic"
import { mockMedia, REDUCED } from "../test/helpers"

afterEach(() => mockMedia([]))

describe("Magnetic", () => {
  it("wraps one child with a data-slot and pulls it for a fine pointer", () => {
    mockMedia(["pointer: fine"])
    const { container, unmount } = render(
      <Magnetic>
        <button type="button">Go</button>
      </Magnetic>,
    )
    const wrap = container.querySelector<HTMLElement>('[data-slot="magnetic"]')!
    expect(screen.getByRole("button", { name: "Go" }).parentElement).toBe(wrap)
    wrap.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
    act(() => void wrap.dispatchEvent(new MouseEvent("pointermove", { clientX: 100, clientY: 100 })))
    expect(clock.size).toBe(1)
    unmount()
    expect(clock.size).toBe(0)
  })

  it("does nothing for a coarse pointer or under reduced motion", () => {
    for (const media of [[], ["pointer: fine", REDUCED]]) {
      mockMedia(media)
      const { container, unmount } = render(
        <Magnetic>
          <button type="button">Go</button>
        </Magnetic>,
      )
      const wrap = container.querySelector('[data-slot="magnetic"]')!
      act(() => void wrap.dispatchEvent(new MouseEvent("pointermove", { clientX: 50, clientY: 50 })))
      expect(clock.size).toBe(0)
      unmount()
    }
  })
})

describe("Cursor", () => {
  it("is decorative, fixed, non-interactive, and never hides the native cursor", () => {
    mockMedia(["pointer: fine"])
    const { container, unmount } = render(<Cursor />)
    const el = container.querySelector<HTMLElement>('[data-slot="cursor"]')!
    expect(el.getAttribute("aria-hidden")).toBe("true")
    expect(el.className).toContain("pointer-events-none")
    expect(el.className).toContain("fixed")
    expect(el.className).not.toContain("cursor-none")
    expect(el.style.cursor).toBe("")
    act(() => void window.dispatchEvent(new MouseEvent("pointermove", { clientX: 5, clientY: 5 })))
    expect(el.dataset.state).toBe("active")
    unmount()
    expect(clock.size).toBe(0)
  })

  it("renders nothing for a coarse pointer or under reduced motion", () => {
    mockMedia([])
    expect(render(<Cursor />).container.querySelector('[data-slot="cursor"]')).toBeNull()
    mockMedia(["pointer: fine", REDUCED])
    expect(render(<Cursor />).container.querySelector('[data-slot="cursor"]')).toBeNull()
  })
})
