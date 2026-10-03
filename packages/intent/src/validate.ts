// Validates an Experience IR document: its structure (from spec.ts) and the rules that span nodes (one primary act,
// irreversible acts state or are confirmed with their consequence, references resolve to the right kind of node,
// alternatives follow what they are alternatives to). Every problem is reported at once, up to a limit, each with a
// stable code, a JSON Pointer to where it is, and a sentence saying what to change. It never throws.
import { DEFAULT_MAX_LENGTH, NODE_SPECS, PRESENTATIONAL_FIELDS, commonFields, primaryField, specFor, type Field, type NodeSpec } from "./spec.ts"
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
  | "duplicate-item"
  | "empty-experience"
  | "empty-expandable"
  | "empty-consequence"
  | "dangling-reference"
  | "self-reference"
  | "wrong-reference-type"
  | "out-of-order"
  | "ambiguous-alternative"
  | "unneeded-confirmation"
  | "multiple-primary"
  | "irreversible-marked-reversible"
  | "irreversible-without-consequence"
  | "missing-text-equivalent"
  | "duplicate-option"
  | "unknown-option"
  | "too-many-selected"
  | "conflicting-prediction"
  | "duplicate-step"
  | "empty-tradeoff"
  | "comparison-mismatch"
  | "too-many-issues"
  | "unreadable"

export interface Issue {
  code: IssueCode
  /** JSON Pointer to the offending value ("" is the whole document). */
  path: string
  message: string
  /** The id of the node the issue is in, when there is one. */
  node?: string
}

export type ValidationResult = { ok: true; experience: Experience } | { ok: false; issues: Issue[] }

/** At most this many issues are reported; past it, one more says the document is too broken to list. */
export const MAX_ISSUES = 100

export const ID = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
const LOCALE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/
const CURRENCY = /^[A-Z]{3}$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/
const TOP_LEVEL = new Set(["ir", "experience", "locale", "nodes"])
const IMPORTANCE = ["low", "normal", "high", "critical"]

