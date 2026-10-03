// Replies: what the person did, sent back to the caller as { experience, node, act, value? }. Every manifestation
// (web, voice, text, switch) must produce the same reply for the same act, so the acts a node takes are part of the
// contract (spec.ts) and checked here.
import { NODE_SPECS } from "./spec.ts"
import type { Experience, IRNode, ReplyEvent } from "./types.ts"

export interface ReplyIssue {
  code: "not-an-object" | "wrong-experience" | "unknown-node" | "unknown-act" | "missing-value" | "unexpected-value" | "invalid-value"
  message: string
}

export type ReplyResult = { ok: true; reply: ReplyEvent } | { ok: false; issues: ReplyIssue[] }

/** The acts a node takes, in the order the spec lists them. */
export function actsFor(node: IRNode): string[] {
  const acts = Object.keys(NODE_SPECS[node.type]?.acts ?? {})
  // A Warning is acknowledged only when it asks to be.
  return node.type === "Warning" && node.acknowledge !== true ? [] : acts
}

/** Checks that a reply answers this experience: the node exists, takes the act, and the value fits. */
export function validateReply(experience: Experience, input: unknown): ReplyResult {
  const issues: ReplyIssue[] = []
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ code: "not-an-object", message: "A reply is a JSON object: { experience, node, act, value? }." }] }
  }
  const reply = input as Partial<ReplyEvent>
  if (reply.experience !== experience.experience) {
    issues.push({ code: "wrong-experience", message: `The reply is for ${JSON.stringify(reply.experience)}, not "${experience.experience}".` })
  }
  const node = experience.nodes.find((n) => n.id === reply.node)
  if (!node) {
    issues.push({ code: "unknown-node", message: `"${experience.experience}" has no node ${JSON.stringify(reply.node)}.` })
    return { ok: false, issues }
  }
  const acts = actsFor(node)
  const act = typeof reply.act === "string" ? NODE_SPECS[node.type].acts[reply.act] : undefined
  if (!act || !acts.includes(reply.act as string)) {
    issues.push({
      code: "unknown-act",
      message: acts.length ? `${node.type} "${node.id}" takes ${acts.join(" or ")}, not ${JSON.stringify(reply.act)}.` : `${node.type} "${node.id}" takes no acts.`,
    })
    return { ok: false, issues }
  }

  const has = reply.value !== undefined
  const valueRule = node.type === "Alternative" ? (node.input ? "required" : "none") : act.value
  if (valueRule === "required" && !has) {
    const what = node.type === "Alternative" ? `the ${node.input} the person gave` : act.doc.charAt(0).toLowerCase() + act.doc.slice(1).replace(/\.$/, "")
    issues.push({ code: "missing-value", message: `${reply.act} on ${node.type} "${node.id}" must carry a value: ${what}.` })
  }
  if (valueRule === "none" && has) issues.push({ code: "unexpected-value", message: `${reply.act} on ${node.type} "${node.id}" carries no value.` })

  if (has) {
    const value = reply.value
    const optionIds = (choice: IRNode | undefined) => (choice?.type === "Choice" ? choice.options.map((o) => o.id) : [])
    if (node.type === "Choice") {
      const picked = Array.isArray(value) ? value : [value]
      if (Array.isArray(value) !== (node.multiple === true)) {
        issues.push({ code: "invalid-value", message: `Choice "${node.id}" takes ${node.multiple ? "an array of option ids" : "one option id"}.` })
      }
      for (const p of picked) if (!optionIds(node).includes(p as string)) issues.push({ code: "invalid-value", message: `Choice "${node.id}" has no option ${JSON.stringify(p)}.` })
    }
    if (node.type === "PredictedChoice") {
      const choice = experience.nodes.find((n) => n.id === node.of)
      if (!optionIds(choice).includes(value as string)) issues.push({ code: "invalid-value", message: `Choice "${node.of}" has no option ${JSON.stringify(value)}.` })
    }
    if (node.type === "Preference" && node.options && !node.options.includes(value as string)) {
      issues.push({ code: "invalid-value", message: `Preference "${node.id}" takes one of ${node.options.map((o) => JSON.stringify(o)).join(", ")}.` })
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, reply: reply as ReplyEvent }
}
