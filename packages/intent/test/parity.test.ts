import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { IR_CORPUS_PATH, REPLY_CORPUS_PATH, URL_CORPUS_PATH, buildIrCorpus, buildReplyCorpus, buildUrlCorpus } from "../scripts/parity.ts"
import { NODE_SPECS } from "../src/index.ts"

// conformance/parity is what the Python package (packages/python) is tested against. It is generated from this
// package's validator, so a change to a rule or a message makes it stale until it is regenerated and the Python
// port follows: node packages/intent/scripts/parity.ts
describe("the parity corpus", () => {
  const stale = "is stale: run node packages/intent/scripts/parity.ts, then make packages/python agree"
  it(`conformance/parity/ir.json ${stale}`, () => {
    expect(fs.readFileSync(IR_CORPUS_PATH, "utf8")).toBe(`${JSON.stringify(buildIrCorpus())}\n`)
  })
  it(`conformance/parity/reply.json ${stale}`, () => {
    expect(fs.readFileSync(REPLY_CORPUS_PATH, "utf8")).toBe(`${JSON.stringify(buildReplyCorpus())}\n`)
  })
  it(`conformance/parity/url.json ${stale}`, () => {
    expect(fs.readFileSync(URL_CORPUS_PATH, "utf8")).toBe(`${JSON.stringify(buildUrlCorpus())}\n`)
  })
  it("is broad: several hundred cases, every issue code, every node type", () => {
    const ir = buildIrCorpus()
    const replies = buildReplyCorpus()
    expect(ir.length).toBeGreaterThanOrEqual(300)
    expect(replies.cases.length).toBeGreaterThanOrEqual(300)
    const codes = new Set(ir.flatMap((c) => c.issues.map((i) => i.code)))
    const source = fs.readFileSync(new URL("../src/validate.ts", import.meta.url), "utf8")
    const all = [...source.slice(0, source.indexOf("export interface Issue")).matchAll(/\| "([a-z-]+)"/g)].map((m) => m[1])
    // "unreadable" needs a value JSON cannot hold, so it is tested in each language on its own.
    expect(all.filter((c) => c !== "unreadable" && !codes.has(c))).toEqual([])
    const nodesOf = (doc: unknown): Array<{ type?: string } | null> => {
      const nodes = (doc as { nodes?: unknown } | null)?.nodes
      return Array.isArray(nodes) ? nodes : []
    }
    const types = new Set(ir.flatMap((c) => nodesOf(c.ir).map((n) => n?.type)))
    expect(Object.keys(NODE_SPECS).filter((t) => !types.has(t))).toEqual([])
    expect(ir.some((c) => c.issues.length === 0)).toBe(true)
    expect(replies.cases.some((c) => c.issues.length === 0)).toBe(true)
  })
})
