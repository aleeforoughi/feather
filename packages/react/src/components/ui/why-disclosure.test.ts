import { describe, expect, it } from "vitest"
import { disclosureEntries } from "./why-disclosure"

describe("disclosureEntries", () => {
  it("lists why before detail", () => {
    expect(disclosureEntries({ detail: "D", why: "W" }).map((e) => e.kind)).toEqual(["why", "detail"])
  })
  it("skips entries without content", () => {
    expect(disclosureEntries({ why: "W" })).toEqual([{ kind: "why", content: "W" }])
    expect(disclosureEntries({ why: "", detail: "D" })).toEqual([{ kind: "detail", content: "D" }])
    expect(disclosureEntries({})).toEqual([])
  })
})
