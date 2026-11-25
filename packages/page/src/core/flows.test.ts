// The product flows' logic (wave 5): the calculator's formula language, the quiz's scoring, the chart's scale, and
// the formats the booking and podcast blocks share. Pure functions: what the validator, the server and the browser
// all compute the same way.
import { describe, expect, it } from "vitest"
import { clockTime, dateWords, evaluateFormula, formatAmount, formulaValue, hexContrast, isClockTime, isIsoDate, niceScale, parseFormula, priceOf, quizResult, quizScore, scoreRange, spokenTime, startScope, uncoveredTotals, type QuizSpec } from "./flows"

describe("the formula language", () => {
  const v = (src: string, scope: Record<string, number> = {}) => formulaValue(src, scope)

  it("does arithmetic with the usual precedence", () => {
    expect(v("1 + 2 * 3")).toBe(7)
    expect(v("(1 + 2) * 3")).toBe(9)
    expect(v("10 - 4 - 3")).toBe(3)
    expect(v("24 / 4 / 2")).toBe(3)
    expect(v("-2 * -3")).toBe(6)
    expect(v("+5 - -5")).toBe(10)
    expect(v(".5 + 1.25")).toBe(1.75)
  })

  it("reads named inputs, and only those", () => {
    expect(v("pages * 400 + system", { pages: 5, system: 2400 })).toBe(4400)
    expect(Number.isNaN(v("pages * 2", {}))).toBe(true)
    // No property access, no prototype: a name is a key of the scope or nothing.
    expect(Number.isNaN(v("constructor", {}))).toBe(true)
    expect(Number.isNaN(v("toString", {}))).toBe(true)
  })

  it("has min, max and round", () => {
    expect(v("min(3, 1, 2)")).toBe(1)
    expect(v("max(3, 1, 2)")).toBe(3)
    expect(v("round(2.5)")).toBe(3)
    expect(v("round(-2.5)")).toBe(-3)
    expect(v("round(1.005, 2)")).toBe(1.01)
    expect(v("round(1234.5678, 1)")).toBe(1234.6)
    expect(v("max(0, pages - 3) * 100", { pages: 2 })).toBe(0)
  })

  it("has no value for a division by zero, never Infinity", () => {
    expect(Number.isNaN(v("1 / 0"))).toBe(true)
    expect(Number.isNaN(v("1 / (n - n)", { n: 4 }))).toBe(true)
    expect(Number.isNaN(v("max(1, 2 / 0)"))).toBe(true)
  })

  it("lists the names a formula reads", () => {
    const p = parseFormula("round(design + build * rate, 2) + max(a, 1)")
    expect(p.ok && p.names.sort()).toEqual(["a", "build", "design", "rate"])
  })

  it.each([
    ["", "the formula is empty", 0],
    ["1 +", "the formula ends too soon", 3],
    ["(1 + 2", 'expected ")" before the end', 6],
    ["1 2", 'unexpected "2"', 2],
    ["pages; alert(1)", '";" is not part of a formula', 5],
    ["window.location", '"." is not part of a formula', 6],
    ["eval(1)", "eval is not a function (min, max, round)", 0],
    ["round(1, 2, 3)", "round takes a value and, optionally, decimal places", 0],
    ["min(1)", "min takes two or more values", 0],
    ["max", "max is a function: write max(…)", 0],
    ["a ** 2", 'unexpected "*"', 3],
  ])("refuses %j: %s", (src, message, at) => {
    const p = parseFormula(src)
    expect(p.ok).toBe(false)
    if (!p.ok) {
      expect(p.message).toContain(message)
      expect(p.at).toBe(at)
    }
  })

  it("limits length and nesting", () => {
    expect(parseFormula("1+".repeat(250) + "1").ok).toBe(false)
    expect(parseFormula("(".repeat(30) + "1" + ")".repeat(30)).ok).toBe(false)
    expect(parseFormula("(".repeat(10) + "1" + ")".repeat(10)).ok).toBe(true)
  })

  it("evaluates a parsed tree many times with different inputs", () => {
    const p = parseFormula("a * b")
    if (!p.ok) throw new Error("parse")
    expect([1, 2, 3].map((a) => evaluateFormula(p.tree, { a, b: 10 }))).toEqual([10, 20, 30])
  })
})

describe("the calculator's price", () => {
  const inputs = [
    { id: "pages", label: "Pages", kind: "range" as const, min: 1, max: 20, value: 5 },
    { id: "system", label: "System", kind: "radio" as const, options: [{ label: "Own", value: 0 }, { label: "New", value: 2400 }] },
    { id: "copy", label: "Copy", kind: "toggle" as const },
  ]
  const lines = [
    { id: "design", label: "Design", formula: "pages * 400 + system" },
    { id: "build", label: "Build", formula: "pages * 250" },
    { label: "Words", formula: "copy * pages * 120" },
  ]

  it("starts every input at its value, its first option, or off", () => {
    expect(startScope(inputs)).toEqual({ pages: 5, system: 0, copy: 0 })
  })

  it("computes each line, then the total over the lines", () => {
    expect(priceOf({ pages: 5, system: 2400, copy: 1 }, lines, "design + build")).toEqual({ lines: [4400, 1250, 600], total: 5650 })
  })

  it("formats money the same everywhere", () => {
    expect(formatAmount(12345.678, { prefix: "£", decimals: 2 })).toBe("£12,345.68")
    expect(formatAmount(1200, { prefix: "$", suffix: " a month" })).toBe("$1,200 a month")
    expect(formatAmount(-50, { prefix: "€" })).toBe("−€50")
    expect(formatAmount(Number.NaN)).toBe("—")
  })
})

