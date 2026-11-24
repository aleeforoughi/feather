import { describe, expect, it } from "vitest"
import { fontsReady, groupLines, splitChars, splitWords } from "./split"

describe("split", () => {
  it("splitWords round-trips the text, spaces included", () => {
    for (const text of ["Hello world", "  leading and  double  spaces ", "one", "", "line\nbreak"]) expect(splitWords(text).join("")).toBe(text)
  })
  it("splitWords separates words from whitespace", () => {
    expect(splitWords("a  b")).toEqual(["a", "  ", "b"])
  })
  it("splitChars keeps code points whole and round-trips", () => {
    expect(splitChars("café")).toEqual(["c", "a", "f", "é"])
    expect(splitChars("a😀b")).toHaveLength(3)
    expect(splitChars("a😀b").join("")).toBe("a😀b")
  })
  it("groupLines groups by top edge within 2px", () => {
    const els = [0, 1, 30, 31, 60].map((offsetTop) => ({ offsetTop }))
    expect(groupLines(els).map((l) => l.length)).toEqual([2, 2, 1])
    expect(groupLines([])).toEqual([])
  })
  it("fontsReady resolves", async () => {
    await expect(fontsReady()).resolves.toBeUndefined()
  })
})
