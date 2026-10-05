// Collapsed nodes by voice: "Other options" is one more spoken choice, picked by number or by the words.
import { describe, expect, it } from "vitest"
import { REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"
import { createVoiceDialog, speechFor } from "../src/index.ts"
import { fixtureFile, plan } from "./helpers.ts"
import fs from "node:fs"

const flight = JSON.parse(fs.readFileSync(fixtureFile("flight-search-tradeoff.json"), "utf8")).ir
const folded = () => plan(flight, { ...REFERENCE_CONTEXTS.screenless.context, persona: { autonomy: "delegate" } })
const said = (p: ReturnType<typeof folded>, d: ReturnType<typeof createVoiceDialog>) => speechFor(d.turn, p).map((s) => s.text).join(" ")

describe("voice: collapsed nodes", () => {
  it("says Other options as the last choice", () => {
    const p = folded()
    const d = createVoiceDialog(p, { experience: flight })
    expect(said(p, d)).toMatch(/or Other options\.$/)
  })

  for (const [how, phrase] of [["by number", (n: number) => `option ${["", "one", "two", "three", "four", "five", "six"][n]}`], ["by its words", () => "other options"]] as const) {
    it(`opens them ${how}, emitting nothing`, () => {
      const p = folded()
      const d = createVoiceDialog(p, { experience: flight })
      const n = d.turn.choices.find((c) => c.label === "Other options")!.n
      const out = d.hear([phrase(n)])
      expect(out.replies).toEqual([])
      expect(d.turn.choices.some((c) => c.node === "alt_early")).toBe(true)
      expect(d.turn.choices.some((c) => c.label === "Other options")).toBe(false)
    })
  }
})