type Json = Record<string, unknown>
type Add = (code: IssueCode, path: string, message: string, node?: string) => void
type Entry = { node: Json; spec: NodeSpec; index: number; id?: string; name: string; at: string }

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v)
export const isScalar = (v: unknown) => typeof v === "string" || (typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean"
const has = (o: object, k: string) => Object.hasOwn(o, k)
/** One JSON Pointer segment, escaped (RFC 6901). */
export const seg = (p: string | number) => (typeof p === "number" || !/[~/]/.test(p) ? `/${p}` : `/${p.replace(/~/g, "~0").replace(/\//g, "~1")}`)
const pointer = (...parts: Array<string | number>) => parts.map(seg).join("")
const describe = (v: unknown) =>
  Array.isArray(v) ? "an array" : v === null ? "null" : typeof v === "object" ? "an object" : typeof v === "number" && !Number.isFinite(v) ? String(v) : `a ${typeof v}`
/** Length in Unicode code points, not UTF-16 units. */
export const chars = (s: string) => [...s].length
const quote = (v: unknown) => {
  let s: string
  try {
    s = JSON.stringify(v) ?? String(v)
  } catch {
    s = describe(v)
  }
  return s.length > 80 ? `${s.slice(0, 77)}…` : s
}

class Overflow extends Error {}

/** Validates a feather.ir/0 document. Never throws. */
export function validate(input: unknown): ValidationResult {
  const issues: Issue[] = []
  const add: Add = (code, path, message, node) => {
    if (issues.length === MAX_ISSUES) {
      issues.push({ code: "too-many-issues", path: "", message: `More than ${MAX_ISSUES} problems; fix these first, then validate again.` })
      throw new Overflow()
    }
    issues.push(node === undefined ? { code, path, message } : { code, path, message, node })
  }
  try {
    run(input, add)
  } catch (err) {
    // A document that cannot even be read (a throwing getter, a value JSON cannot hold) is reported, never thrown.
    if (!(err instanceof Overflow)) issues.push({ code: "unreadable", path: "", message: `The document could not be read as JSON data (${err instanceof Error ? err.message : String(err)}); send plain JSON.` })
  }
  return issues.length === 0 ? { ok: true, experience: input as Experience } : { ok: false, issues }
}

function run(input: unknown, add: Add) {
  if (!isObject(input)) {
    add("not-an-object", "", `An experience is a JSON object with "ir", "experience" and "nodes"; got ${describe(input)}.`)
    return
  }

  // ── The document ──────────────────────────────────────────────────────────────────────────────────────────────
  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL.has(key)) unknownField(add, pointer(key), key, "the experience", [...TOP_LEVEL])
  }
  if (input.ir === undefined) add("missing-field", "/ir", `Say which IR this is: "ir": "${IR_VERSION}".`)
  else if (typeof input.ir !== "string") {
    add("wrong-type", "/ir", `ir must be the string "${IR_VERSION}"; got ${describe(input.ir)}.`)
    return
  } else if (input.ir !== IR_VERSION) {
    add("unsupported-version", "/ir", `This Feather reads ${IR_VERSION}; the document is ${quote(input.ir)}.`)
    return
  }
  if (input.experience === undefined) add("missing-field", "/experience", 'Name the experience ("experience": "approve_campaign"); replies carry the name back.')
  else if (typeof input.experience !== "string" || !ID.test(input.experience)) {
    add("invalid-id", "/experience", `The experience name must start with a letter and use letters, digits, "_", "." or "-" (at most 64); got ${quote(input.experience)}.`)
  }
  if (input.locale !== undefined && (typeof input.locale !== "string" || !LOCALE.test(input.locale))) {
    add("invalid-value", "/locale", `locale must be a BCP 47 language tag such as "en" or "ar-AE"; got ${quote(input.locale)}.`)
  }
  if (input.nodes === undefined) {
    add("missing-field", "/nodes", "An experience needs its nodes: the interaction, as meaning.")
    return
  }
  if (!Array.isArray(input.nodes)) {
    add("wrong-type", "/nodes", `nodes must be an array; got ${describe(input.nodes)}.`)
    return
  }
  if (input.nodes.length === 0) add("empty-experience", "/nodes", "An experience with no nodes renders nothing; send at least one node, or no experience.")

  // ── Each node, on its own ─────────────────────────────────────────────────────────────────────────────────────
  const entries: Entry[] = []
  /** The first node with each id, valid or not, so references still resolve to a node whose id is malformed. */
  const byId = new Map<string, Entry>()
  ;(input.nodes as unknown[]).forEach((node, index) => {
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
    const spec = specFor(node.type)
    if (!spec) {
      const guess = typeof node.type === "string" ? closest(node.type, Object.keys(NODE_SPECS)) : undefined
      add("unknown-node-type", `${at}/type`, `${quote(node.type)} is not a feather.ir/0 node type${guess ? `; did you mean ${guess}?` : "."}`, id)
      return
    }
    const name = `${spec.type}${id ? ` "${id}"` : ` at ${at}`}`
    const entry: Entry = { node, spec, index, id, name, at }
    entries.push(entry)
    const fields = fieldsOf(spec)

    for (const key of Object.keys(node)) {
      if (key === "type" || has(fields, key)) continue
      if (key === "primary") {
        // "primary": false says nothing, so it is allowed on any node.
        if (node.primary !== false) add("not-primary-capable", `${at}${seg(key)}`, `${name} cannot be the primary act; only Action, Choice, Input, Approval, Recommendation and IrreversibleAction can.`, id)
      } else unknownField(add, `${at}${seg(key)}`, key, name, ["type", ...Object.keys(fields)], id)
    }
    if (spec.act && node.intent === undefined) add("missing-field", `${at}/intent`, `${name} is an act, so it needs an intent: what the person is doing, in a few words.`, id)
    if (spec.type === "IrreversibleAction" && node.consequence === undefined) {
      add("irreversible-without-consequence", `${at}/consequence`, `${name} cannot be undone, so it must state its consequence exactly (spend, publish, send, consent, delete or a statement). Principle 6: irreversible means explicit.`, id)
    }
    for (const [key, field] of Object.entries(fields)) {
      if (spec.type === "IrreversibleAction" && key === "consequence" && node[key] === undefined) continue
      checkField(add, has(node, key) ? node[key] : undefined, field, `${at}${seg(key)}`, key, name, id)
    }
    if (spec.type !== "IrreversibleAction" && node.consequence !== undefined && node.reversible === true) {
      add("irreversible-marked-reversible", `${at}/reversible`, `${name} states a consequence, and an act with a consequence to state cannot be undone (principle 6); drop "reversible": true, or drop the consequence.`, id)
    }
    if (spec.importance && typeof node.importance === "string" && IMPORTANCE.includes(node.importance) && !spec.importance.includes(node.importance)) {
      add("invalid-value", `${at}/importance`, `${name} cannot be undone, so its importance is ${spec.importance.join(" or ")}, never ${node.importance}.`, id)
    }

    if (id !== undefined) {
      if (!ID.test(id)) add("invalid-id", `${at}/id`, `Node ids start with a letter and use letters, digits, "_", "." or "-" (at most 64); got ${quote(id)}.`, id)
      const first = byId.get(id)
      if (first) add("duplicate-id", `${at}/id`, `Two nodes are called "${id}" (nodes ${first.index} and ${index}); ids must be unique so replies reach the right one.`, id)
      else byId.set(id, entry)
    }
  })

  // ── Across nodes ──────────────────────────────────────────────────────────────────────────────────────────────
  for (const entry of entries) checkReferences(add, entry, byId)
  const predictions = new Map<string, Entry[]>()
  for (const e of entries) {
    if (e.spec.type === "PredictedChoice" && typeof e.node.of === "string") predictions.set(e.node.of, [...(predictions.get(e.node.of) ?? []), e])
  }
  const across: Across = { byId, predictions, recommendations: entries.filter((e) => e.spec.type === "Recommendation").length }
  for (const entry of entries) checkNode(add, entry, across)

  // One primary act per experience (composer rule 1). Only nodes that can be primary count; a primary flag elsewhere
  // is already reported as not-primary-capable.
  const primaries = entries.filter(({ node, spec }) => spec.primaryCapable && node.primary === true)
  for (const extra of primaries.slice(1)) {
    add("multiple-primary", `${extra.at}/primary`, `An experience has one primary act; ${primaries[0].name} already is, so ${extra.name} cannot also be.`, extra.id)
  }

  // Irreversible acts state their consequence (principle 6): on the node itself, or through the IrreversibleAction
  // that confirms them, named by its "confirms", or implied when the experience has exactly one.
  const confirmers = entries.filter(({ spec }) => spec.type === "IrreversibleAction")
  const confirmed = new Set(confirmers.map(({ node }) => node.confirms).filter((c): c is string => typeof c === "string"))
  const implicit = confirmers.length === 1 && confirmers[0].node.confirms === undefined
  for (const { node, spec, at, name, id } of entries) {
    if (spec.type === "IrreversibleAction" || !spec.act || node.reversible !== false || node.consequence !== undefined) continue
    if (implicit || (id !== undefined && confirmed.has(id))) continue
    add(
      "irreversible-without-consequence",
      `${at}/reversible`,
      `${name} cannot be undone, but nothing states what it does. ${"consequence" in spec.fields ? "Give it a consequence, or confirm it" : "Confirm it"} with an IrreversibleAction whose "confirms" is "${id ?? "its id"}" (principle 6: irreversible means explicit).`,
      id
    )
  }
}

