// Writes the JSON Schema (schema/feather.ir-0.json) and the node reference (docs/ir/nodes.md) from src/spec.ts.
//   pnpm --filter @aleeforoughi/feather-intent generate
// The test suite fails when either file is out of date. With --check it only reports.
import fs from "node:fs"
import path from "node:path"
import { NODES, commonFields, primaryField, type Field, type NodeSpec } from "../src/spec.ts"
import { IR_VERSION } from "../src/types.ts"

const pkg = path.resolve(import.meta.dirname, "..")
export const SCHEMA_PATH = path.join(pkg, "schema/feather.ir-0.json")
export const DOCS_PATH = path.resolve(pkg, "../../docs/ir/nodes.md")

type Schema = Record<string, unknown>

function fieldSchema(field: Field): Schema {
  const base: Schema = { description: field.doc }
  switch (field.kind) {
    case "string":
      return { ...base, type: "string", minLength: 1, ...(field.maxLength ? { maxLength: field.maxLength } : {}) }
    case "ref":
      return { ...base, $ref: "#/$defs/id" }
    case "number":
      return { ...base, type: field.integer ? "integer" : "number", ...(field.min !== undefined ? { minimum: field.min } : {}), ...(field.max !== undefined ? { maximum: field.max } : {}) }
    case "boolean":
      return { ...base, type: "boolean" }
    case "enum":
      return { ...base, enum: [...field.values] }
    case "currency":
      return { ...base, $ref: "#/$defs/currency" }
    case "date":
      return { ...base, $ref: "#/$defs/date" }
    case "scalar":
      return { ...base, type: ["string", "number", "boolean"] }
    case "refs":
      return { ...base, type: "array", items: { $ref: "#/$defs/id" }, ...(field.minItems ? { minItems: field.minItems } : {}) }
    case "strings":
      return { ...base, type: "array", items: { type: "string", minLength: 1 }, ...(field.minItems ? { minItems: field.minItems } : {}) }
    case "scalars":
      return { ...base, type: "array", items: { type: ["string", "number", "boolean"] }, ...(field.minItems ? { minItems: field.minItems } : {}) }
    case "array":
      return { ...base, type: "array", items: objectSchema(field.of), ...(field.minItems ? { minItems: field.minItems } : {}) }
    case "object":
      return { ...base, ...objectSchema(field.fields, field.atLeastOne) }
    case "record":
      return { ...base, type: "object", additionalProperties: { type: ["string", "number", "boolean"] } }
  }
}

function objectSchema(fields: Record<string, Field>, atLeastOne = false): Schema {
  const required = Object.entries(fields).filter(([, f]) => f.required).map(([k]) => k)
  return {
    type: "object",
    properties: Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, fieldSchema(f)])),
    ...(required.length ? { required } : {}),
    ...(atLeastOne ? { minProperties: 1 } : {}),
    additionalProperties: false,
  }
}

function nodeSchema(spec: NodeSpec): Schema {
  const fields: Record<string, Field> = { ...commonFields, ...(spec.primaryCapable ? { primary: primaryField } : {}), ...spec.fields }
  const object = objectSchema(fields)
  const required = ["type", ...((object.required as string[]) ?? []), ...(spec.act ? ["intent"] : [])]
  return {
    description: spec.doc,
    ...object,
    properties: { type: { const: spec.type }, ...(object.properties as Schema) },
    required: [...new Set(required)],
  }
}

export function buildSchema(): Schema {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://github.com/aleeforoughi/feather/schema/feather.ir-0.json",
    title: `Feather Experience IR (${IR_VERSION})`,
    description:
      "One experience: the next necessary interaction, as meaning. Generated from packages/intent/src/spec.ts. This schema checks structure; rules across nodes (one primary act, irreversible acts state their consequence, references resolve) are checked by validate() in @aleeforoughi/feather-intent.",
    type: "object",
    required: ["ir", "experience", "nodes"],
    additionalProperties: false,
    properties: {
      ir: { const: IR_VERSION },
      experience: { description: "Names the experience; replies carry it back.", $ref: "#/$defs/id" },
      locale: { description: "BCP 47 language of the words in it.", type: "string", pattern: "^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$" },
      nodes: { type: "array", minItems: 1, items: { $ref: "#/$defs/node" } },
    },
    $defs: {
      id: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_.-]{0,63}$" },
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?(Z|[+-]\\d{2}:\\d{2})?)?$" },
      node: { oneOf: NODES.map((n) => ({ $ref: `#/$defs/${n.type}` })) },
      ...Object.fromEntries(NODES.map((n) => [n.type, nodeSchema(n)])),
    },
  }
}

