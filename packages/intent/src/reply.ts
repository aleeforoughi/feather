// Replies: what the person did, sent back to the caller as { experience, node, act, value? }. Every manifestation
// (web, voice, text, switch) must produce the same reply for the same act, so the acts a node takes and the encoding
// of each value are part of the contract (spec.ts), and checked here. It never throws.
import { specFor } from "./spec.ts"
import type { Experience, IRNode, ReplyEvent } from "./types.ts"
import { chars, isScalar, parseDate, validate } from "./validate.ts"

export interface ReplyIssue {
  code:
    | "invalid-experience"
    | "not-an-object"
    | "unknown-field"
    | "wrong-experience"
    | "unknown-node"
    | "unknown-act"
    | "missing-value"
    | "unexpected-value"
    | "invalid-value"
  message: string
}

export type ReplyResult = { ok: true; reply: ReplyEvent } | { ok: false; issues: ReplyIssue[] }

const REPLY_FIELDS = new Set(["experience", "node", "act", "value"])
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE = /^\+?[0-9 ()./-]{3,32}$/
const CURRENCY = /^[A-Z]{3}$/

/** The acts a node takes, in the order the spec lists them. */
export function actsFor(node: IRNode): string[] {
  const acts = Object.keys(specFor(node.type)?.acts ?? {})
  // A Warning is acknowledged only when it asks to be; an Input is skipped only when it is optional.
  if (node.type === "Warning") return node.acknowledge === true ? acts : []
  if (node.type === "Input" && node.required === true) return acts.filter((a) => a !== "skip")
  return acts
}

/**
 * Checks that a reply answers this experience: the node exists, takes the act, and the value is encoded as the act
 * requires. The experience is validated first, so this is safe to call with whatever the caller sent.
 */
export function validateReply(experience: Experience, input: unknown): ReplyResult {
  const checked = validate(experience)
  if (!checked.ok) return fail("invalid-experience", `The experience is not valid feather.ir/0 (${checked.issues.length} problem${checked.issues.length === 1 ? "" : "s"}, first: ${checked.issues[0].message}); validate it before taking replies.`)
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail("not-an-object", "A reply is a JSON object: { experience, node, act, value? }.")

  const issues: ReplyIssue[] = []
  const reply = input as Record<string, unknown>
  for (const key of Object.keys(reply)) if (!REPLY_FIELDS.has(key)) issues.push({ code: "unknown-field", message: `A reply has experience, node, act and value; not ${JSON.stringify(key)}.` })
  if (reply.experience !== experience.experience) issues.push({ code: "wrong-experience", message: `The reply is for ${short(reply.experience)}, not "${experience.experience}".` })
  const node = typeof reply.node === "string" ? experience.nodes.find((n) => n.id === reply.node) : undefined
  if (!node) {
    issues.push({ code: "unknown-node", message: `"${experience.experience}" has no node ${short(reply.node)}.` })
    return { ok: false, issues }
  }
  const acts = actsFor(node)
  if (typeof reply.act !== "string" || !acts.includes(reply.act)) {
    issues.push({ code: "unknown-act", message: acts.length ? `${node.type} "${node.id}" takes ${acts.join(" or ")}, not ${short(reply.act)}.` : `${node.type} "${node.id}" takes no acts.` })
    return { ok: false, issues }
  }
  const act = specFor(node.type)!.acts[reply.act]

  const has = reply.value !== undefined
  const rule = node.type === "Alternative" ? (node.input ? "required" : "none") : act.value
  const where = `${reply.act} on ${node.type} "${node.id}"`
  if (rule === "required" && !has) issues.push({ code: "missing-value", message: `${where} must carry a value: ${valueDoc(node, act.doc)}.` })
  if (rule === "none" && has) issues.push({ code: "unexpected-value", message: `${where} carries no value.` })
  if (has && rule !== "none") {
    const problem = checkValue(node, reply.act, reply.value, experience)
    if (problem) issues.push({ code: "invalid-value", message: `${where}: ${problem}.` })
  }
  return issues.length ? { ok: false, issues } : { ok: true, reply: reply as unknown as ReplyEvent }
}

