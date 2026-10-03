// Validates an Experience IR document: its structure (from spec.ts) and the rules that span nodes (one primary act,
// irreversible acts state their consequence, references resolve). Every problem is reported at once, each with a
// stable code, a JSON Pointer to where it is, and a sentence saying what to change.
import { NODE_SPECS, PRESENTATIONAL_FIELDS, commonFields, primaryField, type Field, type NodeSpec } from "./spec.ts"
import { IR_VERSION, type Experience } from "./types.ts"

export type IssueCode =
  | "not-an-object"
  | "unsupported-version"
  | "missing-field"
  | "wrong-type"
  | "empty-text"
  | "too-long"
  | "unknown-field"
  | "presentational-field"
  | "not-primary-capable"
  | "unknown-node-type"
  | "invalid-id"
  | "duplicate-id"
  | "invalid-value"
  | "out-of-range"
  | "invalid-currency"
  | "invalid-date"
  | "too-few-items"
  | "empty-experience"
  | "empty-expandable"
  | "empty-consequence"
  | "dangling-reference"
  | "self-reference"
  | "wrong-reference-type"
  | "multiple-primary"
  | "irreversible-marked-reversible"
  | "irreversible-without-consequence"
  | "missing-text-equivalent"
  | "duplicate-option"
  | "unknown-option"
  | "too-many-selected"
  | "duplicate-step"
  | "empty-tradeoff"
  | "comparison-mismatch"

export interface Issue {
  code: IssueCode
  /** JSON Pointer to the offending value ("" is the whole document). */
  path: string
  message: string
  /** The id of the node the issue is in, when there is one. */
  node?: string
}

export type ValidationResult = { ok: true; experience: Experience } | { ok: false; issues: Issue[] }

