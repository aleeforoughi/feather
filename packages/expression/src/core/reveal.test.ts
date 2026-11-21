import { afterEach, describe, expect, it, vi } from "vitest"
import { reveal, revealKeyframes } from "./reveal"

afterEach(() => vi.unstubAllGlobals())

describe("revealKeyframes", () => {
  it("starts hidden and offset when the element enters later", () => {
    const f = revealKeyframes("rise", 32, "full", false)!
    expect(f[0]).toMatchObject({ opacity: 0, transform: "translateY(32px)" })
    expect(f[1]).toMatchObject({ opacity: 1, transform: "none" })
  })
  it("never starts at opacity 0 when visible at mount (LCP-safe)", () => {
    for (const from of ["rise", "mask", "fade"] as const) {
      const f = revealKeyframes(from, 32, "full", true)
      for (const frame of f ?? []) expect(frame.opacity === undefined || frame.opacity === 1).toBe(true)
    }
  })
  it("never scales (no scale from 0)", () => {
    for (const from of ["rise", "mask", "fade"] as const) for (const visible of [true, false]) expect(JSON.stringify(revealKeyframes(from, 32, "full", visible))).not.toContain("scale")
  })
  it("is a plain fade under reduced motion, and nothing when already visible", () => {
    expect(revealKeyframes("rise", 32, "fade", false)).toEqual([{ opacity: 0 }, { opacity: 1 }])
    expect(revealKeyframes("rise", 32, "fade", true)).toBeNull()
    expect(revealKeyframes("rise", 32, "none", false)).toBeNull()
  })
  it("a mask wipes with clip-path and a fade over visible has no frames", () => {
    expect(revealKeyframes("mask", 32, "full", false)![0].clipPath).toBe("inset(0 0 100% 0)")
    expect(revealKeyframes("fade", 32, "full", true)).toBeNull()
  })
})

describe("reveal", () => {
  it("shows the element at once without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined)
    const el = document.createElement("div")
    const onReveal = vi.fn()
    reveal(el, { onReveal })
    expect(onReveal).toHaveBeenCalled()
    expect(el.style.opacity).toBe("")
  })
  it("hides an element that is out of view and restores it on cleanup", () => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} })
    const el = document.createElement("div")
    el.getBoundingClientRect = () => ({ top: 5000, bottom: 5100, left: 0, right: 100, width: 100, height: 100, x: 0, y: 5000, toJSON() {} })
    const cleanup = reveal(el)
    expect(el.style.opacity).toBe("0")
    cleanup()
    expect(el.style.opacity).toBe("")
  })
})