const FIELDS = new Map<NodeSpec, Record<string, Field>>()
/** Every field a node of this type may have. Computed once per type. */
function fieldsOf(spec: NodeSpec): Record<string, Field> {
  let fields = FIELDS.get(spec)
  if (!fields) FIELDS.set(spec, (fields = allFields(spec)))
  return fields
}

function allFields(spec: NodeSpec): Record<string, Field> {
  return Object.assign(Object.create(null) as Record<string, Field>, commonFields, spec.primaryCapable ? { primary: primaryField } : {}, spec.fields)
}

function unknownField(add: Add, path: string, key: string, where: string, known: string[], node?: string) {
  if (PRESENTATIONAL_FIELDS.has(key)) {
    add("presentational-field", path, `"${key}" describes presentation; ${where} carries meaning only, and Feather decides how it looks (principle 1: semantics, not pixels).`, node)
  } else {
    const guess = closest(key, known)
    add("unknown-field", path, `${where} has no field ${quote(key)}${guess ? `; did you mean "${guess}"?` : "."}`, node)
  }
}

function checkField(add: Add, value: unknown, field: Field, path: string, key: string, where: string, node?: string) {
  if (value === undefined) {
    if (field.required) add("missing-field", path, `${where} needs "${key}": ${lower(field.doc)}`, node)
    return
  }
  const wrong = (expected: string) => add("wrong-type", path, `${where}.${key} must be ${expected}; got ${describe(value)}.`, node)
  const tooLong = (s: string, max: number) => {
    if (chars(s) > max) add("too-long", path, `${where}.${key} is ${chars(s)} characters; keep it to ${max}.`, node)
  }
  switch (field.kind) {
    case "string":
    case "ref":
    case "id": {
      if (typeof value !== "string") return wrong("a string")
      if (value.trim() === "") return add("empty-text", path, `${where}.${key} is empty.`, node)
      if (field.kind === "id" && !ID.test(value)) return add("invalid-id", path, `${where}.${key} must start with a letter and use letters, digits, "_", "." or "-" (at most 64); got ${quote(value)}.`, node)
      return tooLong(value, field.kind === "string" ? (field.maxLength ?? DEFAULT_MAX_LENGTH) : 64)
    }
    case "text-or-number":
      if (typeof value === "string") return tooLong(value, DEFAULT_MAX_LENGTH)
      if (typeof value !== "number" || !Number.isFinite(value)) wrong("a string or a number")
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
      if (typeof value !== "string" || !field.values.includes(value)) add("invalid-value", path, `${where}.${key} must be one of ${field.values.join(", ")}; got ${quote(value)}.`, node)
      return
    case "currency":
      if (typeof value !== "string" || !CURRENCY.test(value)) add("invalid-currency", path, `${where}.${key} must be an ISO 4217 currency code, three capital letters such as AED or USD; got ${quote(value)}.`, node)
      return
    case "date":
      if (typeof value !== "string" || !parseDate(value)) add("invalid-date", path, `${where}.${key} must be an ISO 8601 date or date-time such as 2026-10-03 or 2026-10-03T14:00:00+04:00; got ${quote(value)}.`, node)
      return
    case "scalar":
      if (!isScalar(value)) return wrong("a string, number or boolean")
      if (typeof value === "string") tooLong(value, DEFAULT_MAX_LENGTH)
      return
    case "refs":
    case "strings":
    case "scalars": {
      if (!Array.isArray(value)) return wrong("an array")
      const ok = field.kind === "scalars" ? isScalar : (v: unknown) => typeof v === "string" && v.trim() !== "" && chars(v) <= DEFAULT_MAX_LENGTH
      value.forEach((v, i) => {
        if (!ok(v)) add("wrong-type", `${path}/${i}`, `${where}.${key}[${i}] must be ${field.kind === "scalars" ? "a string, number or boolean" : `a non-empty string of at most ${DEFAULT_MAX_LENGTH} characters`}; got ${describe(v)}.`, node)
      })
      if (field.minItems && value.length < field.minItems) add("too-few-items", path, `${where}.${key} needs at least ${field.minItems}; it has ${value.length}.`, node)
      if (field.kind === "refs" && field.unique) {
        const seen = new Set<unknown>()
        value.forEach((v, i) => {
          if (seen.has(v)) add("duplicate-item", `${path}/${i}`, `${where}.${key} lists ${quote(v)} twice.`, node)
          seen.add(v)
        })
      }
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
        if (!isScalar(v)) add("wrong-type", `${path}${seg(k)}`, `${where}.${key}.${k} must be a string, number or boolean; got ${describe(v)}.`, node)
      }
      return
  }
}

