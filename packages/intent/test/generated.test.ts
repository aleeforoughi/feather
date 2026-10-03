import fs from "node:fs"
import path from "node:path"
import { Ajv2020 } from "ajv/dist/2020.js"
import { describe, expect, it } from "vitest"
import { DOCS_PATH, SCHEMA_PATH, buildDocs, buildSchema } from "../scripts/generate.ts"

const fixtures = (dir: string) => {
  const root = path.resolve(import.meta.dirname, "../../../conformance/ir", dir)
  return fs.existsSync(root) ? fs.readdirSync(root).filter((f) => f.endsWith(".json")).map((f) => [f, JSON.parse(fs.readFileSync(path.join(root, f), "utf8"))] as const) : []
}

describe("generated files", () => {
  it("schema/feather.ir-0.json is up to date (pnpm --filter @aleeforoughi/feather-intent generate)", () => {
    expect(fs.readFileSync(SCHEMA_PATH, "utf8")).toBe(`${JSON.stringify(buildSchema(), null, 2)}\n`)
  })
  it("docs/ir/nodes.md is up to date (pnpm --filter @aleeforoughi/feather-intent generate)", () => {
    expect(fs.readFileSync(DOCS_PATH, "utf8")).toBe(buildDocs())
  })
})

describe("the JSON Schema", () => {
  const check = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true }).compile(buildSchema())
  it.each(fixtures("valid"))("accepts %s", (_, fixture) => {
    expect(check(fixture.ir), JSON.stringify(check.errors)).toBe(true)
  })
  // The schema checks structure only; issues that need several nodes or semantic rules are the validator's alone.
  const semantic = new Set(["duplicate-id", "dangling-reference", "self-reference", "wrong-reference-type", "multiple-primary", "irreversible-without-consequence", "missing-text-equivalent", "duplicate-option", "unknown-option", "too-many-selected", "duplicate-step", "empty-tradeoff", "comparison-mismatch", "out-of-range", "invalid-date", "unsupported-version"])
  it.each(fixtures("invalid").filter(([, f]) => f.expect.every((e: { code: string }) => !semantic.has(e.code))))("rejects %s", (_, fixture) => {
    expect(check(fixture.ir)).toBe(false)
  })
})