const ID = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
const LOCALE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/
const CURRENCY = /^[A-Z]{3}$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/
const TOP_LEVEL = new Set(["ir", "experience", "locale", "nodes"])

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v)
const isScalar = (v: unknown) => typeof v === "string" || (typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean"
const pointer = (...parts: Array<string | number>) => parts.map((p) => `/${String(p).replace(/~/g, "~0").replace(/\//g, "~1")}`).join("")
const describe = (v: unknown) => (Array.isArray(v) ? "an array" : v === null ? "null" : typeof v === "object" ? "an object" : `a ${typeof v}`)

/** Validates a feather.ir/0 document. Never throws. */
export function validate(input: unknown): ValidationResult {
  const issues: Issue[] = []
  const add = (code: IssueCode, path: string, message: string, node?: string) => issues.push(node === undefined ? { code, path, message } : { code, path, message, node })

  if (!isObject(input)) {
    add("not-an-object", "", `An experience is a JSON object with "ir", "experience" and "nodes"; got ${describe(input)}.`)
    return { ok: false, issues }
  }

  // ── The document ──────────────────────────────────────────────────────────────────────────────────────────────
  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL.has(key)) unknownField(add, pointer(key), key, "the experience", [...TOP_LEVEL])
  }
  if (input.ir === undefined) add("missing-field", "/ir", `Say which IR this is: "ir": "${IR_VERSION}".`)
  else if (typeof input.ir !== "string") {
    add("wrong-type", "/ir", `ir must be the string "${IR_VERSION}"; got ${describe(input.ir)}.`)
    return { ok: false, issues }
  } else if (input.ir !== IR_VERSION) {
    add("unsupported-version", "/ir", `This Feather reads ${IR_VERSION}; the document is ${JSON.stringify(input.ir)}.`)
    return { ok: false, issues }
  }
  if (input.experience === undefined) add("missing-field", "/experience", 'Name the experience ("experience": "approve_campaign"); replies carry the name back.')
  else if (typeof input.experience !== "string" || !ID.test(input.experience)) {
    add("invalid-id", "/experience", `The experience name must start with a letter and use letters, digits, "_", "." or "-" (at most 64); got ${JSON.stringify(input.experience)}.`)
  }
  if (input.locale !== undefined && (typeof input.locale !== "string" || !LOCALE.test(input.locale))) {
    add("invalid-value", "/locale", `locale must be a BCP 47 language tag such as "en" or "ar-AE"; got ${JSON.stringify(input.locale)}.`)
  }
  if (input.nodes === undefined) {
    add("missing-field", "/nodes", "An experience needs its nodes: the interaction, as meaning.")
    return { ok: false, issues }
  }
  if (!Array.isArray(input.nodes)) {
    add("wrong-type", "/nodes", `nodes must be an array; got ${describe(input.nodes)}.`)
    return { ok: false, issues }
  }
  if (input.nodes.length === 0) add("empty-experience", "/nodes", "An experience with no nodes renders nothing; send at least one node, or no experience.")

  // ── Each node, on its own ─────────────────────────────────────────────────────────────────────────────────────
  const nodes = input.nodes as unknown[]
  const byId = new Map<string, { node: Json; spec: NodeSpec; index: number }>()
  nodes.forEach((node, index) => {
    const at = pointer("nodes", index)
    if (!isObject(node)) {
      add("not-an-object", at, `Each node is a JSON object with a "type" and an "id"; got ${describe(node)}.`)
      return
    }
    const id = typeof node.id === "string" ? node.id : undefined
    if (node.type === undefined) {
      add("missing-field", `${at}/type`, `Node ${index}${id ? ` ("${id}")` : ""} needs a "type".`, id)
      return
    }
    const spec = typeof node.type === "string" ? NODE_SPECS[node.type] : undefined
    if (!spec) {
      const guess = typeof node.type === "string" ? closest(node.type, Object.keys(NODE_SPECS)) : undefined
      add("unknown-node-type", `${at}/type`, `${JSON.stringify(node.type)} is not a feather.ir/0 node type${guess ? `; did you mean ${guess}?` : "."}`, id)
      return
    }
    const name = `${spec.type}${id ? ` "${id}"` : ` at ${at}`}`
    const fields: Record<string, Field> = { ...commonFields, ...(spec.primaryCapable ? { primary: primaryField } : {}), ...spec.fields }

    for (const key of Object.keys(node)) {
      if (key === "type" || key in fields) continue
      if (key === "primary") add("not-primary-capable", pointer("nodes", index, key), `${name} cannot be the primary act; only Action, Choice, Input, Approval, Recommendation and IrreversibleAction can.`, id)
      else unknownField(add, pointer("nodes", index, key), key, name, ["type", ...Object.keys(fields)], id)
    }
    if (spec.act && node.intent === undefined) add("missing-field", `${at}/intent`, `${name} is an act, so it needs an intent: what the person is doing, in a few words.`, id)
    if (spec.type === "IrreversibleAction" && node.consequence === undefined) {
      add("irreversible-without-consequence", `${at}/consequence`, `${name} cannot be undone, so it must state its consequence exactly (spend, publish, send, consent, delete or a statement). Principle 6: irreversible means explicit.`, id)
    }
    for (const [key, field] of Object.entries(fields)) {
      if (spec.type === "IrreversibleAction" && key === "consequence" && node[key] === undefined) continue
      checkField(add, node[key], field, pointer("nodes", index, key), key, name, id)
    }

    if (id !== undefined) {
      if (!ID.test(id)) add("invalid-id", `${at}/id`, `Node ids start with a letter and use letters, digits, "_", "." or "-" (at most 64); got ${JSON.stringify(id)}.`, id)
      else if (byId.has(id)) add("duplicate-id", `${at}/id`, `Two nodes are called "${id}" (nodes ${byId.get(id)!.index} and ${index}); ids must be unique so replies reach the right one.`, id)
      else byId.set(id, { node, spec, index })
    }
  })

  // ── Across nodes ──────────────────────────────────────────────────────────────────────────────────────────────
  for (const { node, spec, index } of byId.values()) {
    const id = node.id as string
    const name = `${spec.type} "${id}"`
    const at = pointer("nodes", index)
    const fields = spec.fields

    for (const [key, field] of Object.entries(fields)) {
      if (field.kind !== "ref" && field.kind !== "refs") continue
      const value = node[key]
      const refs = field.kind === "ref" ? (typeof value === "string" ? [[value, `${at}/${key}`]] : []) : Array.isArray(value) ? value.filter((v) => typeof v === "string").map((v, i) => [v, `${at}/${key}/${i}`]) : []
      for (const [ref, path] of refs) {
        const target = byId.get(ref)
        if (ref === id) add("self-reference", path, `${name} refers to itself in ${key}.`, id)
        else if (!target) add("dangling-reference", path, `${name} refers to "${ref}" in ${key}, but no node has that id.`, id)
        else if (field.to && !field.to.includes(target.spec.type)) add("wrong-reference-type", path, `${name}.${key} must point at a ${field.to.join(" or ")}; "${ref}" is a ${target.spec.type}.`, id)
      }
    }
    checkNode(add, node, spec, at, name, id, byId)
  }

  // One primary act per experience (composer rule 1).
  // Only nodes that can be primary count; a primary flag elsewhere is already reported as not-primary-capable.
  const primaries = [...byId.values()].filter(({ node, spec }) => spec.primaryCapable && node.primary === true)
  for (const extra of primaries.slice(1)) {
    const first = primaries[0].node.id as string
    add("multiple-primary", pointer("nodes", extra.index, "primary"), `An experience has one primary act; "${first}" already is, so "${extra.node.id}" cannot also be.`, extra.node.id as string)
  }

  // Irreversible acts state their consequence (principle 6): on the node itself, or through an IrreversibleAction.
  const hasIrreversibleAction = [...byId.values()].some(({ spec }) => spec.type === "IrreversibleAction")
  for (const { node, spec, index } of byId.values()) {
    if (spec.type === "IrreversibleAction") continue
    if (spec.act && node.reversible === false && node.consequence === undefined && !hasIrreversibleAction) {
      add(
        "irreversible-without-consequence",
        pointer("nodes", index, "reversible"),
        `${spec.type} "${node.id}" cannot be undone, but nothing states what it does. Give it a consequence${"consequence" in spec.fields ? "" : " through an IrreversibleAction"} (principle 6: irreversible means explicit).`,
        node.id as string
      )
    }
  }

  return issues.length === 0 ? { ok: true, experience: input as unknown as Experience } : { ok: false, issues }
}

