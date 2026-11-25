import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { clock } from "../core/clock"
import { Cursor, Magnetic } from "./magnetic"
import { mockMedia, REDUCED } from "../test/helpers"

beforeEach(() => document.documentElement.style.setProperty("--loudness", "2"))
afterEach(() => {
  mockMedia([])
  document.documentElement.style.removeProperty("--loudness")
  document.body.innerHTML = ""
})

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

  it("renders nothing below loudness 2", () => {
    mockMedia(["pointer: fine"])
    document.documentElement.style.setProperty("--loudness", "1")
    expect(render(<Cursor />).container.querySelector('[data-slot="cursor"]')).toBeNull()
  })

  it("grows and labels itself over data-cursor elements, ignores fields, and the element keeps its own name", () => {
    mockMedia(["pointer: fine"])
    const { container } = render(
      <div>
        <Cursor />
        <a href="/work" data-cursor="view" aria-label="Open the Aria case study">
          <span data-testid="inner">Aria</span>
        </a>
        <a href="/reel" data-cursor="play" data-cursor-label="Watch reel">
          Reel
        </a>
        <input data-cursor="view" aria-label="Email" />
        <div data-testid="plain" />
      </div>,
    )
    const el = container.querySelector<HTMLElement>('[data-slot="cursor"]')!
    const label = container.querySelector<HTMLElement>('[data-slot="cursor-label"]')!
    const over = (node: Element) => act(() => void node.dispatchEvent(new MouseEvent("pointerover", { bubbles: true })))
    over(screen.getByTestId("inner"))
    expect(el.dataset.cursor).toBe("view")
    expect(label.textContent).toBe("View")
    expect(el.getAttribute("aria-hidden")).toBe("true")
    expect(screen.getByRole("link", { name: "Open the Aria case study" })).toBeTruthy()
    over(screen.getByText("Reel"))
    expect(el.dataset.cursor).toBe("play")
    expect(label.textContent).toBe("Watch reel")
    over(screen.getByRole("textbox", { name: "Email" }))
    expect(el.dataset.cursor).toBeUndefined()
    expect(label.textContent).toBe("")
    over(screen.getByTestId("inner"))
    over(screen.getByTestId("plain"))
    expect(el.dataset.cursor).toBeUndefined()
  })
})
