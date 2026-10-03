import { describe, expect, it } from "vitest"
import { approvalOutcome, rejectionReason, requesterTag } from "./approval"

describe("rejectionReason", () => {
  it("is undefined when blank", () => {
    expect(rejectionReason("")).toBeUndefined()
    expect(rejectionReason("  \n ")).toBeUndefined()
  })
  it("trims what the person wrote", () => {
    expect(rejectionReason("  Too costly ")).toBe("Too costly")
  })
})

describe("requesterTag", () => {
  it("joins role and kind", () => {
    expect(requesterTag({ role: "Finance lead", kind: "agent" })).toBe("Finance lead · agent")
    expect(requesterTag({ kind: "agent" })).toBe("agent")
    expect(requesterTag({})).toBeUndefined()
  })
})

describe("approvalOutcome", () => {
  it("states the decision", () => {
    expect(approvalOutcome("approve")).toBe("Approved.")
    expect(approvalOutcome("reject")).toBe("Rejection sent.")
  })
  it("adds the reason when one was given", () => {
    expect(approvalOutcome("reject", "Over budget")).toBe("Rejection sent. Reason: Over budget")
  })
})
