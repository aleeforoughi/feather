import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { NODES, formatIssues, validate } from "../src/index.ts"

// The IR fixtures in conformance/ir: every valid one validates, every invalid one fails with exactly the issues it
// expects (code and path). Later milestones compose the same fixtures into layout plans.
const root = path.resolve(import.meta.dirname, "../../../conformance/ir")
type Fixture = { description: string; ir: unknown; expect?: Array<{ code: string; path: string }> }
const load = (dir: string) =>
  fs
    .readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => [f, JSON.parse(fs.readFileSync(path.join(root, dir, f), "utf8")) as Fixture] as const)

const valid = load("valid")
const invalid = load("invalid")

describe("valid fixtures", () => {
  it("number at least 40 (L1 exit)", () => expect(valid.length).toBeGreaterThanOrEqual(40))
  it("use every node type", () => {
    const used = new Set(valid.flatMap(([, f]) => ((f.ir as { nodes?: Array<{ type: string }> }).nodes ?? []).map((n) => n.type)))
    expect(NODES.map((n) => n.type).filter((t) => !used.has(t))).toEqual([])
  })
  it.each(valid)("%s validates", (_, fixture) => {
    expect(fixture.description, "every fixture says what it is").toBeTruthy()
    const result = validate(fixture.ir)
    if (!result.ok) expect.fail(formatIssues(result.issues))
  })
})

describe("invalid fixtures", () => {
  it("number at least 20 (L1 exit)", () => expect(invalid.length).toBeGreaterThanOrEqual(20))
  it("cover at least 20 different issue codes", () => {
    expect(new Set(invalid.flatMap(([, f]) => (f.expect ?? []).map((e) => e.code))).size).toBeGreaterThanOrEqual(20)
  })
  it.each(invalid)("%s is rejected with exactly the expected issues", (_, fixture) => {
    expect(fixture.expect?.length, "an invalid fixture lists the issues it expects").toBeGreaterThan(0)
    const result = validate(fixture.ir)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const got = result.issues.map((i) => ({ code: i.code, path: i.path }))
      expect(got.sort(byKey)).toEqual([...fixture.expect!].sort(byKey))
      for (const issue of result.issues) expect(issue.message.length, "every issue is a readable sentence").toBeGreaterThan(20)
    }
  })
})

const byKey = (a: { code: string; path: string }, b: { code: string; path: string }) => `${a.path} ${a.code}`.localeCompare(`${b.path} ${b.code}`)