function checkObject(add: Add, value: unknown, fields: Record<string, Field>, path: string, where: string, node: string | undefined, atLeastOne: boolean, key?: string) {
  if (!isObject(value)) return add("wrong-type", path, `${where} must be an object; got ${describe(value)}.`, node)
  for (const k of Object.keys(value)) if (!has(fields, k)) unknownField(add, `${path}${seg(k)}`, k, where, Object.keys(fields), node)
  if (atLeastOne && !Object.keys(fields).some((k) => has(value, k) && value[k] !== undefined)) {
    const code = key === "consequence" ? "empty-consequence" : "empty-expandable"
    add(code, path, `${where} is empty; give at least one of ${Object.keys(fields).join(", ")}.`, node)
  }
  for (const [k, f] of Object.entries(fields)) checkField(add, has(value, k) ? value[k] : undefined, f, `${path}${seg(k)}`, k, where, node)
}

/** References resolve, to a node of the right type, never to the node itself. */
function checkReferences(add: Add, { node, spec, at, name, id }: Entry, byId: Map<string, Entry>) {
  for (const [key, field] of Object.entries(spec.fields)) {
    if (field.kind !== "ref" && field.kind !== "refs") continue
    const value = node[key]
    const refs: Array<[string, string]> =
      field.kind === "ref"
        ? typeof value === "string" && value.trim() !== ""
          ? [[value, `${at}${seg(key)}`]]
          : []
        : Array.isArray(value)
          ? value.flatMap((v, i) => (typeof v === "string" && v.trim() !== "" ? [[v, `${at}${seg(key)}/${i}`] as [string, string]] : []))
          : []
    for (const [ref, path] of refs) {
      const target = byId.get(ref)
      if (ref === id) add("self-reference", path, `${name} refers to itself in ${key}.`, id)
      else if (!target) add("dangling-reference", path, `${name} refers to ${quote(ref)} in ${key}, but no node has that id.`, id)
      else if (field.to && !field.to.includes(target.spec.type)) {
        add("wrong-reference-type", path, `${name}.${key} must point at a ${field.to.join(", ").replace(/, ([^,]*)$/, " or $1")}; "${ref}" is a ${target.spec.type}.`, id)
      }
    }
  }
}

