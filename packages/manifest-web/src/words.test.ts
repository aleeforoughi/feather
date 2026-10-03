// The web organism and the dialog engine must say a consequence in exactly the same words (docs/manifestations.md
// section 1, Words): the React package cannot be imported by the dialog, so the two copies are compared here, for every
// fixture and every locale a fixture uses.
import { consequenceSentences as dialogSentences } from "@aleeforoughi/feather-dialog"
import type { Experience } from "@aleeforoughi/feather-intent"
import { consequenceSentences as reactSentences } from "@aleeforoughi/feather-react"
import { describe, expect, it } from "vitest"
import { FIXTURES } from "./test/fixtures"

describe("consequence sentences", () => {
  it("are identical in the dialog engine and the web organism", () => {
    let seen = 0
    for (const { name, ir } of FIXTURES) {
      const experience = ir as Experience
      for (const locale of ["en", experience.locale ?? "en", "ar-AE", "de"]) {
        for (const node of experience.nodes) {
          if ("consequence" in node && node.consequence) {
            expect(dialogSentences(node.consequence, locale), `${name} ${node.id} in ${locale}`).toEqual(reactSentences(node.consequence, locale))
            seen++
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(0)
  })

  it("agree on every kind of consequence", () => {
    const all = { spend: { amount: 1050.5, currency: "AED" }, publish: { audience: "everyone" }, send: { to: "Sam", channel: "email" }, consent: { to: "Acme", scope: "your calendar" }, delete: { what: "the draft" }, statement: "Final" }
    for (const locale of ["en", "fr", "ar-AE", "de-DE", "ja"]) expect(dialogSentences(all, locale)).toEqual(reactSentences(all, locale))
  })
})
