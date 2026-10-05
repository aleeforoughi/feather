import fs from "node:fs"
import path from "node:path"
import { Ajv2020 } from "ajv/dist/2020.js"
import { describe, expect, it } from "vitest"
import { DOCS_PATH, PY_NODES_PATH, PY_SPEC_PATH, SCHEMA_PATH, UPDATE_SCHEMA_PATH, buildDocs, buildPythonNodes, buildPythonSpec, buildSchema, buildUpdateSchema } from "../scripts/generate.ts"

const VALIDATOR_ONLY = [
  "duplicate-id", "dangling-reference", "self-reference", "wrong-reference-type", "out-of-order", "ambiguous-alternative", "unneeded-confirmation",
  "multiple-primary", "irreversible-without-consequence", "missing-text-equivalent", "duplicate-option", "unknown-option", "too-many-selected",
  "conflicting-prediction", "duplicate-step", "duplicate-field", "empty-tradeoff", "comparison-mismatch", "out-of-range", "invalid-date", "too-many-issues",
]

const fixtures = (dir: string) => {
  const root = path.resolve(import.meta.dirname, "../../../conformance/ir", dir)
  return fs.existsSync(root) ? fs.readdirSync(root).filter((f) => f.endsWith(".json")).map((f) => [f, JSON.parse(fs.readFileSync(path.join(root, f), "utf8"))] as const) : []
}

describe("generated files", () => {
  it("schema/feather.ir-1.json is up to date (pnpm --filter @aleeforoughi/feather-intent generate)", () => {
    expect(fs.readFileSync(SCHEMA_PATH, "utf8")).toBe(`${JSON.stringify(buildSchema(), null, 2)}\n`)
  })
  it("schema/feather.update-1.json is up to date (pnpm --filter @aleeforoughi/feather-intent generate)", () => {
    expect(fs.readFileSync(UPDATE_SCHEMA_PATH, "utf8")).toBe(`${JSON.stringify(buildUpdateSchema(), null, 2)}\n`)
  })
  it("docs/ir/nodes.md is up to date (pnpm --filter @aleeforoughi/feather-intent generate)", () => {
    expect(fs.readFileSync(DOCS_PATH, "utf8")).toBe(buildDocs())
  })
  it("packages/python/feather_sdk/_spec.json is up to date (pnpm --filter @aleeforoughi/feather-intent generate)", () => {
    expect(fs.readFileSync(PY_SPEC_PATH, "utf8")).toBe(buildPythonSpec())
  })
  it("packages/python/feather_sdk/nodes.py is up to date (pnpm --filter @aleeforoughi/feather-intent generate)", () => {
    expect(fs.readFileSync(PY_NODES_PATH, "utf8")).toBe(buildPythonNodes())
  })
})

describe("the JSON Schema", () => {
  const check = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true }).compile(buildSchema())
  it.each(fixtures("valid"))("accepts %s", (_, fixture) => {
    expect(check(fixture.ir), JSON.stringify(check.errors)).toBe(true)
  })
  // The schema checks structure; these codes need several nodes or several fields at once, so only validate()
  // reports them. docs/ir/README.md lists the same codes.
  const semantic = new Set(VALIDATOR_ONLY)
  it("lists only real issue codes as validator-only", () => {
    const codes = fs.readFileSync(path.resolve(import.meta.dirname, "../src/validate.ts"), "utf8")
    for (const code of VALIDATOR_ONLY) expect(codes).toContain(`| "${code}"`)
  })
  it.each(fixtures("invalid").filter(([, f]) => f.expect.every((e: { code: string }) => !semantic.has(e.code))))("rejects %s", (_, fixture) => {
    expect(check(fixture.ir)).toBe(false)
  })
})

describe("the update JSON Schema", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true })
  ajv.addSchema(buildSchema())
  const check = ajv.compile(buildUpdateSchema())
  const root = path.resolve(import.meta.dirname, "../../../conformance/update")
  const streams = fs.readdirSync(path.join(root, "valid")).map((f) => [f, JSON.parse(fs.readFileSync(path.join(root, "valid", f), "utf8"))] as const)
  it.each(streams)("accepts every update in %s", (_, fixture) => {
    for (const update of fixture.updates) expect(check(update), JSON.stringify(check.errors)).toBe(true)
  })
  it("rejects what its structure alone rules out", () => {
    const base = { update: "feather.update/1", experience: "x", revision: 1 }
    expect(check({ ...base, ops: [] })).toBe(false)
    expect(check({ ...base, ops: [{ op: "move", id: "a" }] })).toBe(false)
    expect(check({ ...base, ops: [{ op: "patch", id: "a", set: { type: "Text" } }] })).toBe(false)
    expect(check({ ...base, ops: [{ op: "resolve", outcome: "done", summary: "Two\nlines" }] })).toBe(false)
  })
})