type Add = (code: IssueCode, path: string, message: string, node?: string) => void

function unknownField(add: Add, path: string, key: string, where: string, known: string[], node?: string) {
  if (PRESENTATIONAL_FIELDS.has(key)) {
    add("presentational-field", path, `"${key}" describes presentation; ${where} carries meaning only, and Feather decides how it looks (principle 1: semantics, not pixels).`, node)
  } else {
    const guess = closest(key, known)
    add("unknown-field", path, `${where} has no field "${key}"${guess ? `; did you mean "${guess}"?` : "."}`, node)
  }
}

function checkField(add: Add, value: unknown, field: Field, path: string, key: string, where: string, node?: string) {
  if (value === undefined) {
    if (field.required) add("missing-field", path, `${where} needs "${key}": ${lower(field.doc)}`, node)
    return
  }
  const wrong = (expected: string) => add("wrong-type", path, `${where}.${key} must be ${expected}; got ${describe(value)}.`, node)
  switch (field.kind) {
    case "string":
    case "ref":
      if (typeof value !== "string") return wrong("a string")
      if (value.trim() === "") return add("empty-text", path, `${where}.${key} is empty.`, node)
      if (field.kind === "string" && field.maxLength && value.length > field.maxLength) add("too-long", path, `${where}.${key} is ${value.length} characters; keep it to ${field.maxLength}.`, node)
      return
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return wrong("a number")
      if (field.integer && !Number.isInteger(value)) return add("invalid-value", path, `${where}.${key} must be a whole number; got ${value}.`, node)
      if ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) {
        add("out-of-range", path, `${where}.${key} must be ${range(field.min, field.max)}; got ${value}.`, node)
      }
      return
    case "boolean":
      if (typeof value !== "boolean") wrong("true or false")
      return
    case "enum":
      if (typeof value !== "string" || !field.values.includes(value)) add("invalid-value", path, `${where}.${key} must be one of ${field.values.join(", ")}; got ${JSON.stringify(value)}.`, node)
      return
    case "currency":
      if (typeof value !== "string" || !CURRENCY.test(value)) add("invalid-currency", path, `${where}.${key} must be an ISO 4217 currency code, three capital letters such as AED or USD; got ${JSON.stringify(value)}.`, node)
      return
    case "date":
      if (typeof value !== "string" || !isIsoDate(value)) add("invalid-date", path, `${where}.${key} must be an ISO 8601 date or date-time such as 2026-10-03 or 2026-10-03T14:00:00+04:00; got ${JSON.stringify(value)}.`, node)
      return
    case "scalar":
      if (!isScalar(value)) wrong("a string, number or boolean")
      return
    case "refs":
    case "strings":
    case "scalars": {
      if (!Array.isArray(value)) return wrong("an array")
      const ok = field.kind === "scalars" ? isScalar : (v: unknown) => typeof v === "string" && v.trim() !== ""
      value.forEach((v, i) => {
        if (!ok(v)) add("wrong-type", `${path}/${i}`, `${where}.${key}[${i}] must be ${field.kind === "scalars" ? "a string, number or boolean" : "a non-empty string"}; got ${describe(v)}.`, node)
      })
      if (field.minItems && value.length < field.minItems) add("too-few-items", path, `${where}.${key} needs at least ${field.minItems}; it has ${value.length}.`, node)
      return
    }
    case "array":
      if (!Array.isArray(value)) return wrong("an array")
      if (field.minItems && value.length < field.minItems) add("too-few-items", path, `${where}.${key} needs at least ${field.minItems}; it has ${value.length}.`, node)
      value.forEach((item, i) => checkObject(add, item, field.of, `${path}/${i}`, `${where}.${key}[${i}]`, node, false))
      return
    case "object":
      checkObject(add, value, field.fields, path, `${where}.${key}`, node, field.atLeastOne ?? false, key)
      return
    case "record":
      if (!isObject(value)) return wrong("an object")
      for (const [k, v] of Object.entries(value)) {
        if (!isScalar(v)) add("wrong-type", `${path}/${k}`, `${where}.${key}.${k} must be a string, number or boolean; got ${describe(v)}.`, node)
      }
      return
  }
}

