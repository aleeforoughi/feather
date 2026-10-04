// Scenarios: for every fixture, every available act, derived from the plan (docs/manifestations.md sections 1 and 5).
// A scenario is the node, the act and a valid value where the act needs one. Nothing here reads a body's code: the acts
// come from the plan and the IR alone.
import { actsFor, validateReply, type Experience, type IRNode, type ReplyEvent } from "@aleeforoughi/feather-intent"
import type { LayoutPlan, PlanNode } from "@aleeforoughi/feather-liquid"

export type ReplyValue = NonNullable<ReplyEvent["value"]>

export interface Offer {
  /** The IR node the reply goes to (a merged prediction, for a Choice that merges one). */
  node: string
  act: string
  /** Whether the plan makes this act deliberate (the node has `confirm`, and the act commits). */
  confirm: boolean
}

export interface Scenario {
  /** Unique within the fixture. */
  id: string
  fixture: string
  node: string
  act: string
  /** A reply value; absent when the act carries none. */
  value?: ReplyValue
  /** Rejecting with no reason, rather than with one. */
  noReason?: boolean
  /** The plan arms this act first: the single act emits nothing and the deliberate step does. */
  deliberate: boolean
  /** Backing out of an armed IrreversibleAction: arm, then cancel. */
  backOut?: boolean
  /** The reply every body must emit. */
  expected: ReplyEvent
}

/** Every plan node in the plan, each with what is merged, attached or grouped under it. */
export function allPlanNodes(plan: LayoutPlan): PlanNode[] {
  const out: PlanNode[] = []
  const visit = (n: PlanNode) => {
    out.push(n)
    for (const c of [...(n.merged ?? []), ...(n.attached ?? []), ...(n.items ?? [])]) visit(c)
  }
  plan.regions.forEach((r) => r.nodes.forEach(visit))
  return out
}

export function irNodesOf(plan: LayoutPlan): Map<string, IRNode> {
  const map = new Map<string, IRNode>()
  for (const pn of allPlanNodes(plan)) if (pn.node && !map.has(pn.node.id)) map.set(pn.node.id, pn.node)
  return map
}

/** The plan node that renders an IR node. */
export function planNodeOf(plan: LayoutPlan, irId: string): PlanNode | undefined {
  return allPlanNodes(plan).find((n) => n.node?.id === irId)
}

/**
 * The available acts of a plan, in plan order (section 1, browse): each node's `actsFor`, except that a Choice merging
 * a prediction offers the prediction's accept and change, and a PredictionNote offers nothing. An IrreversibleAction's
 * `cancel` is reached by backing out, so it is not offered.
 */
export function offersOf(plan: LayoutPlan): Offer[] {
  const nodes = allPlanNodes(plan)
  const merged = new Set(nodes.flatMap((n) => (n.merged ?? []).map((m) => m.id)))
  const out: Offer[] = []
  for (const id of plan.order) {
    const host = nodes.find((n) => n.node?.id === id)
    if (!host?.node || merged.has(id) || host.organism === "PredictionNote") continue
    const target = host.merged?.find((m) => m.node?.type === "PredictedChoice") ?? host
    const ir = target.node!
    for (const act of actsFor(ir)) {
      if (ir.type === "IrreversibleAction" && act === "cancel") continue
      out.push({ node: ir.id, act, confirm: target.confirm !== undefined && act !== "reject" })
    }
  }
  return out
}

/** The currency an experience speaks in: its first Price, else the first amount an act spends. */
export function currencyOf(experience: Experience): string | undefined {
  for (const n of experience.nodes) if (n.type === "Price") return n.currency
  for (const n of experience.nodes) if ("consequence" in n && n.consequence?.spend) return n.consequence.spend.currency
  return undefined
}

const TODAY = "2026-01-15"

function inputValue(n: { kind: string; min?: number; max?: number; maxLength?: number }): string | number {
  switch (n.kind) {
    case "number":
    case "money":
      return n.min ?? n.max ?? 3
    case "date":
      return TODAY
    case "email":
      return "sam@example.com"
    case "phone":
      return "+971 50 123 4567"
    case "url":
      return "https://example.com"
    default:
      return "Hello there".slice(0, n.maxLength ?? 11)
  }
}

