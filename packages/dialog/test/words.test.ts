import { describe, expect, it } from "vitest"
import { consequenceSentences, directionOf, formatDate, formatMoney, formatRange, plainProblem, safeUrl, sentences } from "../src/index.ts"
import { experience, fixture, planOf } from "./helpers.ts"

describe("consequenceSentences", () => {
  it("reads each entry as one plain sentence, in a fixed order", () => {
    expect(
      consequenceSentences({ statement: "Cannot be recalled", delete: { what: "the draft" }, consent: { to: "Acme", scope: "your calendar" }, send: { to: "Sam", channel: "email" }, publish: { audience: "everyone" }, spend: { amount: 1050, currency: "AED" } }, "en")
    ).toEqual(["Spends AED 1,050", "Publishes to everyone", "Sends to Sam by email", "Gives Acme access to your calendar", "Deletes the draft", "Cannot be recalled"])
    expect(consequenceSentences({ send: { to: "Sam" } })).toEqual(["Sends to Sam"])
    expect(consequenceSentences({ spend: { amount: 12.5, currency: "USD" } }, "en")).toEqual(["Spends $12.50"])
    expect(consequenceSentences({ spend: { amount: 5, currency: "ZZZ" } }, "en")).toEqual(["Spends ZZZ 5"])
  })
})

describe("format", () => {
  it("writes money, dates and ranges in the locale", () => {
    expect(formatMoney(1050, "AED", "en")).toBe("AED 1,050")
    expect(formatMoney(3, "USD", "xx-invalid-locale-")).toBe("USD 3")
    expect(formatDate("2026-01-15", "en")).toBe("Jan 15, 2026")
    expect(formatDate("not a date", "en")).toBe("not a date")
    expect(formatRange("2026-01-15", "2026-01-17", "en")).toBe("Jan 15, 2026 to Jan 17, 2026")
    expect(directionOf("ar-AE")).toBe("rtl")
    expect(safeUrl("javascript:alert(1)")).toBeUndefined()
    expect(plainProblem('act on Node "x": it is wrong.')).toBe("it is wrong.")
  })
})

describe("sentences", () => {
  it("says what a node is, resolving references through the plan", () => {
    const plan = planOf(fixture("purchase-approval.json"))
    const approval = plan.regions[0]!.nodes.find((n) => n.type === "Approval")!
    const lines = sentences(approval, plan)
    expect(lines[0]).toMatch(/^Approval needed: /)
    expect(lines.some((l) => l.startsWith("Requested by "))).toBe(true)
  })

  it("works without a plan, in English, and says nothing for a node with no IR", () => {
    const plan = planOf(experience([{ type: "Price", id: "p", amount: 9.5, currency: "USD", period: "month" }]))
    expect(sentences(plan.regions[0]!.nodes[0]!)).toEqual(["Price: $9.50 per month."])
    expect(sentences({ id: "~x", type: "AlternativeGroup", organism: "AlternativeList", emphasis: "default" })).toEqual(["Other ways to go:"])
  })
})
