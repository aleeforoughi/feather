import { describe, expect, it } from "vitest"
import { disclosureLine, isDisclosure } from "./disclosure"

describe("disclosureLine", () => {
  it("says it is an agent and whose words, for every kind of speaker", () => {
    for (const kind of ["person", "company", "product"] as const) {
      const line = disclosureLine({ kind, name: "Alee" })
      expect(line).toContain("AI agent")
      expect(line).toContain("Alee")
      expect(isDisclosure(line)).toBe(true)
    }
  })
})

describe("isDisclosure", () => {
  it("needs a mention of AI or an agent", () => {
    expect(isDisclosure("You are talking to an AI agent.")).toBe(true)
    expect(isDisclosure("Automated replies from the studio.")).toBe(true)
    expect(isDisclosure("Ask me anything you like here.")).toBe(false)
    expect(isDisclosure("AI")).toBe(false)
  })
})
