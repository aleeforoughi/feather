import { describe, expect, it } from "vitest"
import { consequenceSentences } from "./consequence-statement"

describe("consequenceSentences", () => {
  it("states spend with the currency, whole amounts without decimals", () => {
    expect(consequenceSentences({ spend: { amount: 1050, currency: "AED" } })).toEqual(["Spends AED 1,050"])
  })
  it("keeps cents when the amount has them", () => {
    expect(consequenceSentences({ spend: { amount: 12.5, currency: "USD" } })).toEqual(["Spends $12.50"])
  })
  it("formats in the given locale", () => {
    expect(consequenceSentences({ spend: { amount: 1050, currency: "EUR" } }, "de-DE")).toEqual(["Spends 1.050 €"])
  })
  it("falls back for a currency code the runtime does not know", () => {
    expect(consequenceSentences({ spend: { amount: 5, currency: "??" } })).toEqual(["Spends ?? 5"])
  })
  it("states publish, send, consent and delete", () => {
    expect(consequenceSentences({ publish: { audience: "all subscribers" } })).toEqual(["Publishes to all subscribers"])
    expect(consequenceSentences({ send: { to: "Sam" } })).toEqual(["Sends to Sam"])
    expect(consequenceSentences({ send: { to: "Sam", channel: "email" } })).toEqual(["Sends to Sam by email"])
    expect(consequenceSentences({ consent: { to: "Acme", scope: "your calendar" } })).toEqual(["Gives Acme access to your calendar"])
    expect(consequenceSentences({ delete: { what: "the draft" } })).toEqual(["Deletes the draft"])
  })
  it("passes a statement through as written", () => {
    expect(consequenceSentences({ statement: "Cannot be recalled once sent." })).toEqual(["Cannot be recalled once sent."])
  })
  it("lists every entry in a fixed order", () => {
    expect(consequenceSentences({ statement: "Final.", delete: { what: "the draft" }, spend: { amount: 10, currency: "USD" } })).toEqual(["Spends $10", "Deletes the draft", "Final."])
  })
  it("is empty for an empty consequence", () => {
    expect(consequenceSentences({})).toEqual([])
  })
})