/** Rules particular to one node type, and rules about where it stands among the others. */
type Across = { byId: Map<string, Entry>; predictions: Map<string, Entry[]>; recommendations: number }

function checkNode(add: Add, { node, spec, at, name, id, index }: Entry, { byId, predictions: predictionsOf, recommendations }: Across) {
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
        if (!seen.has(s)) add("unknown-option", `${at}/selected/${i}`, `${name} marks ${quote(s)} selected, but it has no such option (${ids.join(", ")}).`, id)
      })
      if (node.multiple !== true && selected.length > 1) add("too-many-selected", `${at}/selected`, `${name} allows one pick but marks ${selected.length} selected; set "multiple": true or select one.`, id)
      // Preselection is decided once (composer rule 3): one prediction per Choice, agreeing with what is selected.
      if (id === undefined) return
      const predictions = predictionsOf.get(id) ?? []
      for (const extra of predictions.slice(1)) {
        add("conflicting-prediction", `${extra.at}/of`, `${name} already has a prediction (${predictions[0].name}); a Choice has at most one, or its preselection would be ambiguous.`, extra.id)
      }
      const first = predictions[0]
      if (first && selected.length > 0 && typeof first.node.option === "string" && seen.has(first.node.option) && !selected.includes(first.node.option)) {
        add("conflicting-prediction", `${first.at}/option`, `${first.name} predicts "${first.node.option}", but ${name} already has ${selected.join(", ")} selected; drop the prediction or make them agree.`, first.id)
      }
      return
    }
    case "Input":
      if (typeof node.min === "number" && typeof node.max === "number" && node.min > node.max) add("out-of-range", `${at}/min`, `${name} accepts nothing: min ${node.min} is above max ${node.max}.`, id)
      if (node.kind === "money" && node.currency === undefined) add("missing-field", `${at}/currency`, `${name} asks for money, so it needs a currency.`, id)
      return
    case "Date": {
      const start = typeof node.value === "string" ? parseDate(node.value) : undefined
      const end = typeof node.until === "string" ? parseDate(node.until) : undefined
      // A zoned time and a floating (wall-clock) time are never compared: the answer would depend on where the
      // validator runs (principle 9: deterministic).
      if (start && end && start.zoned === end.zoned && end.time < start.time) add("out-of-range", `${at}/until`, `${name} ends (${node.until}) before it starts (${node.value}).`, id)
      return
    }
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
      const reach = "every medium needs a text equivalent so it reaches people who cannot see or hear it"
      if ((node.kind === "image" || node.kind === "video") && node.alt === undefined) add("missing-text-equivalent", `${at}/alt`, `${name} is ${node.kind === "image" ? "an image" : "a video"} without alt text saying what it shows; ${reach}.`, id)
      if (node.kind === "audio" && node.transcript === undefined) add("missing-text-equivalent", `${at}/transcript`, `${name} is audio without a transcript; ${reach}.`, id)
      if (node.kind === "video" && node.transcript === undefined && node.captions === undefined) add("missing-text-equivalent", `${at}/captions`, `${name} is a video without captions or a transcript; ${reach}.`, id)
      return
    }
    case "PredictedChoice": {
      const choice = typeof node.of === "string" ? byId.get(node.of) : undefined
      if (choice?.spec.type === "Choice" && typeof node.option === "string" && !optionIds(choice.node).includes(node.option)) {
        add("unknown-option", `${at}/option`, `${name} predicts ${quote(node.option)}, but ${choice.name} has no such option (${optionIds(choice.node).join(", ")}).`, id)
      }
      return
    }
    case "Alternative": {
      const target = typeof node.for === "string" ? byId.get(node.for) : undefined
      if (target && target.index > index) add("out-of-order", `${at}/for`, `${name} comes before ${target.name}, the node it is an alternative to; the order is meaning, so put the alternative after it.`, id)
      if (node.for === undefined && recommendations > 1) {
        add("ambiguous-alternative", `${at}/for`, `${name} must say which recommendation it is an alternative to ("for"), since the experience has several.`, id)
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
        const missing = [...new Set(items.filter((item) => !keys.includes(item)))]
        const extra = keys.filter((k) => !items.includes(k))
        if (missing.length || extra.length) {
          add(
            "comparison-mismatch",
            `${at}/criteria/${i}/values`,
            `${name}: criterion ${quote(criterion.label)} must give one value per item${missing.length ? `; missing ${missing.join(", ")}` : ""}${extra.length ? `; ${extra.join(", ")} ${extra.length === 1 ? "is" : "are"} not compared` : ""}.`,
            id
          )
        }
      })
      return
    }
    case "Preference":
      if (Array.isArray(node.options) && isScalar(node.value) && !node.options.includes(node.value)) {
        add("unknown-option", `${at}/value`, `${name}'s value ${quote(node.value)} is not one of its options (${node.options.map((o) => quote(o)).join(", ")}).`, id)
      }
      return
    case "IrreversibleAction":
      if (node.reversible === true) add("irreversible-marked-reversible", `${at}/reversible`, `${name} is irreversible by definition; drop "reversible": true, or use an Action if it can be undone.`, id)
      if (typeof node.confirms === "string") {
        const target = byId.get(node.confirms)
        if (target && target.spec.type !== "IrreversibleAction" && target.node.reversible !== false) {
          add("unneeded-confirmation", `${at}/confirms`, `${name} confirms ${target.name}, which can be undone; only an act marked "reversible": false needs confirming.`, id)
        }
      }
      return
  }
}

