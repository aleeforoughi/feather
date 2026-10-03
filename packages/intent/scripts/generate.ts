// Writes the JSON Schema (schema/feather.ir-0.json), the node reference (docs/ir/nodes.md) and the Python package's
// node table and builders (packages/python/feather_sdk/_spec.json, nodes.py) from src/spec.ts.
//   pnpm --filter @aleeforoughi/feather-intent generate
// The test suite fails when either file is out of date. With --check it only reports.
import fs from "node:fs"
import path from "node:path"
import { DEFAULT_MAX_LENGTH, NODES, PRESENTATIONAL_FIELDS, commonFields, consequenceField, primaryField, type Field, type NodeSpec } from "../src/spec.ts"
import { IR_VERSION } from "../src/types.ts"
import { MAX_ISSUES } from "../src/validate.ts"

const pkg = path.resolve(import.meta.dirname, "..")
export const SCHEMA_PATH = path.join(pkg, "schema/feather.ir-0.json")
export const DOCS_PATH = path.resolve(pkg, "../../docs/ir/nodes.md")
export const PY_SPEC_PATH = path.resolve(pkg, "../python/feather_sdk/_spec.json")
export const PY_NODES_PATH = path.resolve(pkg, "../python/feather_sdk/nodes.py")

type Schema = Record<string, unknown>

