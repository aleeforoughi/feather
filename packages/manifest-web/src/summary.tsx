// A plain, accessible summary of a plan, for the bodies that have no screen to draw on (voice, text), until their own
// manifestations arrive (L4): what is asked, the consequence of any irreversible act, and the acts available. Never a
// broken page, and never a control: it is words, in reading order.
import type { IRNode } from "@aleeforoughi/feather-intent"
import { actsFor } from "@aleeforoughi/feather-intent"
import type { LayoutPlan, PlanNode } from "@aleeforoughi/feather-liquid"
import { confidenceText, consequenceSentences } from "@aleeforoughi/feather-react"
import { formatMoney, formatRange, periodText, upperFirst } from "./format"
import { childrenOf, planNodes } from "./plan-utils"

export interface SummaryItem {
  id: string
  organism: PlanNode["organism"]
  emphasis: PlanNode["emphasis"]
  /** What is shown or asked, as sentences. */
  lines: string[]
  /** What an irreversible act does, verbatim, when the node has one. */
  consequence: string[]
  /** The acts a person can take on it (the IR's reply acts). */
  acts: string[]
  /** How an irreversible act is confirmed, in words, when the plan says. */
  confirm?: string
}

const STATE: Record<string, string> = { idle: "idle", working: "working", waiting: "waiting", done: "done", failed: "failed", blocked: "blocked" }

function show(value: string | number | boolean): string {
  return typeof value === "boolean" ? (value ? "yes" : "no") : String(value)
}

/** The sentences that say what a node is. */
function linesOf(ir: IRNode, locale: string, nodes: Map<string, IRNode>): string[] {
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

/** One summary item per plan node, in plan order (members of a group and attachments follow their host). */
export function summarize(plan: LayoutPlan): SummaryItem[] {
  const all = new Map<string, IRNode>()
  for (const node of planNodes(plan)) if (node.node) all.set(node.node.id, node.node)
  const items: SummaryItem[] = []
  const visit = (node: PlanNode) => {
    const ir = node.node
    if (node.type === "AlternativeGroup") {
      items.push({ id: node.id, organism: node.organism, emphasis: node.emphasis, lines: ["Other ways to go:"], consequence: [], acts: [] })
    } else if (ir) {
      const consequence = "consequence" in ir && ir.consequence ? consequenceSentences(ir.consequence, plan.locale) : []
      const word = node.keyword ?? "confirm"
      const confirm = node.confirm === "spoken-keyword" ? `Say "${word}" after hearing this to go ahead.` : node.confirm === "typed-keyword" ? `Type "${word}" after reading this to go ahead.` : undefined
      // A prediction merged into its Choice is its own item, and it holds the acts (accept, change); a note beside an
      // irreversible Choice offers none.
      const merged = node.merged ?? []
      items.push({
        id: node.id,
        organism: node.organism,
        emphasis: node.emphasis,
        lines: linesOf(ir, plan.locale, all),
        consequence,
        acts: merged.length > 0 || node.organism === "PredictionNote" ? [] : actsFor(ir),
        confirm,
      })
    }
    childrenOf(node).forEach(visit)
  }
  plan.regions.forEach((region) => region.nodes.forEach(visit))
  return items
}

/** The plan as plain words: a list with one entry per node. */
export function PlainSummary({ plan }: { plan: LayoutPlan }) {
  const items = summarize(plan)
  return (
    <section data-slot="experience-summary" data-variant={plan.manifestation} aria-label="Summary" className="text-sm text-foreground">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} data-slot="experience-summary-item" data-variant={item.emphasis} data-feather-node={item.id} data-organism={item.organism} data-emphasis={item.emphasis} className="space-y-1">
            {item.lines.map((line, i) => (
              <p key={i} data-slot="experience-summary-line" className="break-words whitespace-pre-line">{line}</p>
            ))}
            {item.consequence.map((line, i) => (
              <p key={`c${i}`} data-slot="experience-summary-consequence" className="font-medium">{line}</p>
            ))}
            {item.confirm && <p data-slot="experience-summary-confirm" className="font-medium">{item.confirm}</p>}
            {item.acts.length > 0 && (
              <p data-slot="experience-summary-acts" className="text-muted-foreground">
                Available: {item.acts.join(", ")}.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