function checkObject(add: Add, value: unknown, fields: Record<string, Field>, path: string, where: string, node: string | undefined, atLeastOne: boolean, key?: string) {
  if (!isObject(value)) return add("wrong-type", path, `${where} must be an object; got ${describe(value)}.`, node)
  for (const k of Object.keys(value)) if (!(k in fields)) unknownField(add, `${path}/${k}`, k, where, Object.keys(fields), node)
  if (atLeastOne && !Object.keys(fields).some((k) => value[k] !== undefined)) {
    const code = key === "consequence" ? "empty-consequence" : "empty-expandable"
    add(code, path, `${where} is empty; give at least one of ${Object.keys(fields).join(", ")}.`, node)
  }
  for (const [k, f] of Object.entries(fields)) checkField(add, value[k], f, `${path}/${k}`, k, where, node)
}

/** Rules particular to one node type, run once every node has been read. */
function checkNode(add: Add, node: Json, spec: NodeSpec, at: string, name: string, id: string, byId: Map<string, { node: Json; spec: NodeSpec; index: number }>) {
  switch (spec.type) {
    case "Choice": {
      const ids = optionIds(node)
      const seen = new Set<string>()
      ids.forEach((o, i) => {
        if (seen.has(o)) add("duplicate-option", `${at}/options/${i}/id`, `${name} has two options called "${o}".`, id)
        seen.add(o)
      })
      const selected = Array.isArray(node.selected) ? node.selected.filter((s): s is string => typeof s === "string") : []
      selected.forEach((s, i) => {
        if (!seen.has(s)) add("unknown-option", `${at}/selected/${i}`, `${name} marks "${s}" selected, but it has no such option (${ids.join(", ")}).`, id)
      })
      if (node.multiple !== true && selected.length > 1) add("too-many-selected", `${at}/selected`, `${name} allows one pick but marks ${selected.length} selected; set "multiple": true or select one.`, id)
      return
    }
    case "Input":
      if (typeof node.min === "number" && typeof node.max === "number" && node.min > node.max) add("out-of-range", `${at}/min`, `${name} accepts nothing: min ${node.min} is above max ${node.max}.`, id)
      if (node.kind === "money" && node.currency === undefined) add("missing-field", `${at}/currency`, `${name} asks for money, so it needs a currency.`, id)
      return
    case "Date":
      if (typeof node.value === "string" && typeof node.until === "string" && isIsoDate(node.value) && isIsoDate(node.until) && Date.parse(node.until) < Date.parse(node.value)) {
        add("out-of-range", `${at}/until`, `${name} ends (${node.until}) before it starts (${node.value}).`, id)
      }
      return
    case "Progress": {
      const seen = new Set<string>()
      ;(Array.isArray(node.steps) ? node.steps : []).forEach((step, i) => {
        const sid = isObject(step) ? step.id : undefined
        if (typeof sid !== "string") return
        if (seen.has(sid)) add("duplicate-step", `${at}/steps/${i}/id`, `${name} has two steps called "${sid}".`, id)
        seen.add(sid)
      })
      return
    }
    case "Media": {
      const missing =
        (node.kind === "image" || node.kind === "video") && node.alt === undefined
          ? "alt text saying what it shows"
          : node.kind === "audio" && node.transcript === undefined
            ? "a transcript"
            : node.kind === "video" && node.transcript === undefined && node.captions === undefined
              ? "captions or a transcript"
              : undefined
      if (missing) add("missing-text-equivalent", at, `${name} is ${node.kind === "image" ? "an" : "a"} ${node.kind} without ${missing}; every medium needs a text equivalent so it reaches people who cannot see or hear it.`, id)
      return
    }
    case "PredictedChoice": {
      const choice = typeof node.of === "string" ? byId.get(node.of) : undefined
      if (choice?.spec.type === "Choice" && typeof node.option === "string" && !optionIds(choice.node).includes(node.option)) {
        add("unknown-option", `${at}/option`, `${name} predicts "${node.option}", but Choice "${node.of}" has no such option (${optionIds(choice.node).join(", ")}).`, id)
      }
      return
    }
    case "Tradeoff": {
      const count = (k: string) => (Array.isArray(node[k]) ? (node[k] as unknown[]).length : 0)
      if (count("gains") + count("costs") === 0) add("empty-tradeoff", at, `${name} names no gains and no costs; a tradeoff needs at least one.`, id)
      return
    }
    case "Comparison": {
      const items = Array.isArray(node.items) ? node.items.filter((v): v is string => typeof v === "string") : []
      ;(Array.isArray(node.criteria) ? node.criteria : []).forEach((criterion, i) => {
        if (!isObject(criterion) || !isObject(criterion.values)) return
        const keys = Object.keys(criterion.values)
        const missing = items.filter((item) => !keys.includes(item))
        const extra = keys.filter((k) => !items.includes(k))
        if (missing.length || extra.length) {
          add("comparison-mismatch", `${at}/criteria/${i}/values`, `${name}: criterion "${String(criterion.label)}" must give one value per item${missing.length ? `; missing ${missing.join(", ")}` : ""}${extra.length ? `; ${extra.join(", ")} ${extra.length === 1 ? "is" : "are"} not compared` : ""}.`, id)
        }
      })
      return
    }
    case "Preference":
      if (Array.isArray(node.options) && isScalar(node.value) && !node.options.includes(node.value)) {
        add("unknown-option", `${at}/value`, `${name}'s value ${JSON.stringify(node.value)} is not one of its options (${node.options.map((o) => JSON.stringify(o)).join(", ")}).`, id)
      }
      return
    case "IrreversibleAction":
      if (node.reversible === true) add("irreversible-marked-reversible", `${at}/reversible`, `${name} is irreversible by definition; drop "reversible": true, or use an Action if it can be undone.`, id)
      return
  }
}

