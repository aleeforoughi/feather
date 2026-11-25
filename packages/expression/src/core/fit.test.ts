import { describe, expect, it } from "vitest"
import { FIT_MEASURE, fitChars, fitParts, isLongRun, joinUnit, longestRun, runLength, runs, unitSpace } from "./fit"

describe("fit", () => {
  it("runs split at spaces, never at a no-break space", () => {
    expect(runs("Die  Donau\nfährt")).toEqual(["Die", "Donau", "fährt"])
    expect(runs("12\u00a0years and 40\u202f%")).toEqual(["12\u00a0years", "and", "40\u202f%"])
    expect(runs("")).toEqual([])
  })
  it("a run's length is its code points, without the punctuation at its ends", () => {
    expect(runLength("themselves.")).toBe(10)
    expect(runLength("“Scene”")).toBe(5)
    expect(runLength("café")).toBe(4)
    expect(runLength("self-composing")).toBe(14)
  })
  it("longestRun reads every text it is given (a swap's sentence and its words)", () => {
    expect(longestRun("Interfaces that feel {word}.", "calm", "Donaudampfschifffahrtsgesellschaft")).toBe(34)
    expect(longestRun()).toBe(0)
  })
  it("only a run longer than the measure is long, and only then is --fit-chars written", () => {
    expect(FIT_MEASURE).toBe(10)
    expect(isLongRun("experience")).toBe(false)
    expect(isLongRun("Rechtsschutzversicherungsgesellschaften")).toBe(true)
    // The /0 reference titles stay as they were: no style at all.
    expect(fitChars("I design interfaces that compose themselves.")).toBeUndefined()
    expect(fitChars("Die Donaudampfschifffahrtsgesellschaft fährt")).toBe(34)
  })
  it("fitParts round-trips the text, its spaces included", () => {
    for (const text of ["Die  Donaudampfschifffahrtsgesellschaft fährt ", "one", "12\u00a0years"]) expect(fitParts(text).join("")).toBe(text)
  })
  it("a number keeps its unit on its line while the pair fits the measure, and lets a long unit wrap", () => {
    expect(unitSpace("12", "years")).toBe("\u00a0")
    expect(unitSpace("40", "%")).toBe("\u00a0")
    expect(unitSpace("1,250", "kilometres")).toBe(" ")
    expect(joinUnit("1,250", "kilometres")).toBe("1,250 kilometres")
    expect(joinUnit("12", "years")).toBe("12\u00a0years")
    expect(joinUnit("3")).toBe("3")
  })
})
