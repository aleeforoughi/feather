import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clock } from "../core/clock"
import type { WorldFrame } from "../core/world"
import { World } from "./world"
import { mockMedia, REDUCED } from "../test/helpers"

const rafs: Array<(t: number) => void> = []
beforeEach(() => {
  rafs.length = 0
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => rafs.push(cb))
  vi.stubGlobal("cancelAnimationFrame", () => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  mockMedia([])
})
const flush = (t: number) => act(() => void rafs.splice(0).forEach((cb) => cb(t)))
const renderer = () => ({ frame: vi.fn<(f: WorldFrame) => boolean>(() => false), dispose: vi.fn(() => {}) })

describe("World", () => {
  it("is decorative, shows the still first, then the canvas after the first frame", () => {
    const r = renderer()
    const { container } = render(<World renderer={r} quality="medium" still={<i data-slot="s">still</i>} />)
    const root = container.querySelector('[data-slot="world"]')!
    expect(root.getAttribute("aria-hidden")).toBe("true")
    const canvas = container.querySelector('[data-slot="world-canvas"]')!
    expect(canvas.getAttribute("role")).toBe("presentation")
    expect(canvas.getAttribute("aria-hidden")).toBe("true")
    expect(root.getAttribute("data-state")).toBe("still")
    flush(1)
    expect(r.frame).toHaveBeenCalledTimes(1)
    expect(root.getAttribute("data-state")).toBe("ready")
    expect(root.getAttribute("data-variant")).toBe("medium")
  })

  it("an image still is lazy and never high priority", () => {
    const { container } = render(<World renderer={renderer()} quality="low" still="/x.jpg" />)
    const img = container.querySelector("img")!
    expect(img.getAttribute("fetchpriority")).toBeNull()
    expect(img.getAttribute("loading")).toBe("lazy")
    expect(img.getAttribute("alt")).toBe("")
  })

  it("disposes the renderer and leaves no subscriber on unmount", () => {
    const r = renderer()
    const { unmount } = render(<World renderer={r} quality="high" />)
    unmount()
    expect(r.dispose).toHaveBeenCalled()
    expect(clock.size).toBe(0)
  })

  it("is a still with no canvas under reduced motion", () => {
    mockMedia([REDUCED])
    const r = renderer()
    const { container } = render(<World renderer={r} quality="high" still={<i>still</i>} />)
    expect(container.querySelector('[data-slot="world-canvas"]')).toBeNull()
    expect(container.querySelector('[data-slot="world"]')!.getAttribute("data-variant")).toBe("static")
    flush(1)
    expect(r.frame).not.toHaveBeenCalled()
  })

  it("a device the capability gate turns away gets the still, visible and complete, never a blank frame", () => {
    // jsdom has no WebGL, so the gate declines the heavy tier here, as it would on a device without it.
    const r = renderer()
    const { container } = render(<World renderer={r} still={<p data-slot="poster">The studio at night</p>} />)
    flush(1)
    expect(container.querySelector('[data-slot="world-canvas"]')).toBeNull()
    expect(r.frame).not.toHaveBeenCalled()
    const still = container.querySelector('[data-slot="world-still"]')!
    expect(still.className).not.toContain("invisible")
    expect(still.textContent).toBe("The studio at night")
    expect(container.querySelector('[data-slot="world"]')!.getAttribute("data-variant")).toBe("static")
  })

  it("quality static never renders", () => {
    const r = renderer()
    const { container } = render(<World renderer={r} quality="static" still={<i>still</i>} />)
    expect(container.querySelector('[data-slot="world-canvas"]')).toBeNull()
    flush(1)
    expect(r.frame).not.toHaveBeenCalled()
  })

  it("paused stops drawing; resuming draws again", () => {
    const r = renderer()
    const { rerender } = render(<World renderer={r} quality="high" paused />)
    flush(1)
    expect(r.frame).not.toHaveBeenCalled()
    rerender(<World renderer={r} quality="high" />)
    flush(2)
    expect(r.frame).toHaveBeenCalledTimes(1)
  })
})
