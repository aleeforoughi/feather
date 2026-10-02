import { describe, expect, it } from "vitest"
import { overflow, roleInitials } from "./role-avatar"

describe("overflow", () => {
  it("shows everyone when they fit", () => expect(overflow(3, 6)).toEqual({ shown: 3, extra: 0 }))
  it("collapses the rest into +n", () => expect(overflow(9, 6)).toEqual({ shown: 6, extra: 3 }))
  it("never goes negative", () => expect(overflow(2, -1)).toEqual({ shown: 0, extra: 2 }))
})

describe("roleInitials", () => {
  it("takes up to two initials", () => expect(roleInitials("Brand designer")).toBe("BD"))
  it("handles one word, underscores and empty", () => {
    expect(roleInitials("hero")).toBe("H")
    expect(roleInitials("qa_engineer lead")).toBe("QE")
    expect(roleInitials("")).toBe("?")
  })
})
