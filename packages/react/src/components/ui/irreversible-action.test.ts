import { describe, expect, it } from "vitest"
import { holdLabel, holdProgress, outcomeText } from "./irreversible-action"

describe("holdProgress", () => {
  it("slides from 0 to 1 over the hold", () => {
    expect(holdProgress(0, 1500, false)).toBe(0)
    expect(holdProgress(750, 1500, false)).toBe(0.5)
    expect(holdProgress(3000, 1500, false)).toBe(1)
  })
  it("steps by quarters with reduced motion, and still needs the whole hold", () => {
    expect(holdProgress(100, 1500, true)).toBe(0)
    expect(holdProgress(800, 1500, true)).toBe(0.5)
    expect(holdProgress(1499, 1500, true)).toBe(0.75)
    expect(holdProgress(1500, 1500, true)).toBe(1)
  })
})

describe("holdLabel", () => {
  it("turns the act into an instruction", () => {
    expect(holdLabel("Spend AED 1,050")).toBe("Hold to spend AED 1,050")
  })
})

describe("outcomeText", () => {
  it("states what was done, lower-casing the first letter", () => {
    expect(outcomeText({ spend: { amount: 1050, currency: "AED" } })).toBe("Confirmed: spends AED 1,050")
  })
  it("joins several consequences", () => {
    expect(outcomeText({ spend: { amount: 10, currency: "USD" }, publish: { audience: "everyone" } })).toBe("Confirmed: spends $10; publishes to everyone")
    expect(outcomeText({ statement: "Acme emails your receipt." })).toBe("Confirmed: Acme emails your receipt.")
  })
  it("formats money in the locale", () => {
    expect(outcomeText({ spend: { amount: 1050, currency: "EUR" } }, "de-DE")).toBe("Confirmed: spends 1.050 €")
  })
})
