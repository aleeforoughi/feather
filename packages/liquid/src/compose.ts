// compose(experience, context) → LayoutPlan. The heart of Feather: semantics in, the right experience out.
//
// Pure and deterministic (principle 9): the same IR and context always give the same plan, with no clock, no
// randomness and no model call. Every decision comes from a named rule (docs/PLAN.md section 7, see rules.ts) and
// is recorded in the plan's trace, with what it overrode, so "why does it look like this?" always has an answer.
import type { RenderContext } from "@aleeforoughi/feather-context"
import { specFor, validate, type Experience, type IRNode, type Issue } from "@aleeforoughi/feather-intent"
import { decide, type Level } from "./priority.ts"
import { PLAN_VERSION, type Emphasis, type LayoutPlan, type Manifestation, type Organism, type PlanNode, type TraceEntry } from "./plan.ts"

export type ComposeResult = { ok: true; plan: LayoutPlan } | { ok: false; issues: Issue[] }

/** Validates the experience, then composes it for this context. Never throws. */
export function compose(experience: unknown, context: RenderContext = {}): ComposeResult {
  const checked = validate(experience)
  if (!checked.ok) return { ok: false, issues: checked.issues }
  return { ok: true, plan: composeValid(checked.experience, context) }
}

/** Organism for each IR node type; Alternatives render as one AlternativeList, and PredictedChoice merges into its Choice. */
const ORGANISM: Record<IRNode["type"], Organism> = {
  Text: "Text",
  Action: "Action",
  Choice: "Choice",
  Input: "Input",
  Price: "Price",
  Person: "Person",
  Date: "Date",
  Location: "Location",
  Status: "Status",
  Progress: "Progress",
  Media: "Media",
  Confirmation: "Confirmation",
  Warning: "Warning",
  Approval: "Approval",
  Recommendation: "Recommendation",
  PredictedChoice: "PredictedChoice",
  Alternative: "AlternativeList",
  Tradeoff: "Tradeoff",
  Autopick: "Autopick",
  Correction: "CorrectionInput",
  Preference: "Preference",
  Comparison: "Comparison",
  IrreversibleAction: "IrreversibleAction",
  ExploreMore: "ExploreMore",
}

/** When no node is marked primary, the act that most needs the person, in this order (composer rule 1). */
const PRIMARY_ORDER: IRNode["type"][] = ["IrreversibleAction", "Approval", "Recommendation", "Choice", "Input", "Action"]

const ONE_LINE = 120

