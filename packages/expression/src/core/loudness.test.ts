import { afterEach, describe, expect, it } from "vitest"
import { allows, DEFAULT_LOUDNESS, loudnessOf } from "./loudness"

describe("loudness", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    document.documentElement.style.removeProperty("--loudness")
  })
  it("reads the nearest data-loudness, then the theme's --loudness, then the house default", () => {
    document.body.innerHTML = '<main data-loudness="3"><section data-loudness="0"><p id="a"></p></section><p id="b"></p></main><p id="c"></p>'
    expect(loudnessOf(document.getElementById("a"))).toBe(0)
    expect(loudnessOf(document.getElementById("b"))).toBe(3)
    expect(loudnessOf(document.getElementById("c"))).toBe(DEFAULT_LOUDNESS)
    document.documentElement.style.setProperty("--loudness", "2")
    expect(loudnessOf(document.getElementById("c"))).toBe(2)
  })
  it("clamps to 0..3 and maps each level to what it allows", () => {
    document.body.innerHTML = '<p id="x" data-loudness="9"></p>'
    expect(loudnessOf(document.getElementById("x"))).toBe(3)
    expect([0, 1, 2, 3].map((l) => allows(l as 0, "reveal"))).toEqual([false, true, true, true])
    expect([0, 1, 2, 3].map((l) => allows(l as 0, "scroll"))).toEqual([false, false, true, true])
    expect([0, 1, 2, 3].map((l) => allows(l as 0, "scene"))).toEqual([false, false, false, true])
  })
})
