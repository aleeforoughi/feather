// Reading a layout plan: every IR node it carries, the experience it came from. Pure; shared by the bodies.
import { IR_VERSION, type Experience, type IRNode } from "@aleeforoughi/feather-intent"
import type { LayoutPlan, PlanNode } from "@aleeforoughi/feather-liquid"

/** The nodes composed into a plan node: merged into it, attached to it, or grouped in it, in the plan's order. */
export function childrenOf(node: PlanNode): PlanNode[] {
  return [...(node.merged ?? []), ...(node.attached ?? []), ...(node.items ?? [])]
}

/** Every plan node in the plan, in render order: main, then secondary; a node before what is merged, attached or grouped. */
export function planNodes(plan: LayoutPlan): PlanNode[] {
  const out: PlanNode[] = []
  const visit = (node: PlanNode) => {
    out.push(node)
    childrenOf(node).forEach(visit)
  }
  plan.regions.forEach((region) => region.nodes.forEach(visit))
  return out
}

/** Every IR node the plan renders, including those merged into or attached to another, each once. */
export function irNodes(plan: LayoutPlan): IRNode[] {
  const seen = new Set<string>()
  const out: IRNode[] = []
  for (const { node } of planNodes(plan)) {
    if (node && !seen.has(node.id)) {
      seen.add(node.id)
      out.push(node)
    }
  }
  return out
}

/**
 * The experience a plan renders, rebuilt from the IR nodes it carries. A plan holds every node (a merged
 * PredictedChoice and an attached Tradeoff or Person sit beside their host), so replies can be checked with
 * `validateReply` even when the host passes only the plan.
 */
export function experienceOf(plan: LayoutPlan): Experience {
  return { ir: IR_VERSION, experience: plan.experience, locale: plan.locale, nodes: irNodes(plan) }
}

/** The IR nodes by id. */
export function nodeIndex(plan: LayoutPlan): Map<string, IRNode> {
  return new Map(irNodes(plan).map((node) => [node.id, node]))
}

/** The currency the experience speaks in: its first Price, else the first amount an act spends. */
export function experienceCurrency(nodes: Iterable<IRNode>): string | undefined {
  let spend: string | undefined
  for (const node of nodes) {
    if (node.type === "Price") return node.currency
    if (spend === undefined && "consequence" in node && node.consequence?.spend) spend = node.consequence.spend.currency
  }
  return spend
}
