import { describe, expect, it } from "vitest"
import { bezierEasing } from "./easing"
import { HOUSE } from "./motion"

describe("bezierEasing", () => {
  const ease = bezierEasing(HOUSE.ease)
  it("starts at 0 and ends at 1, clamping outside", () => {
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(-1)).toBe(0)
    expect(ease(2)).toBe(1)
  })
  it("is monotonic for the house curve", () => {
    let last = 0
    for (let i = 1; i <= 100; i++) {
      const y = ease(i / 100)
      expect(y).toBeGreaterThanOrEqual(last - 1e-9)
      last = y
    }
  })
  it("expo-out is fast early", () => {
    expect(ease(0.2)).toBeGreaterThan(0.5)
  })
  it("a linear bezier is the identity", () => {
    const linear = bezierEasing([0, 0, 1, 1])
    for (const x of [0.1, 0.5, 0.9]) expect(linear(x)).toBeCloseTo(x, 3)
  })
})
