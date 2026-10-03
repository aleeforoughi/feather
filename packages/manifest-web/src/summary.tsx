// A plain, accessible summary of a plan, for the bodies that have no screen to draw on (voice, text), until their own
// manifestations arrive (L4): what is asked, the consequence of any irreversible act, and the acts available. Never a
// broken page, and never a control: it is words, in reading order.
// The wording lives in @aleeforoughi/feather-dialog, so the plain summary and the text and voice bodies say the same thing.
import { childrenOf, consequenceSentences, sentences } from "@aleeforoughi/feather-dialog"
import { actsFor } from "@aleeforoughi/feather-intent"
import type { LayoutPlan, PlanNode } from "@aleeforoughi/feather-liquid"

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

/** One summary item per plan node, in plan order (members of a group and attachments follow their host). */
export function summarize(plan: LayoutPlan): SummaryItem[] {
  const items: SummaryItem[] = []
  const visit = (node: PlanNode) => {
    const ir = node.node
    if (node.type === "AlternativeGroup") {
      items.push({ id: node.id, organism: node.organism, emphasis: node.emphasis, lines: sentences(node, plan), consequence: [], acts: [] })
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
        lines: sentences(node, plan),
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
    <section data-slot="experience-summary" data-variant={plan.manifestation} aria-label="Summary" className="type-body-sm text-fg-primary">
      <ul data-slot="experience-summary-items" className="flex flex-col gap-3">
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
              <p data-slot="experience-summary-acts" className="text-fg-secondary">
                Available: {item.acts.join(", ")}.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
