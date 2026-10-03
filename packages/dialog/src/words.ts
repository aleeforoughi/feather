// The sentences every non-visual body says: what a node is, and what an irreversible act does. Pure.
import type { Consequence, IRNode } from "@aleeforoughi/feather-intent"
import type { LayoutPlan, PlanNode } from "@aleeforoughi/feather-liquid"
import { formatMoney, formatRange, periodText, upperFirst } from "./format.ts"
import { nodeIndex } from "./plan-utils.ts"

/**
 * Each entry of a consequence as one plain sentence, in a fixed order (spend, publish, send, consent, delete,
 * statement). This is the same text the web organism ConsequenceStatement (packages/react) shows, character for
 * character: "Spends AED 1,050", "Publishes to everyone", "Sends to Sam by email", "Gives Acme access to your calendar",
 * "Deletes the draft", or the statement as written. The React package cannot be imported here, so the logic is
 * duplicated by design, and conformance checks both against every fixture.
 */
export function consequenceSentences(consequence: Consequence, locale = "en"): string[] {
  const out: string[] = []
  if (consequence.spend) out.push(`Spends ${formatMoney(consequence.spend.amount, consequence.spend.currency, locale)}`)
  if (consequence.publish) out.push(`Publishes to ${consequence.publish.audience}`)
  if (consequence.send) out.push(`Sends to ${consequence.send.to}${consequence.send.channel ? ` by ${consequence.send.channel}` : ""}`)
  if (consequence.consent) out.push(`Gives ${consequence.consent.to} access to ${consequence.consent.scope}`)
  if (consequence.delete) out.push(`Deletes ${consequence.delete.what}`)
  if (consequence.statement) out.push(consequence.statement)
  return out
}

/** "Confidence: high (78%)": words first, never a bare number or a color (as the Recommendation organism says it). */
export function confidenceText(confidence: number): string {
  const c = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0
  const label = c < 0.5 ? "low" : c < 0.8 ? "medium" : "high"
  return `Confidence: ${label} (${Math.round(c * 100)}%)`
}

const STATE: Record<string, string> = { idle: "idle", working: "working", waiting: "waiting", done: "done", failed: "failed", blocked: "blocked" }

/** A scalar as words. */
export function show(value: string | number | boolean): string {
  return typeof value === "boolean" ? (value ? "yes" : "no") : String(value)
}

/** What `sentences` needs to resolve references: the plan's locale and the IR nodes by id. */
export interface SentenceContext {
  locale: string
  nodes?: ReadonlyMap<string, IRNode>
}

const indexes = new WeakMap<LayoutPlan, Map<string, IRNode>>()
function contextOf(ctx: LayoutPlan | SentenceContext | undefined, planNode: PlanNode): SentenceContext {
  if (!ctx) return { locale: "en", nodes: new Map([planNode, ...(planNode.merged ?? []), ...(planNode.attached ?? [])].flatMap((n) => (n.node ? [[n.node.id, n.node] as const] : []))) }
  if ("regions" in ctx) {
    let nodes = indexes.get(ctx)
    if (!nodes) indexes.set(ctx, (nodes = nodeIndex(ctx)))
    return { locale: ctx.locale, nodes }
  }
  return ctx
}

/**
 * The sentences that say what a plan node is: what is shown or asked, in reading order. Pass the plan (or its locale
 * and nodes) so money and dates read in the plan's language and references (a requester, a predicted option) resolve.
 */
export function sentences(planNode: PlanNode, plan?: LayoutPlan | SentenceContext): string[] {
  const ir = planNode.node
  if (!ir) return planNode.type === "AlternativeGroup" ? ["Other ways to go:"] : []
  const { locale, nodes = new Map<string, IRNode>() } = contextOf(plan, planNode)
  return linesOf(ir, locale, nodes)
}