/** Formats issues for people: one line each, with the path and the code. */
export function formatIssues(issues: Array<{ code: string; message: string; path?: string }>): string {
  return issues.map((i) => `- ${i.path === undefined ? "" : `${i.path || "(document)"}: `}${i.message} [${i.code}]`).join("\n")
}

const optionIds = (node: Json) => (Array.isArray(node.options) ? node.options.map((o) => (isObject(o) ? o.id : undefined)).filter((v): v is string => typeof v === "string") : [])
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const range = (min?: number, max?: number) => (min !== undefined && max !== undefined ? `between ${min} and ${max}` : min !== undefined ? `at least ${min}` : `at most ${max}`)

/**
 * Parses an ISO 8601 date or date-time. `zoned` says whether it names an instant (Z or an offset) or a wall-clock
 * time; `time` is milliseconds, reading a wall-clock value as UTC, so the result never depends on the host.
 */
export function parseDate(value: string): { time: number; zoned: boolean } | undefined {
  const m = ISO_DATE.exec(value)
  if (!m) return undefined
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] ?? "0", m[5] ?? "0", m[6] ?? "0"].map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return undefined
  const day = new Date(0)
  day.setUTCFullYear(y, mo - 1, d)
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return undefined
  const zone = m[7]
  let offset = 0
  if (zone && zone !== "Z") {
    const [oh, om] = zone.slice(1).split(":").map(Number)
    if (oh > 23 || om > 59) return undefined
    offset = (zone[0] === "+" ? 1 : -1) * (oh * 60 + om)
  }
  day.setUTCHours(h, mi - offset, s)
  return { time: day.getTime(), zoned: zone !== undefined }
}

/** The known name closest to a misspelling, if it is close enough to be a likely typo. Long words get no guess. */
function closest(word: string, known: string[]) {
  if (word.length > 64) return undefined
  let best: string | undefined
  let bestDistance = Infinity
  for (const k of known) {
    const d = distance(word.toLowerCase(), k.toLowerCase())
    if (d < bestDistance) [best, bestDistance] = [k, d]
  }
  return best !== undefined && bestDistance <= Math.max(2, Math.floor(word.length / 4)) ? best : undefined
}

/** Levenshtein distance, in two rows. */
function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}