/** What a person answers a Form field: a value of its kind, different for every field so a mixed-up answer is caught. */
export function fieldValue(field: Extract<IRNode, { type: "Form" }>["fields"][number]): string | number {
  switch (field.kind) {
    case "number":
    case "money":
      return Math.min(field.max ?? 25, Math.max(field.min ?? 25, 25))
    case "text":
    case "long-text":
      return `Answer for ${field.id}`.slice(0, field.maxLength ?? 200)
    default:
      return inputValue(field)
  }
}

/**
 * The answers of a Form scenario: every field, except the first optional one, which is left out (an unanswered field is not
 * sent). With `all`, every field is answered.
 */
export function formAnswers(form: Extract<IRNode, { type: "Form" }>, all = false): Record<string, string | number> {
  const leftOut = all ? undefined : form.fields.find((f) => f.required !== true)?.id
  return Object.fromEntries(form.fields.filter((f) => f.id !== leftOut).map((f) => [f.id, fieldValue(f)]))
}

/** The value a valid reply carries, or undefined when the act carries none. */
export function valueFor(ir: IRNode, act: string, experience: Experience): ReplyValue | undefined {
  switch (ir.type) {
    case "Choice":
      return ir.multiple === true ? [ir.options[0]!.id] : ir.options[0]!.id
    case "PredictedChoice": {
      if (act !== "change") return undefined
      const choice = experience.nodes.find((n) => n.id === ir.of)
      return choice?.type === "Choice" ? choice.options.find((o) => o.id !== ir.option)!.id : undefined
    }
    case "Input":
      return act === "submit" ? inputValue(ir) : undefined
    case "Form":
      return act === "submit" ? formAnswers(ir) : undefined
    case "Alternative": {
      switch (ir.input) {
        case undefined:
          return undefined
        case "Price":
          return { amount: 100, currency: currencyOf(experience) ?? "USD" }
        case "Date":
          return TODAY
        case "Location":
          return "Dubai Marina"
        case "Person":
          return "Sam Rivera"
        default:
          return "A few words"
      }
    }
    case "Correction":
      return "Corrected text"
    case "Preference": {
      // The first option that is not the setting already: a person cannot "change" a setting to what it is.
      if (ir.options) return ir.options.find((o) => o !== ir.value) ?? ir.options[0]!
      if (typeof ir.value === "boolean") return !ir.value
      if (typeof ir.value === "number") return ir.value === 7 ? 8 : 7
      return ir.value === "Updated value" ? "Another value" : "Updated value"
    }
    case "Approval":
      return act === "reject" ? "Over budget" : undefined
    case "ExploreMore":
      return ir.topics?.[0]
    default:
      return undefined
  }
}

/** Every scenario of a fixture, from the plan composed for one body. */
export function scenariosOf(fixture: string, experience: Experience, plan: LayoutPlan): Scenario[] {
  const irs = irNodesOf(plan)
  const out: Scenario[] = []
  const add = (s: Omit<Scenario, "id" | "fixture" | "expected"> & { id?: string }) => {
    const reply: Record<string, unknown> = { experience: experience.experience, node: s.node, act: s.act }
    if (s.value !== undefined) reply.value = s.value
    out.push({ ...s, id: s.id ?? `${s.node}.${s.act}`, fixture, expected: reply as unknown as ReplyEvent })
  }
  for (const offer of offersOf(plan)) {
    const ir = irs.get(offer.node)!
    const value = valueFor(ir, offer.act, experience)
    add({ node: offer.node, act: offer.act, value, deliberate: offer.confirm })
    // A Form is also answered in full: every field, none left out.
    if (ir.type === "Form" && offer.act === "submit") add({ id: `${offer.node}.submit-all`, node: offer.node, act: "submit", value: formAnswers(ir, true), deliberate: offer.confirm })
    // A rejection's reason is optional: the person may give none.
    if (ir.type === "Approval" && offer.act === "reject") add({ id: `${offer.node}.reject-no-reason`, node: offer.node, act: "reject", noReason: true, deliberate: false })
    // An IrreversibleAction's cancel: arm, then back out.
    if (ir.type === "IrreversibleAction" && offer.act === "confirm") add({ node: offer.node, act: "cancel", deliberate: true, backOut: true })
  }
  // Every scenario's expected reply is itself a valid reply, or the scenario is wrong.
  for (const s of out) {
    const checked = validateReply(experience, s.expected)
    if (!checked.ok) throw new Error(`scenario ${fixture}/${s.id} is not a valid reply: ${checked.issues.map((i) => i.message).join("; ")}`)
  }
  return out
}
