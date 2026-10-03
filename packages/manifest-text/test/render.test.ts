import { createDialog, type Turn } from "@aleeforoughi/feather-dialog"
import { compose } from "@aleeforoughi/feather-liquid"
import { describe, expect, it } from "vitest"
import { parseArgs, renderTurn, wrap } from "../src/index.ts"
import { campaign, plan } from "./helpers.ts"

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[/

describe("renderTurn", () => {
  it("says the content, then the consequence on its own line, then numbered choices, then the question with a prompt", () => {
    const text = renderTurn(createDialog(plan(campaign())).turn)
    expect(text).toBe(
      [
        "Recommended: Recommended test: 7 days, purchase objective",
        "",
        "Maximum spend: AED 1,050.",
        "",
        "Confirm spend. This cannot be undone.",
        "Spends AED 1,050",
        "",
        "Or: spend less.",
        "",
        "Or: set my own budget, and you give a price.",
        "",
        "1. Confirm spend",
        "2. Launch the recommended test",
        "3. Spend less",
        "4. Set my own budget",
        "",
        "What would you like to do? Pick a number from 1 to 4.",
        "> ",
      ].join("\n")
    )
  })

  it("wraps at the width without breaking words, and indents choices under their number", () => {
    const turn: Turn = {
      state: "browse",
      parts: [
        { kind: "content", text: "The quick brown fox jumps over the lazy dog and keeps running far away", node: "a" },
        { kind: "content", text: "supercalifragilisticexpialidocious is longer than the width", node: "b" },
        { kind: "question", text: "Which one would you like to pick from the list shown above, please?" },
      ],
      choices: [{ n: 10, label: "A long label that needs more than one line to say what it does", words: [], node: "a", act: "x" }],
    }
    const text = renderTurn(turn, { width: 30 })
    for (const line of text.split("\n")) {
      if (line.includes("supercalifragilisticexpialidocious")) expect(line.trim().split(" ")[0]).toBe("supercalifragilisticexpialidocious")
      else expect([...line].length, line).toBeLessThanOrEqual(30)
    }
    expect(text).toContain("The quick brown fox jumps over\nthe lazy dog and keeps running\nfar away")
    expect(text).toContain("10. A long label that needs\n    more than one line to say\n    what it does")
    expect(text.endsWith("\n> ")).toBe(true)
    expect(wrap("one two three", 7)).toEqual(["one two", "three"])
    expect(wrap("a\nb c", 80)).toEqual(["a", "b c"])
  })

  it("uses ANSI bold only when asked, and only on critical or primary parts", () => {
    const turn = createDialog(plan(campaign())).turn
    expect(renderTurn(turn)).not.toMatch(ANSI)
    expect(renderTurn(turn, { color: false })).not.toMatch(ANSI)
    const styled = renderTurn(turn, { color: true })
    expect(styled).toMatch(ANSI)
    // go is critical, rec is high, less is default: only the critical lines are bold.
    expect(styled).toContain("\u001b[1mConfirm spend. This cannot be undone.\u001b[22m")
    expect(styled).toContain("\u001b[1mSpends AED 1,050\u001b[22m")
    expect(styled).not.toContain("\u001b[1mOr: spend less")
    expect(styled).not.toContain("\u001b[1mRecommended")
    // Taking the styling away leaves exactly the plain text.
    // eslint-disable-next-line no-control-regex
    expect(styled.replace(/\u001b\[\d+m/g, "")).toBe(renderTurn(turn))
  })

  it("drops control characters from a plan's text, so it cannot drive the terminal", () => {
    const result = compose({ ir: "feather.ir/0", experience: "x", nodes: [{ type: "Text", id: "t", text: "Hello\u001b[2J\u001b]0;pwned\u0007 there\u0000" }, { type: "Action", id: "a", intent: "go" }] }, { device: { surface: "terminal" } })
    if (!result.ok) throw new Error("invalid")
    const text = renderTurn(createDialog(result.plan).turn, { color: true })
    expect(text).not.toContain("\u001b[2J")
    expect(text).not.toContain("\u0007")
    expect(text).not.toContain("\u0000")
    expect(text).toContain("Hello[2J]0;pwned there")
  })

  it("renders the confirm, problem, readback and done turns", () => {
    const d = createDialog(plan(campaign()))
    d.answer("1")
    expect(renderTurn(d.turn)).toBe(['Confirm spend. This cannot be undone.', "Spends AED 1,050", "", 'Type "confirm" to go ahead, or "cancel".', "> "].join("\n"))
    expect(renderTurn(d.answer("yes").turn)).toContain("Nothing was done.")
    const done = createDialog(plan({ ir: "feather.ir/0", experience: "x", nodes: [{ type: "Text", id: "t", text: "Saved." }, { type: "Status", id: "s", state: "done", label: "All" }] }))
    expect(renderTurn(done.turn)).toBe("Saved.\n\nAll: done.\n")
    expect(renderTurn({ state: "done", parts: [], choices: [] })).toBe("")
  })

  it("falls back to 80 for a width that makes no sense", () => {
    const turn = createDialog(plan(campaign())).turn
    for (const width of [0, -5, NaN, 3]) expect(renderTurn(turn, { width })).toBe(renderTurn(turn))
  })
})

describe("parseArgs", () => {
  it("reads the file, --context and --width, in either form", () => {
    expect(parseArgs(["exp.json"])).toEqual({ file: "exp.json" })
    expect(parseArgs(["exp.json", "--context", "c.json", "--width", "60"])).toEqual({ file: "exp.json", context: "c.json", width: 60 })
    expect(parseArgs(["--width=40", "--context=c.json", "exp.json"])).toEqual({ file: "exp.json", context: "c.json", width: 40 })
    expect(parseArgs(["-h"])).toEqual({ help: true })
  })

  it("reports a problem as a string", () => {
    for (const argv of [[], ["a", "b"], ["a", "--width"], ["a", "--width", "x"], ["a", "--width", "5"], ["a", "--nope"], ["a", "--context"]]) expect(typeof parseArgs(argv), argv.join(" ")).toBe("string")
  })
})
