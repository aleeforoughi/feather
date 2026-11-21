import type { IRNode } from "@aleeforoughi/feather-intent"
import { describe, expect, it } from "vitest"
import { DEFAULT_IR_MAP, checkAnswerBlocks, createRegistry } from "./registry"

describe("createRegistry", () => {
  const reg = createRegistry({ statement: "S", work: "W" })
  it("lists the designed kinds and resolves them", () => {
    expect(reg.kinds).toEqual(["statement", "work"])
    expect(reg.renderer("work")).toBe("W")
  })
  it("falls back to the statement block for a kind it has not designed", () => {
    expect(reg.renderer("faq")).toBe("S")
    expect(reg.renderer("nonsense" as never)).toBe("S")
  })
  it("maps IR nodes, or null when nothing is mapped", () => {
    const text = { type: "Text", id: "t", text: "Hello" } as unknown as IRNode
    expect(reg.fromNode(text)).toMatchObject({ block: "statement", title: "Hello" })
    expect(reg.fromNode({ type: "Table", id: "x" } as unknown as IRNode)).toBeNull()
  })
  it("takes a brand's own IR map", () => {
    const own = createRegistry({ statement: "S" }, { Text: (n) => ({ block: "quote", id: n.id }) })
    expect(own.fromNode({ type: "Text", id: "t" } as unknown as IRNode)).toEqual({ block: "quote", id: "t" })
  })
  it("has a default map for the common nodes", () => expect(Object.keys(DEFAULT_IR_MAP)).toContain("Person"))
})

describe("checkAnswerBlocks", () => {
  it("accepts one to three library blocks", () => expect(checkAnswerBlocks([{ block: "work" }])).toEqual([]))
  it("rejects too many and unknown blocks", () => {
    expect(checkAnswerBlocks([{ block: "work" }, { block: "work" }, { block: "work" }, { block: "work" }])).toHaveLength(1)
    expect(checkAnswerBlocks([{ block: "gallery" }, null])).toHaveLength(2)
  })
})
