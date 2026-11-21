import { describe, expect, it } from "vitest"
import { BLOCK_KINDS, isBlockKind } from "./blocks"

describe("blocks", () => {
  it("knows its kinds", () => {
    expect(BLOCK_KINDS).toContain("statement")
    expect(isBlockKind("work")).toBe(true)
    expect(isBlockKind("gallery")).toBe(false)
    expect(isBlockKind(3)).toBe(false)
  })
})