function linesOf(ir: IRNode, locale: string, nodes: ReadonlyMap<string, IRNode>): string[] {
  const named = (id: string) => {
    const n = nodes.get(id)
    if (!n) return id
    return "label" in n && typeof n.label === "string" ? n.label : "intent" in n && n.intent ? n.intent : "name" in n ? n.name : id
  }
  switch (ir.type) {
    case "Text":
    case "Confirmation":
      return [ir.text]
    case "Action":
      return [`You can: ${ir.label ?? ir.intent}.`]
    case "Choice": {
      const options = ir.options.map((o) => (o.description ? `${o.label} (${o.description})` : o.label))
      return [ir.prompt, `${ir.multiple ? "Choose any of" : "Choose one of"}: ${options.join("; ")}.`]
    }
    case "Input":
      return [ir.prompt, `Give ${ir.kind === "long-text" ? "text" : ir.kind === "money" ? `an amount${ir.currency ? ` in ${ir.currency}` : ""}` : `a ${ir.kind}`}${ir.required ? ", required" : ", optional"}.`]
    case "Price":
      return [`${ir.label ?? "Price"}: ${formatMoney(ir.amount, ir.currency, locale)}${periodText(ir.period) ? ` ${periodText(ir.period)}` : ""}.`]
    case "Person":
      return [`${ir.name}${ir.role ? `, ${ir.role}` : ""}${ir.kind === "agent" ? " (agent)" : ""}.`]
    case "Date":
      return [`${ir.label ? `${ir.label}: ` : ""}${formatRange(ir.value, ir.until, locale)}.`]
    case "Location":
      return [`${ir.name}${ir.address ? `, ${ir.address}` : ""}.`]
    case "Status":
      return [`${ir.label}: ${STATE[ir.state]}.`]
    case "Progress": {
      const lines = [`${ir.label}${ir.value === undefined ? ": in progress" : `: ${Math.round(Math.min(1, Math.max(0, ir.value)) * 100)}%`}.`]
      if (ir.steps) lines.push(`Steps: ${ir.steps.map((s) => `${s.label} (${s.state})`).join("; ")}.`)
      return lines
    }
    case "Media":
      return [`${upperFirst(ir.kind)}: ${ir.alt ?? ir.caption ?? "no description"}.`, ...(ir.transcript ? [`Transcript: ${ir.transcript}`] : [])]
    case "Warning":
      return [`${ir.severity === "danger" ? "Danger" : "Warning"}: ${ir.text}`]
    case "Approval":
      return [`Approval needed: ${ir.request}.`, ...(ir.requester ? [`Requested by ${named(ir.requester)}.`] : []), ...(ir.scope ? [`Covers: ${ir.scope}.`] : [])]
    case "Recommendation":
      return [`Recommended: ${ir.summary}`, ...(ir.confidence === undefined ? [] : [`${confidenceText(ir.confidence)}.`])]
    case "PredictedChoice": {
      const choice = nodes.get(ir.of)
      const option = choice?.type === "Choice" ? choice.options.find((o) => o.id === ir.option)?.label ?? ir.option : ir.option
      return [`Likely: ${option}${ir.summary ? `, because ${ir.summary}` : ""}.`]
    }
    case "Alternative":
      return [`Or: ${ir.label ?? ir.intent}${ir.input ? `, and you give a ${ir.input.toLowerCase()}` : ""}.`]
    case "Tradeoff":
      return [...(ir.summary ? [ir.summary] : []), ...(ir.gains?.length ? [`Gains: ${ir.gains.join("; ")}.`] : []), ...(ir.costs?.length ? [`Costs: ${ir.costs.join("; ")}.`] : [])]
    case "Autopick":
      return [`Decided for you: ${ir.summary}`, ...(ir.undoWithin === undefined ? [] : [`You can undo it for ${ir.undoWithin} seconds.`])]
    case "Correction":
      return [ir.prompt, ...(ir.original ? [`Understood as: ${ir.original}.`] : [])]
    case "Preference":
      return [`${ir.label}: ${show(ir.value)}.`, ...(ir.options ? [`Options: ${ir.options.map(show).join(", ")}.`] : [])]
    case "Comparison":
      return ir.criteria.map((c) => `${c.label}: ${ir.items.map((item) => `${named(item)} ${c.values[item] === undefined ? "n/a" : show(c.values[item])}`).join("; ")}.`)
    case "IrreversibleAction":
      return [`${upperFirst(ir.label ?? ir.intent)}. This cannot be undone.`]
    case "ExploreMore":
      return [`More is available${ir.topics?.length ? ` about: ${ir.topics.join(", ")}` : ""}.`]
  }
}
