import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { NODES, commonFields } from "../src/spec.ts"

// types.ts is written by hand for readability; this keeps it honest against spec.ts, field by field: every spec
// field appears in the node's interface, required exactly when the spec requires it, and nothing else does
// (besides "type", the common fields and "primary").
const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/types.ts"), "utf8")

function interfaceFields(name: string) {
  const start = source.indexOf(`export interface ${name} `)
  if (start < 0) return undefined
  const body = source.slice(source.indexOf("{", start) + 1, source.indexOf("\n}", start))
  const fields = new Map<string, boolean>()
  for (const m of body.matchAll(/^ {2}(\w+)(\?)?:/gm)) fields.set(m[1], m[2] !== "?")
  return fields
}

describe("types.ts mirrors spec.ts", () => {
  it.each(NODES.map((n) => [n.type, n] as const))("%s", (type, spec) => {
    const fields = interfaceFields(`${type}Node`)
    expect(fields, `types.ts has no ${type}Node interface`).toBeDefined()
    expect(source).toContain(`type: "${type}"`)
    for (const [key, field] of Object.entries(spec.fields)) {
      expect(fields!.has(key), `${type}Node lacks "${key}"`).toBe(true)
      expect(fields!.get(key), `${type}Node."${key}" should be ${field.required ? "required" : "optional"}`).toBe(!!field.required)
    }
    expect(fields!.get("intent") === true, `${type}Node.intent should be ${spec.act ? "required" : "inherited as optional"}`).toBe(spec.act)
    const allowed = new Set(["type", "intent", "primary", ...Object.keys(commonFields), ...Object.keys(spec.fields)])
    for (const key of fields!.keys()) expect(allowed.has(key), `${type}Node has "${key}", which spec.ts does not`).toBe(true)
  })
  it("names every node type in the IRNode union", () => {
    for (const { type } of NODES) expect(source).toMatch(new RegExp(`\\| ${type}Node\\b`))
  })
})
