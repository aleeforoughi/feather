import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { clock } from "../core/clock"
import { ScrollProgress, ScrollProvider, useScroll } from "./scroll"
import { mockMedia, REDUCED } from "../test/helpers"

afterEach(() => mockMedia([]))

function Probe() {
  const { kind, lenis } = useScroll()
  return <p>{`${kind}:${lenis ? "lenis" : "none"}`}</p>
}

describe("ScrollProvider", () => {
  it("defaults to native outside a provider", () => {
    render(<Probe />)
    expect(screen.getByText("native:none")).toBeTruthy()
  })

  it("exposes the css engine", () => {
    render(
      <ScrollProvider engine={{ kind: "css" }}>
        <Probe />
      </ScrollProvider>,
    )
    expect(screen.getByText("css:none")).toBeTruthy()
  })

  it("creates one Lenis, exposes it, and destroys it on unmount", () => {
    const lenis = { raf: vi.fn(), destroy: vi.fn() }
    const create = vi.fn(() => lenis)
    const { unmount } = render(
      <ScrollProvider engine={{ kind: "lenis", create }}>
        <Probe />
      </ScrollProvider>,
    )
    expect(create).toHaveBeenCalledTimes(1)
    expect(screen.getByText("lenis:lenis")).toBeTruthy()
    expect(clock.size).toBe(1)
    unmount()
    expect(lenis.destroy).toHaveBeenCalled()
    expect(clock.size).toBe(0)
  })

  it("is native under reduced motion", () => {
    mockMedia([REDUCED])
    const create = vi.fn()
    render(
      <ScrollProvider engine={{ kind: "lenis", create }}>
        <Probe />
      </ScrollProvider>,
    )
    expect(create).not.toHaveBeenCalled()
    expect(screen.getByText("native:none")).toBeTruthy()
  })
})

describe("ScrollProgress", () => {
  it("is decorative and cleans up", () => {
    const { container, unmount } = render(<ScrollProgress />)
    const el = container.querySelector('[data-slot="scroll-progress"]')!
    expect(el.getAttribute("aria-hidden")).toBe("true")
    act(() => void window.dispatchEvent(new Event("scroll")))
    unmount()
    expect(clock.size).toBe(0)
  })
})