function fieldSchema(field: Field): Schema {
  const base: Schema = { description: field.doc }
  switch (field.kind) {
    case "string":
      return { ...base, type: "string", pattern: "\\S", maxLength: field.maxLength ?? DEFAULT_MAX_LENGTH }
    case "id":
      return { ...base, $ref: "#/$defs/id" }
    case "text-or-number":
      return { ...base, anyOf: [{ type: "string", maxLength: DEFAULT_MAX_LENGTH }, { type: "number" }] }
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
      return { ...base, type: "array", items: { $ref: "#/$defs/id" }, ...(field.minItems ? { minItems: field.minItems } : {}), ...(field.unique ? { uniqueItems: true } : {}) }
    case "strings":
      return { ...base, type: "array", items: { type: "string", pattern: "\\S", maxLength: DEFAULT_MAX_LENGTH }, ...(field.minItems ? { minItems: field.minItems } : {}) }
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
    properties: {
      type: { const: spec.type },
      ...(object.properties as Schema),
      id: { description: commonFields.id.doc, $ref: "#/$defs/id" },
      ...(spec.defaults?.reversible === false ? { reversible: { description: "Always false: this act cannot be undone.", const: false } } : {}),
      ...(spec.importance ? { importance: { description: commonFields.importance.doc, enum: [...spec.importance] } } : {}),
    },
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
    case "id":
      return "id"
    case "text-or-number":
      return "string or number"
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
      if (spec.importance) traits.push(`importance only ${spec.importance.join(" or ")}`)
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

/** The issue codes in a `code: | "a" | "b"` union, read from the source so the list cannot drift from the validator. */
function unionCodes(file: string, after: string): string[] {
  const source = fs.readFileSync(path.join(pkg, "src", file), "utf8")
  const start = source.indexOf(after)
  if (start < 0) throw new Error(`${after} not found in ${file}`)
  const codes: string[] = []
  for (const line of source.slice(start + after.length).split("\n")) {
    const m = /^\s*\|?\s*"([a-z-]+)"\s*$/.exec(line)
    if (m) codes.push(m[1])
    else if (codes.length) break
  }
  return codes
}

/** The node table as data for the Python package (feather_sdk/_spec.json): everything its validator and builders read. */
export function buildPythonSpec(): string {
  const spec = {
    _generated: "Generated by packages/intent/scripts/generate.ts from packages/intent/src/spec.ts. Do not edit by hand.",
    irVersion: IR_VERSION,
    defaultMaxLength: DEFAULT_MAX_LENGTH,
    maxIssues: MAX_ISSUES,
    issueCodes: unionCodes("validate.ts", "export type IssueCode ="),
    replyIssueCodes: unionCodes("reply.ts", "code:"),
    presentationalFields: [...PRESENTATIONAL_FIELDS],
    commonFields,
    primaryField,
    consequenceField,
    nodes: NODES,
  }
  return `${JSON.stringify(spec, null, 2)}\n`
}

// ── Python builders (feather_sdk/nodes.py) ───────────────────────────────────────────────────────────────────────

const PY_KEYWORDS = new Set(["False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield"])
const pyName = (k: string) => (PY_KEYWORDS.has(k) ? `${k}_` : k)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const SINGULAR: Record<string, string> = { options: "Option", steps: "Step", criteria: "Criterion" }
const pyDoc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')

export function buildPythonNodes(): string {
  const typedDicts = new Map<string, { signature: string; lines: string[] }>()

  /** The annotation for a field; nested objects become TypedDicts, defined once by name. */
  function annotation(field: Field, owner: string, key: string): string {
    switch (field.kind) {
      case "string":
      case "id":
      case "currency":
      case "date":
      case "ref":
        return "str"
      case "text-or-number":
        return "str | int | float"
      case "number":
        return field.integer ? "int" : "int | float"
      case "boolean":
        return "bool"
      case "enum":
        return `Literal[${field.values.map((v) => JSON.stringify(v)).join(", ")}]`
      case "scalar":
        return "Scalar"
      case "refs":
      case "strings":
        return "list[str]"
      case "scalars":
        return "list[Scalar]"
      case "record":
        return "dict[str, Scalar]"
      case "array":
        return `list[${typedDict(`${owner}${SINGULAR[key] ?? "Item"}`, field.of, field.doc)}]`
      case "object":
        return typedDict(cap(key), field.fields, field.doc)
    }
  }

  function typedDict(name: string, fields: Record<string, Field>, doc: string): string {
    const signature = JSON.stringify(fields)
    const have = typedDicts.get(name)
    if (have) {
      if (have.signature !== signature) throw new Error(`TypedDict ${name} defined twice with different fields`)
      return name
    }
    const lines = [`class ${name}(TypedDict, total=False):`, `    """${pyDoc(doc)}"""`, ""]
    for (const [k, f] of Object.entries(fields)) {
      const inner = annotation(f, name, k)
      lines.push(`    ${k}: ${f.required ? `Required[${inner}]` : inner}`, `    """${pyDoc(f.doc)}"""`)
    }
    // Registered after its members, so every TypedDict is defined before the ones that use it.
    typedDicts.set(name, { signature, lines })
    return name
  }

  const functions: string[] = []
  for (const spec of NODES) {
    const fields: Record<string, Field> = { ...commonFields, ...(spec.primaryCapable ? { primary: primaryField } : {}), ...spec.fields }
    type Param = { key: string; name: string; type: string; required: boolean; doc: string }
    const params: Param[] = Object.entries(fields).map(([key, f]) => {
      let type: string
      if (key === "importance" && spec.importance) type = `Literal[${spec.importance.map((v) => JSON.stringify(v)).join(", ")}]`
      else type = annotation(f, spec.type, key)
      return { key, name: pyName(key), type, required: key === "id" || !!f.required || (key === "intent" && spec.act) || (key === "consequence" && spec.type === "IrreversibleAction"), doc: f.doc }
    })
    const required = params.filter((p) => p.required)
    const optional = params.filter((p) => !p.required)
    const signature = [...required.map((p) => `    ${p.name}: ${p.type},`), ...optional.map((p) => `    ${p.name}: ${p.type} | None = None,`)]
    const acts = Object.entries(spec.acts)
    const doc = [
      pyDoc(spec.doc),
      "",
      ...(acts.length ? [`Replies: ${acts.map(([a, d]) => `${a}${d.value === "none" ? "" : d.value === "required" ? " (with value)" : " (value optional)"}`).join(", ")}.`, ""] : []),
      "Args:",
      ...params.map((p) => `    ${p.name}: ${pyDoc(p.doc)}${p.name !== p.key ? ` (the IR field "${p.key}")` : ""}`),
    ]
    functions.push(
      [
        `def ${spec.type}(`,
        "    *,",
        ...signature,
        ") -> dict[str, Any]:",
        `    """${doc.map((l) => (l ? `    ${l}` : l)).join("\n").trimStart()}`,
        `    """`,
        `    return _node(`,
        `        ${JSON.stringify(spec.type)},`,
        `        {${params.map((p) => `${JSON.stringify(p.key)}: ${p.name}`).join(", ")}},`,
        `    )`,
      ].join("\n")
    )
  }

  return `${[
    '"""One builder per feather.ir/0 node type. Each takes keyword arguments and returns the plain dict the IR is made of.',
    "",
    "Generated by packages/intent/scripts/generate.ts from packages/intent/src/spec.ts. Do not edit by hand.",
    "Builders do not validate; feather_sdk.validate() does.",
    '"""',
    "",
    "from __future__ import annotations",
    "",
    "from typing import Any, Literal, Required, TypedDict",
    "",
    "Scalar = str | int | float | bool",
    "",
    "",
    ...[...typedDicts.values()].flatMap((t) => [...t.lines, "", ""]),
    "def _drop_none(value: Any) -> Any:",
    "    if isinstance(value, dict):",
    "        return {k: _drop_none(v) for k, v in value.items() if v is not None}",
    "    if isinstance(value, (list, tuple)):",
    "        return [_drop_none(v) for v in value]",
    "    return value",
    "",
    "",
    "def _node(type_: str, fields: dict[str, Any]) -> dict[str, Any]:",
    '    return {"type": type_, **_drop_none(fields)}',
    "",
    "",
    functions.join("\n\n\n"),
    "",
    "",
    `__all__ = [${NODES.map((n) => JSON.stringify(n.type)).join(", ")}]`,
  ].join("\n")}\n`
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
if (isMain) {
  const outputs: Array<[string, string]> = [
    [SCHEMA_PATH, `${JSON.stringify(buildSchema(), null, 2)}\n`],
    [DOCS_PATH, buildDocs()],
    [PY_SPEC_PATH, buildPythonSpec()],
    [PY_NODES_PATH, buildPythonNodes()],
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
  if (!stale) console.log("schema, docs and Python files are up to date")
}
