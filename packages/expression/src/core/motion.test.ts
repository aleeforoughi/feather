import { afterEach, describe, expect, it, vi } from "vitest"
import { HOUSE, mediaScale, ms, parseBezier, prefersReducedMotion, roleMotion, staggerDelays, staggerStep } from "./motion"

const mockReduced = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }))

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute("data-motion")
  document.documentElement.style.cssText = ""
})

describe("staggerDelays", () => {
  it("is empty for no items and zero for one", () => {
    expect(staggerDelays(0, 40, 700)).toEqual([])
    expect(staggerDelays(1, 40, 700)).toEqual([0])
  })
  it("keeps the step when the sequence fits", () => {
    expect(staggerDelays(5, 40, 700)).toEqual([0, 40, 80, 120, 160])
  })
  it("compresses so the last item ends within 1200ms", () => {
    const delays = staggerDelays(200, 40, 700)
    expect(delays[0]).toBe(0)
    expect(delays.at(-1)! + 700).toBeLessThanOrEqual(1200)
    expect(delays.at(-1)).toBeGreaterThan(0)
  })
  it("never grows the step and stays non-decreasing", () => {
    const delays = staggerDelays(10, 40, 700)
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i] - delays[i - 1]).toBeLessThanOrEqual(40)
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1])
    }
  })
  it("collapses to all zero when the duration alone passes the cap", () => {
    expect(staggerDelays(4, 40, 2000)).toEqual([0, 0, 0, 0])
  })
})

describe("roleMotion", () => {
  it("is the full house motion when motion is allowed", () => {
    mockReduced(false)
    const m = roleMotion("reveal")
    expect(m.mode).toBe("full")
    expect(m.duration).toBe(HOUSE.duration.reveal)
    expect(m.easing).toBe("cubic-bezier(0.19, 1, 0.22, 1)")
  })
  it("reads the theme's duration and curve", () => {
    mockReduced(false)
    document.documentElement.style.setProperty("--duration-media", "1.2s")
    document.documentElement.style.setProperty("--ease-signature", "cubic-bezier(0.4, 0, 0.2, 1)")
    const m = roleMotion("media")
    expect(m.duration).toBe(1200)
    expect(m.easing).toBe("cubic-bezier(0.4, 0, 0.2, 1)")
  })
  it("becomes the 150ms fade under reduced motion for reveal, media and scene", () => {
    mockReduced(true)
    for (const role of ["reveal", "media", "scene"] as const) expect(roleMotion(role)).toMatchObject({ mode: "fade", duration: 150, easing: "linear" })
  })
  it("becomes nothing for hoverOut under reduced motion", () => {
    mockReduced(true)
    expect(roleMotion("hoverOut")).toMatchObject({ mode: "none", duration: 0 })
  })
  it("honours a data-motion=reduced ancestor", () => {
    mockReduced(false)
    const host = document.createElement("div")
    host.setAttribute("data-motion", "reduced")
    const child = document.createElement("span")
    host.append(child)
    document.body.append(host)
    expect(prefersReducedMotion(child)).toBe(true)
    expect(roleMotion("reveal", child).mode).toBe("fade")
    host.remove()
  })
})

describe("stagger and scale", () => {
  it("staggerStep is the house step, and 0 under reduced motion", () => {
    mockReduced(false)
    expect(staggerStep("word")).toBe(40)
    expect(staggerStep("block")).toBe(100)
    mockReduced(true)
    expect(staggerStep("word")).toBe(0)
  })
  it("mediaScale is above 1 and never 0", () => {
    expect(mediaScale()).toBeGreaterThan(1)
  })
})

describe("parsers", () => {
  it("ms reads ms and s", () => {
    expect(ms("700ms")).toBe(700)
    expect(ms("0.7s")).toBe(700)
    expect(ms("fast")).toBeNull()
    expect(ms(null)).toBeNull()
  })
  it("parseBezier reads four numbers", () => {
    expect(parseBezier("cubic-bezier(0.19, 1, 0.22, 1)")).toEqual([0.19, 1, 0.22, 1])
    expect(parseBezier("ease")).toBeNull()
  })
})