/** Why a value does not fit the act, or undefined when it does. */
function checkValue(node: IRNode, act: string, value: unknown, experience: Experience): string | undefined {
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)
  const text = (v: unknown, max = 4000) => typeof v === "string" && v.trim() !== "" && chars(v) <= max
  const optionIds = (n: IRNode | undefined) => (n?.type === "Choice" ? n.options.map((o) => o.id) : [])
  switch (node.type) {
    case "Choice": {
      const ids = optionIds(node)
      if (node.multiple === true) {
        if (!Array.isArray(value) || value.length === 0) return "a multiple choice takes a non-empty array of option ids"
        if (new Set(value).size !== value.length) return "each option is picked once"
        const unknown = value.filter((v) => !ids.includes(v as string))
        return unknown.length ? `no option ${unknown.map(short).join(", ")} (options: ${ids.join(", ")})` : undefined
      }
      if (typeof value !== "string") return "a single choice takes one option id, as a string"
      return ids.includes(value) ? undefined : `no option ${short(value)} (options: ${ids.join(", ")})`
    }
    case "PredictedChoice": {
      const ids = optionIds(experience.nodes.find((n) => n.id === node.of))
      if (typeof value !== "string" || !ids.includes(value)) return `Choice "${node.of}" has no option ${short(value)}`
      return value === node.option ? `"${value}" is the prediction itself; reply accept instead` : undefined
    }
    case "Input": {
      if (act !== "submit") return undefined
      switch (node.kind) {
        case "number":
        case "money":
          if (!finite(value)) return `a ${node.kind} answer is a finite number${node.kind === "money" ? ` in ${node.currency}` : ""}`
          if (node.min !== undefined && value < node.min) return `${value} is below the minimum ${node.min}`
          if (node.max !== undefined && value > node.max) return `${value} is above the maximum ${node.max}`
          return undefined
        case "date":
          return typeof value === "string" && parseDate(value) ? undefined : "a date answer is an ISO 8601 date or date-time string"
        default: {
          if (!text(value)) return "the answer is a non-empty string"
          const s = value as string
          if (node.maxLength !== undefined && chars(s) > node.maxLength) return `the answer is ${chars(s)} characters; the most is ${node.maxLength}`
          if (node.kind === "email" && !EMAIL.test(s)) return `${short(s)} is not an email address`
          if (node.kind === "phone" && !PHONE.test(s)) return `${short(s)} is not a phone number`
          if (node.kind === "url" && !URL.canParse(s)) return `${short(s)} is not a URL`
          return undefined
        }
      }
    }
    case "Alternative":
      switch (node.input) {
        case "Price": {
          const v = value as { amount?: unknown; currency?: unknown }
          const ok = typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).every((k) => k === "amount" || k === "currency")
          return ok && finite(v.amount) && v.amount >= 0 && typeof v.currency === "string" && CURRENCY.test(v.currency) ? undefined : "a Price is { amount, currency }: a number of at least 0 and an ISO 4217 code"
        }
        case "Date":
          return typeof value === "string" && parseDate(value) ? undefined : "a Date is an ISO 8601 date or date-time string"
        default:
          return text(value) ? undefined : `a ${node.input} is given in words, as a non-empty string`
      }
    case "Preference":
      if (!isScalar(value)) return "a preference value is a string, a finite number or a boolean"
      if (typeof value === "string" && chars(value) > 4000) return "the value is too long"
      return node.options && !node.options.includes(value as string | number | boolean) ? `not one of ${node.options.map(short).join(", ")}` : undefined
    case "Approval":
      return text(value) ? undefined : "a rejection's reason is a non-empty string"
    case "Correction":
      return text(value) ? undefined : "a correction is a non-empty string"
    case "ExploreMore":
      if (!text(value)) return "the topic is a non-empty string"
      return node.topics && !node.topics.includes(value as string) ? `${short(value)} is not one of its topics (${node.topics.map(short).join(", ")})` : undefined
    default:
      return undefined
  }
}

function valueDoc(node: IRNode, doc: string) {
  if (node.type === "Alternative") return node.input === "Price" ? "the Price the person gave, as { amount, currency }" : `the ${node.input} the person gave`
  return doc.charAt(0).toLowerCase() + doc.slice(1).replace(/\.$/, "")
}

const short = (v: unknown) => {
  const s = JSON.stringify(v) ?? String(v)
  return s.length > 60 ? `${s.slice(0, 57)}…` : s
}
const fail = (code: ReplyIssue["code"], message: string): ReplyResult => ({ ok: false, issues: [{ code, message }] })
