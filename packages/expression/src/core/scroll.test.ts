import { afterEach, describe, expect, it, vi } from "vitest"
import { createClock } from "./clock"
import { connectScroll, LENIS_OPTIONS, scrollProgress, scrub } from "./scroll"
import { fakeFrames, mockMedia, REDUCED } from "../test/helpers"

function fakes() {
  const lenis = { raf: vi.fn(), destroy: vi.fn() }
  const create = vi.fn(() => lenis)
  const callbacks = new Set<(t: number, d: number, f: number) => void>()
  const gsap = { ticker: { lagSmoothing: vi.fn(), add: (cb: (t: number, d: number, f: number) => void) => callbacks.add(cb), remove: (cb: (t: number, d: number, f: number) => void) => callbacks.delete(cb) } }
  return { lenis, create, gsap, callbacks }
}

afterEach(() => mockMedia([]))

describe("connectScroll", () => {
  it("does nothing for native and css", () => {
    const clock = createClock(fakeFrames())
    expect(connectScroll({ kind: "native" }, clock).kind).toBe("native")
    expect(connectScroll({ kind: "css" }, clock).kind).toBe("css")
    expect(clock.size).toBe(0)
  })

  it("creates Lenis with LENIS_OPTIONS and drives it from the clock", () => {
    mockMedia([])
    const frames = fakeFrames()
    const clock = createClock(frames)
    const { lenis, create } = fakes()
    const c = connectScroll({ kind: "lenis", create }, clock)
    expect(create).toHaveBeenCalledWith(LENIS_OPTIONS)
    expect(c.kind).toBe("lenis")
    frames.flush(50)
    expect(lenis.raf).toHaveBeenCalledWith(50)
  })

  it("with GSAP: lagSmoothing(0), one loop (the ticker), and disconnect destroys", () => {
    mockMedia([])
    const frames = fakeFrames()
    const clock = createClock(frames)
    const { lenis, create, gsap, callbacks } = fakes()
    const c = connectScroll({ kind: "lenis", create, gsap }, clock)
    expect(gsap.ticker.lagSmoothing).toHaveBeenCalledWith(0)
    expect(frames.pending).toBe(0)
    for (const cb of callbacks) cb(1, 0.016, 1)
    expect(lenis.raf).toHaveBeenCalledWith(1000)
    c.disconnect()
    expect(lenis.destroy).toHaveBeenCalled()
    expect(callbacks.size).toBe(0)
    expect(clock.size).toBe(0)
  })

  it("is native under reduced motion and never creates Lenis", () => {
    mockMedia([REDUCED])
    const { create } = fakes()
    const c = connectScroll({ kind: "lenis", create }, createClock(fakeFrames()))
    expect(c.kind).toBe("native")
    expect(create).not.toHaveBeenCalled()
  })
})

describe("scrub", () => {
  it("reports progress now, and jumps under reduced motion", () => {
    mockMedia([REDUCED])
    const frames = fakeFrames()
    const clock = createClock(frames)
    const el = document.createElement("div")
    el.getBoundingClientRect = () => ({ top: 0, height: 1000 }) as DOMRect
    Object.defineProperty(window, "innerHeight", { value: 500, configurable: true })
    expect(scrollProgress(el)).toBeCloseTo(500 / 1500)
    const seen: number[] = []
    const off = scrub(el, (p) => seen.push(p), { on: clock })
    expect(seen).toHaveLength(1)
    el.getBoundingClientRect = () => ({ top: -500, height: 1000 }) as DOMRect
    window.dispatchEvent(new Event("scroll"))
    frames.flush(10)
    frames.flush(26)
    expect(seen.at(-1)).toBeCloseTo(1000 / 1500)
    off()
    expect(clock.size).toBe(0)
  })
})