function composeValid(experience: Experience, context: RenderContext): LayoutPlan {
  const trace: TraceEntry[] = []
  const persona = context.persona ?? {}
  const capability = context.capability ?? {}
  const device = context.device ?? {}
  const brand = context.brand ?? {}
  // Explicit settings outrank learned preferences (principle 8).
  const preference: Level = persona.source === "learned" ? "learned" : "user-setting"
  const nodes = experience.nodes
  const isAct = (n: IRNode) => specFor(n.type)?.act === true
  const isIrreversible = (n: IRNode) => n.type === "IrreversibleAction" || (isAct(n) && n.reversible === false)
  // Commits by itself: an IrreversibleAction, or an irreversible act stating its own consequence. One without a
  // consequence is committed by the IrreversibleAction that confirms it, so it needs no confirm mode of its own.
  const commits = (n: IRNode) => n.type === "IrreversibleAction" || (isIrreversible(n) && "consequence" in n && n.consequence !== undefined)

  // ── Rule 6: output routing ──────────────────────────────────────────────────────────────────────────────────────
  const visual = capability.output?.visual
  const audio = capability.output?.audio
  const manifestation = decide<Manifestation>(trace, "plan.manifestation", [
    visual === "unavailable" && {
      rule: "output-routing",
      level: "accessibility",
      value: audio === "unavailable" ? "text" : "voice",
      because: audio === "unavailable" ? "no visual and no audio output: plain text, for a braille display or a terminal" : "no visual output: the experience is spoken",
    },
    capability.input?.switch === true && { rule: "output-routing", level: "accessibility", value: "switch", because: "the person uses switch access: scanning order and dwell" },
    persona.inputMode === "voice" && { rule: "output-routing", level: preference, value: "voice", because: "the person prefers to speak" },
    persona.inputMode === "switch" && { rule: "output-routing", level: preference, value: "switch", because: "the person prefers switch access" },
    device.surface === "speaker" && { rule: "output-routing", level: "task", value: "voice", because: "a speaker has no screen" },
    device.surface === "terminal" && { rule: "output-routing", level: "task", value: "text", because: "a terminal shows text" },
    { rule: "defaults", level: "default", value: "web", because: "nothing asks for another body" },
  ])
  const cues = decide<LayoutPlan["cues"]>(trace, "plan.cues", [
    audio === "unavailable" && { rule: "output-routing", level: "accessibility", value: "text-only", because: "no audio output: every audio-only cue becomes text" },
    { rule: "defaults", level: "default", value: "audio-and-text", because: "audio output is available or unstated" },
  ])

  // ── Rule 10: contrast ───────────────────────────────────────────────────────────────────────────────────────────
  const contrast = decide<LayoutPlan["contrast"]>(trace, "plan.contrast", [
    capability.vision === "low" && { rule: "contrast", level: "accessibility", value: "AAA", because: "low vision: WCAG AAA contrast" },
    { rule: "contrast", level: "default", value: "AA", because: "WCAG 2.2 AA in every theme" },
  ])

  // ── Rule 5: density and targets ─────────────────────────────────────────────────────────────────────────────────
  const density = decide(trace, "plan.density", [
    capability.precision === "low" && { rule: "density-and-targets", level: "accessibility", value: "spacious" as const, because: "low motor precision: room between targets" },
    persona.density && { rule: "density-and-targets", level: preference, value: persona.density, because: `the person's density (${persona.density})` },
    brand.density && { rule: "density-and-targets", level: "aesthetics", value: brand.density, because: `the brand's density axis (${brand.density})` },
    { rule: "defaults", level: "default", value: "comfortable" as const, because: "no density asked for" },
  ])
  const touchOnly = capability.input?.touch === true && capability.input?.pointer !== true
  const minTarget = decide<LayoutPlan["minTarget"]>(trace, "plan.minTarget", [
    capability.precision === "low" && { rule: "density-and-targets", level: "accessibility", value: 44, because: "low motor precision: targets of at least 44 px" },
    touchOnly && { rule: "density-and-targets", level: "accessibility", value: 44, because: "touch is the only pointer: targets of at least 44 px" },
    persona.inputMode === "touch" && { rule: "density-and-targets", level: preference, value: 44, because: "the person prefers touch" },
    (device.surface === "phone" || device.surface === "tablet" || device.surface === "watch") && { rule: "density-and-targets", level: "task", value: 44, because: `a ${device.surface} is used by touch` },
    { rule: "defaults", level: "default", value: 24, because: "WCAG 2.2 AA minimum target" },
  ])

  // ── Rule 8: reduced motion ──────────────────────────────────────────────────────────────────────────────────────
  // A request to reduce motion is treated as an accessibility need whoever makes it, so "full" never overrides it.
  const motion = decide<LayoutPlan["motion"]>(trace, "plan.motion", [
    persona.motion === "reduced" && { rule: "reduced-motion", level: "accessibility", value: "reduced", because: "the person asked for less motion" },
    device.reducedMotion === true && { rule: "reduced-motion", level: "accessibility", value: "reduced", because: "the operating system asks for reduced motion" },
    persona.motion === "full" && { rule: "reduced-motion", level: preference, value: "full", because: "the person asked for full motion" },
    brand.motion && { rule: "reduced-motion", level: "aesthetics", value: "full", because: `the brand's motion (${brand.motion})` },
    { rule: "defaults", level: "default", value: "full", because: "nothing asks to reduce motion" },
  ])

  // ── Rule 1: one primary act ─────────────────────────────────────────────────────────────────────────────────────
  const marked = nodes.find((n) => "primary" in n && n.primary === true)
  const inferred = marked ? undefined : PRIMARY_ORDER.map((type) => nodes.find((n) => n.type === type)).find(Boolean)
  const primary = decide<string | null>(trace, "plan.primary", [
    marked && { rule: "one-primary", level: "task", value: marked.id, because: `the caller marked ${marked.type} "${marked.id}" primary` },
    inferred && { rule: "one-primary", level: "default", value: inferred.id, because: `none marked: ${inferred.type} "${inferred.id}" is the act that most needs the person` },
    { rule: "one-primary", level: "default", value: null, because: "the experience has no act" },
  ])
  const primaryNode = nodes.find((n) => n.id === primary)

  // ── Rule 2 (and 3): where focus starts ──────────────────────────────────────────────────────────────────────────
  const focus = decide<string | null>(trace, "plan.focus", [
    primaryNode && isIrreversible(primaryNode) && { rule: "irreversible-explicit", level: "safety", value: null, because: `the primary act "${primaryNode.id}" cannot be undone, so it never takes the default focus` },
    manifestation !== "web" && manifestation !== "switch" && { rule: "output-routing", level: "task", value: null, because: `a ${manifestation} manifestation has no focus` },
    primaryNode && { rule: "recommendation-first", level: "task", value: primaryNode.id, because: `focus starts on the primary act "${primaryNode.id}"` },
    { rule: "defaults", level: "default", value: null, because: "no act to start on" },
  ])

  // ── Rule 9: text without a decision ─────────────────────────────────────────────────────────────────────────────
  const words = nodes.map((n) => (n.type === "Text" ? n.text : "")).join(" ")
  const plainText = nodes.every((n) => n.type === "Text") && words.length <= ONE_LINE && !words.includes("\n")
  const chrome = decide<LayoutPlan["chrome"]>(trace, "plan.chrome", [
    plainText && { rule: "text-without-decision", level: "task", value: "none", because: "one line of text and no decision: plain text, no card" },
    { rule: "defaults", level: "default", value: "card", because: "the experience has a decision or more than a line" },
  ])

  // ── Each node ───────────────────────────────────────────────────────────────────────────────────────────────────
  const planNode = (node: IRNode): PlanNode => {
    const at = `node ${node.id}`
    const emphasis = decide<Emphasis>(trace, `${at}.emphasis`, [
      node.importance === "critical" && { rule: "critical-never-hidden", level: "safety", value: "critical", because: "critical importance" },
      node.id === primary && { rule: "one-primary", level: "task", value: "primary", because: "the primary act" },
      node.importance === "low" && { rule: "defaults", level: "task", value: "quiet", because: "low importance" },
      { rule: "defaults", level: "default", value: "default", because: "normal importance" },
    ])
    const out: PlanNode = { id: node.id, type: node.type, organism: ORGANISM[node.type], emphasis, node }
    if (node.expandable) {
      out.expanded = decide<boolean>(trace, `${at}.expanded`, [
        node.importance === "critical" && { rule: "critical-never-hidden", level: "safety", value: true, because: "critical detail is never hidden behind expansion" },
        persona.explanation === "detailed" && { rule: "explanation-depth", level: preference, value: true, because: "the person wants detailed explanations" },
        persona.explanation === "brief" && { rule: "explanation-depth", level: preference, value: false, because: "the person wants brief explanations" },
        { rule: "defaults", level: "default", value: false, because: 'detail on demand, behind "Why?" (principle 5)' },
      ])
    }
    if (commits(node)) {
      out.confirm = decide(trace, `${at}.confirm`, [
        manifestation === "voice" && { rule: "irreversible-explicit", level: "safety", value: "spoken-keyword" as const, because: "spoken: the person says the keyword after hearing the consequence" },
        manifestation === "text" && { rule: "irreversible-explicit", level: "safety", value: "typed-keyword" as const, because: "text: the person types the keyword after reading the consequence" },
        { rule: "irreversible-explicit", level: "safety", value: "confirm" as const, because: "two deliberate acts: arm, then confirm" },
      ])
    }
    if (node.type === "Choice") {
      const prediction = nodes.find((n) => n.type === "PredictedChoice" && n.of === node.id)
      const selected = node.multiple !== true && node.selected?.length === 1 ? node.selected[0] : undefined
      const preselected = decide<string | null>(trace, `${at}.preselected`, [
        node.reversible === false && { rule: "irreversible-explicit", level: "safety", value: null, because: "an irreversible choice is never preselected" },
        prediction?.type === "PredictedChoice" && { rule: "recommendation-first", level: "task", value: prediction.option, because: `the predicted option "${prediction.option}" is preselected` },
        selected !== undefined && selected !== "" && { rule: "recommendation-first", level: "task", value: selected, because: `the caller's selection "${selected}"` },
        { rule: "defaults", level: "default", value: null, because: "nothing to preselect" },
      ])
      if (preselected !== null) out.preselected = preselected
      if (prediction) {
        out.organism = "PredictedChoice"
        out.merged = [prediction]
      }
    }
    return out
  }

  // ── Structure ───────────────────────────────────────────────────────────────────────────────────────────────────
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const consumed = new Set<string>()
  const attachments = new Map<string, IRNode[]>()
  const attach = (target: string, node: IRNode, because: string) => {
    attachments.set(target, [...(attachments.get(target) ?? []), node])
    consumed.add(node.id)
    trace.push({ rule: "structure", subject: `node ${node.id}`, value: `attached to ${target}`, because })
  }
  for (const node of nodes) {
    if (node.type === "PredictedChoice" && byId.get(node.of)?.type === "Choice") {
      consumed.add(node.id)
      trace.push({ rule: "structure", subject: `node ${node.id}`, value: `merged into ${node.of}`, because: "a prediction renders with its Choice" })
    } else if (node.type === "Tradeoff" && node.of && byId.has(node.of)) {
      attach(node.of, node, "a tradeoff renders with the option it describes")
    } else if (node.type === "Approval" && node.requester && byId.get(node.requester)?.type === "Person" && !consumed.has(node.requester)) {
      attach(node.id, byId.get(node.requester)!, "the person asking renders with the approval")
    }
  }
  const main: PlanNode[] = []
  const secondary: PlanNode[] = []
  let alternatives: PlanNode | undefined
  for (const node of nodes) {
    if (consumed.has(node.id)) continue
    const out = planNode(node)
    const attached = attachments.get(node.id)
    if (attached) out.attached = attached.map(planNode)
    if (node.type === "Alternative") {
      if (!alternatives) {
        alternatives = { id: "~alternatives", type: "AlternativeGroup", organism: "AlternativeList", emphasis: "default", items: [] }
        secondary.push(alternatives)
        trace.push({ rule: "recommendation-first", subject: "structure", value: "alternatives in the secondary region", because: "the recommendation comes first, then the alternatives, together in one list" })
      }
      alternatives.items!.push(out)
    } else if (node.type === "ExploreMore") {
      secondary.push(out)
    } else {
      main.push(out)
    }
  }

  return {
    plan: PLAN_VERSION,
    experience: experience.experience,
    locale: context.locale ?? experience.locale ?? "en",
    manifestation,
    chrome,
    density,
    minTarget,
    motion,
    contrast,
    cues,
    primary,
    focus,
    regions: [
      { id: "main", nodes: main },
      { id: "secondary", nodes: secondary },
    ],
    trace,
  }
}
