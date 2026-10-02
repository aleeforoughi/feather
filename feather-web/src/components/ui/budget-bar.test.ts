import { describe, expect, it } from "vitest"
import { budgetGeometry, budgetZone } from "./budget-bar"

describe("budgetZone", () => {
  it("is ok up to and at the target", () => {
    expect(budgetZone({ spent: 0, target: 100, cap: 200 })).toEqual({ zone: "ok", heat: 0 })
    expect(budgetZone({ spent: 100, target: 100, cap: 200 }).zone).toBe("ok")
  })
  it("warms, then heats, between target and cap", () => {
    expect(budgetZone({ spent: 120, target: 100, cap: 200 }).zone).toBe("warm")
    expect(budgetZone({ spent: 150, target: 100, cap: 200 })).toEqual({ zone: "hot", heat: 0.5 })
    expect(budgetZone({ spent: 200, target: 100, cap: 200 })).toEqual({ zone: "hot", heat: 1 })
  })
  it("is over past the cap", () => {
    expect(budgetZone({ spent: 201, target: 100, cap: 200 }).zone).toBe("over")
  })
  it("defaults the target to 75% of the cap", () => {
    expect(budgetZone({ spent: 75, cap: 100 }).zone).toBe("ok")
    expect(budgetZone({ spent: 80, cap: 100 }).zone).toBe("warm")
  })
  it("handles a cap at or below the target", () => {
    expect(budgetZone({ spent: 150, target: 200, cap: 100 }).zone).toBe("over")
    expect(budgetZone({ spent: 100, target: 100, cap: 100 }).zone).toBe("ok")
  })
})

describe("budgetGeometry", () => {
  it("places fill, markers and reserved within the scale", () => {
    const g = budgetGeometry({ spent: 50, target: 80, cap: 100, reserved: 10 })
    expect(g.cap).toBeLessThan(100)
    expect(g.target!).toBeLessThan(g.cap)
    expect(g.fill).toBeLessThan(g.target!)
    expect(g.reserved).toBeGreaterThan(0)
    expect(g.overshoot).toBe(0)
  })
  it("draws the overshoot beyond the cap marker", () => {
    const g = budgetGeometry({ spent: 150, target: 80, cap: 100 })
    expect(g.overshoot).toBeGreaterThan(0)
    expect(g.fill).toBeCloseTo(g.cap + g.overshoot)
    expect(g.fill).toBeLessThanOrEqual(100)
  })
  it("survives a zero cap", () => {
    expect(budgetGeometry({ spent: 0, cap: 0 }).fill).toBe(0)
  })
})