describe("the quiz's scoring", () => {
  const tally: QuizSpec = {
    questions: [
      { id: "a", q: "A?", options: [{ id: "x", label: "X", result: "one" }, { id: "y", label: "Y", result: "two" }] },
      { id: "b", q: "B?", options: [{ id: "x", label: "X", result: "one" }, { id: "y", label: "Y", result: "two" }] },
      { id: "c", q: "C?", options: [{ id: "x", label: "X", result: "two" }, { id: "y", label: "Y", result: "one" }] },
    ],
    results: [
      { id: "one", title: "One" },
      { id: "two", title: "Two" },
      { id: "combo", title: "Combo", match: { a: "y", b: "x", c: "y" } },
    ],
  }

  it("tally: the result most answers point to", () => {
    expect(quizResult(tally, { a: "x", b: "x", c: "x" })?.id).toBe("one")
    expect(quizResult(tally, { a: "y", b: "y", c: "x" })?.id).toBe("two")
  })

  it("a match (an exact combination) comes before the tally", () => {
    expect(quizResult(tally, { a: "y", b: "x", c: "y" })?.id).toBe("combo")
  })

  it("a tie goes to the result listed first", () => {
    const two = { ...tally, questions: tally.questions.slice(0, 2) }
    expect(quizResult(two, { a: "x", b: "y" })?.id).toBe("one")
  })

  it("no result until every question is answered (and only with real options)", () => {
    expect(quizResult(tally, { a: "x", b: "x" })).toBeNull()
    expect(quizResult(tally, { a: "x", b: "x", c: "nope" })).toBeNull()
  })

  const scored: QuizSpec = {
    scoring: "score",
    questions: [
      { id: "a", q: "A?", options: [{ id: "lo", label: "Lo", score: 0 }, { id: "hi", label: "Hi", score: 3 }] },
      { id: "b", q: "B?", options: [{ id: "lo", label: "Lo", score: 1 }, { id: "hi", label: "Hi", score: 4 }] },
    ],
    results: [
      { id: "calm", title: "Calm", min: 1, max: 3 },
      { id: "loud", title: "Loud", min: 4 },
    ],
  }

  it("score: the total picks the first result whose range holds it", () => {
    expect(quizScore(scored, { a: "lo", b: "lo" })).toBe(1)
    expect(quizResult(scored, { a: "lo", b: "lo" })?.id).toBe("calm")
    expect(quizResult(scored, { a: "hi", b: "lo" })?.id).toBe("loud")
    expect(quizResult(scored, { a: "hi", b: "hi" })?.id).toBe("loud")
  })

  it("knows the totals a scored quiz reaches, and the ones no result covers", () => {
    expect(scoreRange(scored)).toEqual([1, 7])
    expect(uncoveredTotals(scored.results, 1, 7)).toEqual([])
    expect(uncoveredTotals([{ min: 1, max: 2 }, { min: 5, max: 6 }], 0, 8)).toEqual([[0, 0], [3, 4], [7, 8]])
    expect(uncoveredTotals([{ min: 0, max: 10 }, { min: 2, max: 3 }], 0, 8)).toEqual([])
  })
})

describe("the chart's scale", () => {
  it("starts at zero and steps by 1, 2, 2.5 or 5 times a power of ten", () => {
    expect(niceScale(610, 1240)).toEqual({ min: 0, max: 1500, step: 500, ticks: [0, 500, 1000, 1500] })
    expect(niceScale(0, 880, 4)).toEqual({ min: 0, max: 1000, step: 250, ticks: [0, 250, 500, 750, 1000] })
    expect(niceScale(3, 9)).toEqual({ min: 0, max: 10, step: 2.5, ticks: [0, 2.5, 5, 7.5, 10] })
    expect(niceScale(-30, 70).ticks).toEqual([-50, -25, 0, 25, 50, 75])
    expect(niceScale(0, 0).max).toBeGreaterThan(0)
  })
})

describe("time, dates and colour", () => {
  it("writes and speaks a playback time", () => {
    expect(clockTime(65)).toBe("1:05")
    expect(clockTime(3723)).toBe("1:02:03")
    expect(clockTime(Number.NaN)).toBe("0:00")
    expect(spokenTime(65)).toBe("1 minute 5 seconds")
    expect(spokenTime(0)).toBe("0 seconds")
  })

  it("reads real dates and times of day", () => {
    expect(isIsoDate("2026-12-01")).toBe(true)
    expect(isIsoDate("2026-02-30")).toBe(false)
    expect(isIsoDate("1/12/2026")).toBe(false)
    expect(isClockTime("09:30")).toBe(true)
    expect(isClockTime("24:00")).toBe(false)
    expect(dateWords("2026-12-01")).toBe("Tuesday 1 December")
  })

  it("measures contrast like WCAG", () => {
    expect(hexContrast("#000", "#fff")).toBeCloseTo(21, 5)
    expect(hexContrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2)
    expect(hexContrast("red", "#fff")).toBeNull()
  })
})