/** Formats issues for people: one line each, with the path and the code. */
export function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `- ${i.path || "(document)"}: ${i.message} [${i.code}]`).join("\n")
}

const optionIds = (node: Json) => (Array.isArray(node.options) ? node.options.map((o) => (isObject(o) ? o.id : undefined)).filter((v): v is string => typeof v === "string") : [])
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const range = (min?: number, max?: number) => (min !== undefined && max !== undefined ? `between ${min} and ${max}` : min !== undefined ? `at least ${min}` : `at most ${max}`)

function isIsoDate(value: string) {
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const [, y, mo, d] = m.map(Number)
  const day = new Date(Date.UTC(y, mo - 1, d))
  return day.getUTCFullYear() === y && day.getUTCMonth() === mo - 1 && day.getUTCDate() === d && !Number.isNaN(Date.parse(value))
}

/** The known name closest to a misspelling, if it is close enough to be a likely typo. */
function closest(word: string, known: string[]) {
  let best: string | undefined
  let bestDistance = Infinity
  for (const k of known) {
    const d = distance(word.toLowerCase(), k.toLowerCase())
    if (d < bestDistance) [best, bestDistance] = [k, d]
  }
  return best !== undefined && bestDistance <= Math.max(2, Math.floor(word.length / 4)) ? best : undefined
}

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
