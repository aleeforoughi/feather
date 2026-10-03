import { describe, expect, it } from "vitest"
import { confidenceLabel, confidenceText, nextStepText } from "./recommendation"

describe("confidenceLabel", () => {
  it("is low below 0.5, medium below 0.8, otherwise high", () => {
    expect(confidenceLabel(0)).toBe("low")
    expect(confidenceLabel(0.49)).toBe("low")
    expect(confidenceLabel(0.5)).toBe("medium")
    expect(confidenceLabel(0.79)).toBe("medium")
    expect(confidenceLabel(0.8)).toBe("high")
    expect(confidenceLabel(1)).toBe("high")
  })
  it("clamps and survives bad input", () => {
    expect(confidenceLabel(7)).toBe("high")
    expect(confidenceLabel(-1)).toBe("low")
    expect(confidenceLabel(Number.NaN)).toBe("low")
  })
})

describe("confidenceText", () => {
  it("says the word and the percentage", () => {
    expect(confidenceText(0.78)).toBe("Confidence: medium (78%)")
    expect(confidenceText(0.9)).toBe("Confidence: high (90%)")
    expect(confidenceText(0.2)).toBe("Confidence: low (20%)")
  })
})

describe("nextStepText", () => {
  it("says an irreversible recommendation only moves on to confirmation", () => {
    expect(nextStepText(false)).toMatch(/^Next, you confirm/)
  })
  it("says a reversible one can be undone", () => {
    expect(nextStepText(undefined)).toMatch(/undo/)
    expect(nextStepText(true)).toMatch(/undo/)
  })
})
