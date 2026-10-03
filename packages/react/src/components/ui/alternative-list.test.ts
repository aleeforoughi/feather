import { describe, expect, it } from "vitest"
import { alternativeLabel, encodeAlternativeValue, isIsoDate, normalizeCurrency } from "./alternative-list"

describe("encodeAlternativeValue", () => {
  it("encodes a Price as { amount, currency }", () => {
    expect(encodeAlternativeValue("Price", "800", "AED")).toEqual({ amount: 800, currency: "AED" })
    expect(encodeAlternativeValue("Price", " 12.50 ", "usd")).toEqual({ amount: 12.5, currency: "USD" })
    expect(encodeAlternativeValue("Price", "0", "EUR")).toEqual({ amount: 0, currency: "EUR" })
  })
  it("defaults the Price currency", () => {
    expect(encodeAlternativeValue("Price", "5")).toEqual({ amount: 5, currency: "USD" })
  })
  it("rejects a blank, negative, non-numeric or exponent Price, and a bad currency", () => {
    for (const raw of ["", "  ", "-3", "abc", "1e3", "1,000", "."]) expect(encodeAlternativeValue("Price", raw, "AED")).toBeNull()
    expect(encodeAlternativeValue("Price", "5", "")).toBeNull()
    expect(encodeAlternativeValue("Price", "5", "AE")).toBeNull()
    expect(encodeAlternativeValue("Price", "5", "A1D")).toBeNull()
  })
  it("encodes a Date as an ISO 8601 string, only when the date exists", () => {
    expect(encodeAlternativeValue("Date", "2026-03-14")).toBe("2026-03-14")
    expect(encodeAlternativeValue("Date", "2026-02-30")).toBeNull()
    expect(encodeAlternativeValue("Date", "14/03/2026")).toBeNull()
    expect(encodeAlternativeValue("Date", "")).toBeNull()
    expect(encodeAlternativeValue("Date", "2028-02-29")).toBe("2028-02-29")
    expect(encodeAlternativeValue("Date", "2026-02-29")).toBeNull()
  })
  it("encodes Text, Location and Person as a trimmed non-empty string", () => {
    for (const kind of ["Text", "Location", "Person"] as const) {
      expect(encodeAlternativeValue(kind, "  Dubai Marina ")).toBe("Dubai Marina")
      expect(encodeAlternativeValue(kind, "")).toBeNull()
      expect(encodeAlternativeValue(kind, "   ")).toBeNull()
    }
  })
})

describe("isIsoDate and normalizeCurrency", () => {
  it("checks the calendar", () => {
    expect(isIsoDate("2026-12-31")).toBe(true)
    expect(isIsoDate("2026-13-01")).toBe(false)
    expect(isIsoDate("2026-1-1")).toBe(false)
  })
  it("upper-cases a three-letter code", () => {
    expect(normalizeCurrency(" aed ")).toBe("AED")
    expect(normalizeCurrency("dirham")).toBeNull()
  })
})

describe("alternativeLabel", () => {
  it("prefers the label, else the intent", () => {
    expect(alternativeLabel({ intent: "pay less", label: "Lower budget" })).toBe("Lower budget")
    expect(alternativeLabel({ intent: "pay less" })).toBe("pay less")
    expect(alternativeLabel({ intent: "pay less", label: "  " })).toBe("pay less")
  })
})