function fieldType(field: Field): string {
  switch (field.kind) {
    case "enum":
      return field.values.map((v) => `\`${v}\``).join(" \\| ")
    case "ref":
      return field.to ? `id of a ${field.to.join(" or ")}` : "node id"
    case "refs":
      return field.to ? `ids of ${field.to.join(" or ")}` : "node ids"
    case "strings":
      return "strings"
    case "scalars":
      return "strings, numbers or booleans"
    case "scalar":
      return "string, number or boolean"
    case "array":
      return `list of { ${Object.entries(field.of).map(([k, f]) => `${k}${f.required ? "" : "?"}`).join(", ")} }`
    case "object":
      return `{ ${Object.entries(field.fields).map(([k, f]) => `${k}${f.required ? "" : "?"}`).join(", ")} }`
    case "record":
      return "{ node id: value }"
    case "currency":
      return "ISO 4217 code"
    case "date":
      return "ISO 8601"
    default:
      return field.kind
  }
}

export function buildDocs(): string {
  const row = (name: string, field: Field, required: boolean) => `| \`${name}\` | ${required ? "yes" : ""} | ${fieldType(field)} | ${field.doc} |`
  const lines = [
    "# Experience IR node reference (feather.ir/0)",
    "",
    "<!-- Generated by packages/intent/scripts/generate.ts from packages/intent/src/spec.ts. Do not edit by hand. -->",
    "",
    "How to use the IR, and what the validator checks, is in [README.md](README.md).",
    "",
    "## Fields on every node",
    "",
    "| Field | Required | Type | Meaning |",
    "|---|---|---|---|",
    ...Object.entries(commonFields).map(([k, f]) => row(k, f, !!f.required)),
    row("primary", primaryField, false),
    "",
    "`intent` is required on act nodes. `primary` exists only on Action, Choice, Input, Approval, Recommendation and IrreversibleAction.",
    "",
  ]
  for (const family of ["content", "decision"] as const) {
    lines.push(`## ${family === "content" ? "Content" : "Decision"} nodes`, "")
    for (const spec of NODES.filter((n) => n.family === family)) {
      lines.push(`### ${spec.type}`, "", spec.doc, "")
      const traits = [spec.act ? "an act (needs `intent`)" : "not an act", spec.primaryCapable ? "may be primary" : ""].filter(Boolean)
      if (spec.defaults) traits.push(`defaults: ${Object.entries(spec.defaults).map(([k, v]) => `${k} ${v}`).join(", ")}`)
      lines.push(`*${traits.join("; ")}.*`, "")
      if (Object.keys(spec.fields).length) {
        lines.push("| Field | Required | Type | Meaning |", "|---|---|---|---|", ...Object.entries(spec.fields).map(([k, f]) => row(k, f, !!f.required)), "")
      }
      const acts = Object.entries(spec.acts)
      lines.push(acts.length ? `**Replies:** ${acts.map(([a, d]) => `\`${a}\`${d.value === "none" ? "" : d.value === "required" ? " (with value)" : " (value optional)"}: ${d.doc}`).join(" ")}` : "**Replies:** none.", "")
    }
  }
  return `${lines.join("\n").trimEnd()}\n`
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
if (isMain) {
  const outputs: Array<[string, string]> = [
    [SCHEMA_PATH, `${JSON.stringify(buildSchema(), null, 2)}\n`],
    [DOCS_PATH, buildDocs()],
  ]
  const check = process.argv.includes("--check")
  let stale = false
  for (const [file, content] of outputs) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
    if (current === content) continue
    stale = true
    if (!check) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, content)
      console.log(`wrote ${path.relative(process.cwd(), file)}`)
    } else console.log(`${path.relative(process.cwd(), file)} is out of date`)
  }
  if (check && stale) process.exit(1)
  if (!stale) console.log("schema and docs are up to date")
}
