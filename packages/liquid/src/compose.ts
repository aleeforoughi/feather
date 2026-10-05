// compose(experience, context) → LayoutPlan. The heart of Feather: semantics in, the right experience out.
//
// Pure and deterministic (principle 9): the same IR and context always give the same plan, with no clock, no
// randomness and no model call. Every decision comes from a named rule (docs/PLAN.md section 7, see rules.ts) and
// is recorded in the plan's trace, with what it overrode, so "why does it look like this?" always has an answer.
import type { RenderContext } from "@aleeforoughi/feather-context"
import { specFor, validate, type Experience, type IRNode, type Issue } from "@aleeforoughi/feather-intent"
import { normalizeContext } from "./normalize.ts"
import { decide, type Level } from "./priority.ts"
import { PLAN_VERSION, type Emphasis, type LayoutPlan, type Manifestation, type Organism, type PlanNode, type TraceEntry } from "./plan.ts"

export type ComposeResult = { ok: true; plan: LayoutPlan } | { ok: false; issues: Issue[] }

/** Validates the experience, then composes it for this context. Never throws: an experience or a context that
 * cannot be read is reported as an issue, and a context field of the wrong type is dropped (and traced). */
export function compose(experience: unknown, context?: RenderContext): ComposeResult {
  try {
    const checked = validate(experience)
    if (!checked.ok) return { ok: false, issues: checked.issues }
    // The plan holds the IR nodes it renders; a copy keeps it from changing when the caller's document does.
    return { ok: true, plan: composeValid(structuredClone(checked.experience), context) }
  } catch (err) {
    return { ok: false, issues: [{ code: "unreadable", path: "", message: `The experience could not be composed (${err instanceof Error ? err.message : String(err)}); send plain JSON.` }] }
  }
}

/** Organism for each IR node type; Alternatives render as one AlternativeList, and PredictedChoice merges into its Choice. */
const ORGANISM: Record<IRNode["type"], Organism> = {
  Text: "Text",
  Action: "Action",
  Choice: "Choice",
  Input: "Input",
  Form: "Form",
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
const PRIMARY_ORDER: IRNode["type"][] = ["IrreversibleAction", "Approval", "Recommendation", "Choice", "Form", "Input", "Action"]

/** Rule 9: text that fits on one line. Counted in code points, so Arabic or emoji text is not cut short. */
const ONE_LINE = 120
const PLAIN_TEXT_TYPES: IRNode["type"][] = ["Text", "Confirmation", "Status"]

/** The word to say or type to confirm an irreversible act, by language. Unknown languages fall back to English, and
 * the trace says so. */
const KEYWORDS: Record<string, string> = {
  en: "confirm",
  fr: "confirmer",
  es: "confirmar",
  de: "bestätigen",
  it: "conferma",
  pt: "confirmar",
  nl: "bevestigen",
  ar: "تأكيد",
  fa: "تایید",
  tr: "onayla",
}

const STRENGTH: Record<Emphasis, number> = { critical: 0, primary: 1, high: 2, default: 3, quiet: 4 }

type LearnableField = "density" | "explanation" | "motion" | "inputMode" | "autonomy"

function composeValid(experience: Experience, rawContext: unknown): LayoutPlan {
  const trace: TraceEntry[] = []
  const context = normalizeContext(rawContext, trace)
  const plan = composeOpen(experience, context, trace)
  // ── Rule lifecycle (L6): open → update → resolve → collapse ─────────────────────────────────────────────────────
  // The body still follows the person (a collapsed plan is spoken, typed or shown like any other), but nothing else of
  // the interaction remains: the purpose is done, so the interface dissolves (mission, principle 3).
  const lifecycle = decide<LayoutPlan["lifecycle"]>(trace, "plan.lifecycle", [
    experience.resolved !== undefined && { rule: "lifecycle", level: "task", value: "collapsed", because: `resolved (${experience.resolved.outcome}): only the summary and what it left behind remain` },
    { rule: "lifecycle", level: "default", value: "open", because: "the experience is open" },
  ])
  if (lifecycle === "open") return { ...plan, lifecycle }
  return { ...plan, lifecycle, resolution: experience.resolved, chrome: "none", primary: null, focus: null, order: [], regions: [{ id: "main", nodes: [] }, { id: "secondary", nodes: [] }] }
}

function composeOpen(experience: Experience, context: RenderContext, trace: TraceEntry[]): Omit<LayoutPlan, "lifecycle"> {
  const persona = context.persona ?? {}
  const capability = context.capability ?? {}
  const device = context.device ?? {}
  const brand = context.brand ?? {}
  // Explicit settings outrank learned preferences (principle 8), field by field.
  const preference = (field: LearnableField): Level => (persona.learned?.includes(field) ? "learned" : "user-setting")
  const nodes = experience.nodes
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // ── What each node means ────────────────────────────────────────────────────────────────────────────────────────
  const isAct = (n: IRNode) => specFor(n.type)?.act === true
  /** The importance the node has, with the IR's defaults applied (an IrreversibleAction is critical unless it says). */
  const importance = (n: IRNode) => n.importance ?? specFor(n.type)?.defaults?.importance ?? "normal"
  const hasConsequence = (n: IRNode) => "consequence" in n && n.consequence !== undefined
  /** Cannot be undone: an IrreversibleAction, an act marked reversible: false, or an act stating a consequence. */
  const isIrreversible = (n: IRNode) => n.type === "IrreversibleAction" || (isAct(n) && (n.reversible === false || hasConsequence(n)))
  const confirmers = nodes.filter((n) => n.type === "IrreversibleAction")
  /** The IrreversibleAction that commits this act, named by its "confirms", or implied when there is only one. */
  const confirmedBy = (n: IRNode) =>
    n.type === "IrreversibleAction" || !isIrreversible(n)
      ? undefined
      : (confirmers.find((c) => c.type === "IrreversibleAction" && c.confirms === n.id) ??
        (confirmers.length === 1 && confirmers[0].type === "IrreversibleAction" && confirmers[0].confirms === undefined ? confirmers[0] : undefined))
  /** Commits by itself, so it carries a confirm mode. An act an IrreversibleAction confirms does not: confirming
   * twice would make the person commit twice to one effect. */
  const commits = (n: IRNode) => n.type === "IrreversibleAction" || (isIrreversible(n) && confirmedBy(n) === undefined)

  // ── Rule 6: output routing ──────────────────────────────────────────────────────────────────────────────────────
  // The body follows what the person can perceive first; how they prefer to give input never removes a screen.
  // A person who cannot speak is never asked to: without a screen they get text (read aloud by their screen reader,
  // answered by typing). A temporary state binds like a lasting one while it holds (L5).
  const noVisual = capability.output?.visual === "unavailable"
  const noSound = capability.output?.audio === "unavailable"
  const cannotSpeak = capability.input?.voice === false
  const temporary = capability.temporary ?? {}
  const noisy = temporary.noisy === true
  const speaker = device.surface === "speaker"
  const screenBody = !noVisual && !speaker && device.surface !== "terminal"
  /** Speech both ways works: the person can hear, can speak, and the room lets them. */
  const speechWorks = !noSound && !cannotSpeak && !noisy
  const manifestation = decide<Manifestation>(trace, "plan.manifestation", [
    noVisual && {
      rule: "output-routing",
      level: "accessibility",
      value: noSound || cannotSpeak ? "text" : "voice",
      because: noSound
        ? "no visual and no audio output: plain text, for a braille display"
        : cannotSpeak
          ? "no visual output and no speech input: text, read aloud by the screen reader and answered by typing"
          : "no visual output: the experience is spoken",
    },
    speaker && {
      rule: "output-routing",
      level: "task",
      value: noSound || cannotSpeak ? "text" : "voice",
      because: noSound ? "a speaker with no audio output: plain text" : cannotSpeak ? "a speaker, and the person does not speak: text" : "a speaker has no screen: the experience is spoken",
    },
    screenBody && temporary.eyesBusy === true && speechWorks && { rule: "output-routing", level: "accessibility", value: "voice", because: "the person's eyes are busy for now: the experience is spoken" },
    screenBody && temporary.handsBusy === true && speechWorks && { rule: "output-routing", level: "accessibility", value: "voice", because: "the person's hands are busy for now: the experience is spoken" },
    device.surface === "terminal" && { rule: "output-routing", level: "task", value: "text", because: "a terminal shows text" },
    screenBody && capability.input?.switch === true && { rule: "output-routing", level: "accessibility", value: "switch", because: "the person uses switch access: scanning order and dwell" },
    screenBody && persona.inputMode === "switch" && { rule: "output-routing", level: preference("inputMode"), value: "switch", because: "the person prefers switch access" },
    { rule: "defaults", level: "default", value: "web", because: "a screen is available and nothing asks for another body" },
  ])
  const cues = decide<LayoutPlan["cues"]>(trace, "plan.cues", [
    noSound && { rule: "output-routing", level: "accessibility", value: "text-only", because: "no audio output: every audio-only cue becomes text" },
    noisy && { rule: "output-routing", level: "accessibility", value: "text-only", because: "sound cannot be relied on for now: every audio-only cue becomes text" },
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
    persona.density && { rule: "density-and-targets", level: preference("density"), value: persona.density, because: `the person's density (${persona.density})` },
    brand.density && { rule: "density-and-targets", level: "aesthetics", value: brand.density, because: `the brand's density (${brand.density})` },
    { rule: "defaults", level: "default", value: "comfortable" as const, because: "no density asked for" },
  ])
  const touchOnly = capability.input?.touch === true && capability.input?.pointer !== true
  const minTarget = decide<LayoutPlan["minTarget"]>(trace, "plan.minTarget", [
    capability.precision === "low" && { rule: "density-and-targets", level: "accessibility", value: 44, because: "low motor precision: targets of at least 44 px" },
    touchOnly && { rule: "density-and-targets", level: "accessibility", value: 44, because: "touch is the only pointer: targets of at least 44 px" },
    persona.inputMode === "touch" && { rule: "density-and-targets", level: preference("inputMode"), value: 44, because: "the person prefers touch" },
    (device.surface === "phone" || device.surface === "tablet" || device.surface === "watch") && { rule: "density-and-targets", level: "task", value: 44, because: `a ${device.surface} is used by touch` },
    { rule: "defaults", level: "default", value: 24, because: "WCAG 2.2 AA minimum target" },
  ])

  // ── Rule 8: reduced motion ──────────────────────────────────────────────────────────────────────────────────────
  // A request to reduce motion is treated as an accessibility need whoever makes it, so "full" never overrides it.
  // The brand's motion axis (calm, snappy) shapes how things move, not whether they do, so it is no candidate here.
  const motion = decide<LayoutPlan["motion"]>(trace, "plan.motion", [
    persona.motion === "reduced" && { rule: "reduced-motion", level: "accessibility", value: "reduced", because: "the person asked for less motion" },
    device.reducedMotion === true && { rule: "reduced-motion", level: "accessibility", value: "reduced", because: "the operating system asks for reduced motion" },
    persona.motion === "full" && { rule: "reduced-motion", level: preference("motion"), value: "full", because: "the person asked for full motion" },
    { rule: "defaults", level: "default", value: "full", because: "nothing asks to reduce motion" },
  ])

  // ── Rule 1: one primary act ─────────────────────────────────────────────────────────────────────────────────────
  const marked = nodes.find((n) => "primary" in n && n.primary === true)
  const inferred = marked ? undefined : PRIMARY_ORDER.map((type) => nodes.find((n) => n.type === type)).find(Boolean)
  const primary = decide<string | null>(trace, "plan.primary", [
    marked && { rule: "one-primary", level: "task", value: marked.id, because: `the caller marked ${marked.type} "${marked.id}" primary` },
    inferred && { rule: "one-primary", level: "default", value: inferred.id, because: `none marked: ${inferred.type} "${inferred.id}" is the act that most needs the person` },
    { rule: "one-primary", level: "default", value: null, because: "the experience has no act that can be primary" },
  ])
  const primaryNode = primary === null ? undefined : byId.get(primary)

  // ── Rule 2 (and 3): where focus starts ──────────────────────────────────────────────────────────────────────────
  const focus = decide<string | null>(trace, "plan.focus", [
    primaryNode && isIrreversible(primaryNode) && { rule: "irreversible-explicit", level: "safety", value: null, because: `the primary act "${primaryNode.id}" cannot be undone, so it never takes the default focus` },
    manifestation !== "web" && manifestation !== "switch" && { rule: "output-routing", level: "task", value: null, because: `a ${manifestation} manifestation has no focus` },
    primaryNode && { rule: "recommendation-first", level: "task", value: primaryNode.id, because: `focus starts on the primary act "${primaryNode.id}"` },
    { rule: "defaults", level: "default", value: null, because: "no act to start on" },
  ])

  // ── Rule 9: text without a decision ─────────────────────────────────────────────────────────────────────────────
  const only = nodes.length === 1 ? nodes[0] : undefined
  const words = only?.type === "Text" || only?.type === "Confirmation" ? only.text : only?.type === "Status" ? only.label : undefined
  const plainText = only !== undefined && PLAIN_TEXT_TYPES.includes(only.type) && !only.expandable && words !== undefined && [...words].length <= ONE_LINE && !words.includes("\n")
  const chrome = decide<LayoutPlan["chrome"]>(trace, "plan.chrome", [
    plainText && { rule: "text-without-decision", level: "task", value: "none", because: "one line of text and no decision: plain text, no card" },
    { rule: "defaults", level: "default", value: "card", because: "the experience has a decision, more than one node, or more than a line" },
  ])

  // ── The confirm keyword, in the plan's locale ───────────────────────────────────────────────────────────────────
  const locale = context.locale ?? experience.locale ?? "en"
  const language = locale.split("-")[0].toLowerCase()
  let keyword: string | undefined
  const keywordFor = () =>
    (keyword ??= decide<string>(trace, "plan.keyword", [
      KEYWORDS[language] !== undefined && { rule: "irreversible-explicit", level: "task", value: KEYWORDS[language], because: `the confirm keyword in ${locale}` },
      { rule: "defaults", level: "default", value: KEYWORDS.en, because: `no confirm keyword for ${locale}: English` },
    ]))

  // ── Structure: what renders as part of what ─────────────────────────────────────────────────────────────────────
  // Rule autonomy: a person who picks for themselves sees the caller's prediction as a note, not preselected.
  const asks = persona.autonomy === "ask"
  const consumed = new Set<string>()
  const attachments = new Map<string, IRNode[]>()
  const predictions = new Map<string, IRNode>()
  const attach = (target: string, node: IRNode, because: string) => {
    attachments.set(target, [...(attachments.get(target) ?? []), node])
    consumed.add(node.id)
    trace.push({ rule: "structure", level: "task", subject: `node ${node.id}`, value: `attached to ${target}`, because })
  }
  for (const node of nodes) {
    if (node.type === "PredictedChoice") {
      const choice = byId.get(node.of)
      if (choice?.type !== "Choice" || predictions.has(choice.id)) continue
      predictions.set(choice.id, node)
      consumed.add(node.id)
      trace.push(
        isIrreversible(choice)
          ? { rule: "structure", level: "safety", subject: `node ${node.id}`, value: `a note on ${choice.id}`, because: "an irreversible choice is never preselected: the prediction shows beside it as a note" }
          : asks
            ? { rule: "autonomy", level: preference("autonomy"), subject: `node ${node.id}`, value: `a note on ${choice.id}`, because: "the person picks for themselves: the prediction shows beside the choice as a note" }
            : { rule: "structure", level: "task", subject: `node ${node.id}`, value: `merged into ${choice.id}`, because: "a prediction renders with its Choice, preselected" }
      )
    } else if (node.type === "Tradeoff" && node.of && byId.has(node.of)) {
      attach(node.of, node, "a tradeoff renders with the option it describes")
    } else if (node.type === "Approval" && node.requester && byId.get(node.requester)?.type === "Person") {
      // Every approval shows who asks, even when one person asks for several.
      attach(node.id, byId.get(node.requester)!, "the person asking renders with the approval")
    }
  }

  // ── Each node ───────────────────────────────────────────────────────────────────────────────────────────────────
  const planNode = (node: IRNode): PlanNode => {
    const at = `node ${node.id}`
    const level = importance(node)
    const emphasis = decide<Emphasis>(trace, `${at}.emphasis`, [
      level === "critical" && { rule: "critical-never-hidden", level: "safety", value: "critical", because: node.importance ? "critical importance" : `a ${node.type} is critical unless it says otherwise` },
      node.id === primary && { rule: "one-primary", level: "task", value: "primary", because: "the primary act" },
      level === "high" && { rule: "importance", level: "task", value: "high", because: node.importance ? "high importance" : `a ${node.type} is high importance unless it says otherwise` },
      level === "low" && { rule: "importance", level: "task", value: "quiet", because: "low importance" },
      { rule: "defaults", level: "default", value: "default", because: "normal importance" },
    ])
    const out: PlanNode = { id: node.id, type: node.type, organism: ORGANISM[node.type], emphasis, node }
    if (node.expandable) {
      out.expanded = decide<boolean>(trace, `${at}.expanded`, [
        level === "critical" && { rule: "critical-never-hidden", level: "safety", value: true, because: "critical detail is never hidden behind expansion" },
        capability.reading === "plain" && { rule: "reading", level: "accessibility", value: false, because: "plain reading: less to read at once, detail behind \"Why?\"" },
        persona.explanation === "detailed" && { rule: "explanation-depth", level: preference("explanation"), value: true, because: "the person wants detailed explanations" },
        persona.explanation === "brief" && { rule: "explanation-depth", level: preference("explanation"), value: false, because: "the person wants brief explanations" },
        { rule: "defaults", level: "default", value: false, because: 'detail on demand, behind "Why?" (principle 5)' },
      ])
    }
    if (commits(node)) {
      out.confirm = decide(trace, `${at}.confirm`, [
        manifestation === "voice" && { rule: "irreversible-explicit", level: "safety", value: "spoken-keyword" as const, because: "spoken: the person says the keyword after hearing the consequence" },
        manifestation === "text" && { rule: "irreversible-explicit", level: "safety", value: "typed-keyword" as const, because: "text: the person types the keyword after reading the consequence" },
        { rule: "irreversible-explicit", level: "safety", value: "confirm" as const, because: "two deliberate acts: arm, then confirm" },
      ])
      if (out.confirm !== "confirm") out.keyword = keywordFor()
    }
    if (node.type === "Media" && (node.kind === "audio" || node.kind === "video") && cues === "text-only") {
      out.textEquivalent = true
      trace.push({ rule: "output-routing", level: "accessibility", subject: `${at}.textEquivalent`, value: true, because: `no audio output: the ${node.kind}'s text equivalent renders in its place` })
    }
    if (node.type === "Choice") {
      const prediction = predictions.get(node.id)
      const irreversible = isIrreversible(node)
      const selected = node.multiple !== true && node.selected?.length === 1 ? node.selected[0] : undefined
      const preselected = decide<string | null>(trace, `${at}.preselected`, [
        irreversible && { rule: "irreversible-explicit", level: "safety", value: null, because: "an irreversible choice is never preselected" },
        asks && prediction?.type === "PredictedChoice" && {
          rule: "autonomy",
          level: preference("autonomy"),
          value: selected !== undefined && selected !== "" ? selected : null,
          because: "the person picks for themselves: the prediction is not preselected",
        },
        prediction?.type === "PredictedChoice" && { rule: "recommendation-first", level: "task", value: prediction.option, because: `the predicted option "${prediction.option}" is preselected` },
        selected !== undefined && selected !== "" && { rule: "recommendation-first", level: "task", value: selected, because: `the caller's selection "${selected}"` },
        { rule: "defaults", level: "default", value: null, because: "nothing to preselect" },
      ])
      if (preselected !== null) out.preselected = preselected
      if (prediction && (irreversible || asks)) {
        out.attached = [{ ...planNode(prediction), organism: "PredictionNote" }]
      } else if (prediction) {
        out.organism = "PredictedChoice"
        out.merged = [planNode(prediction)]
      }
    }
    const attached = attachments.get(node.id)
    if (attached) out.attached = [...(out.attached ?? []), ...attached.map(planNode)]
    return out
  }

  // ── Regions ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const main: PlanNode[] = []
  const secondary: PlanNode[] = []
  const groups = new Map<string, PlanNode>()
  for (const node of nodes) {
    if (consumed.has(node.id)) continue
    const out = planNode(node)
    if (node.type === "Alternative") {
      // One list per thing the alternatives are alternatives to, so two recommendations keep their own.
      const id = node.for ? `~alternatives:${node.for}` : "~alternatives"
      let group = groups.get(id)
      if (!group) {
        group = { id, type: "AlternativeGroup", organism: "AlternativeList", emphasis: "default", items: [] }
        groups.set(id, group)
        secondary.push(group)
        trace.push({ rule: "recommendation-first", level: "task", subject: `node ${id}`, value: "secondary", because: node.for ? `the alternatives to "${node.for}" follow it, together in one list` : "the recommendation comes first, then the alternatives, together in one list" })
      }
      group.items!.push(out)
    } else if (node.type === "ExploreMore") {
      secondary.push(out)
    } else {
      main.push(out)
    }
  }
  // A group stands out as much as its strongest member, so a critical alternative is never muted by its list.
  for (const group of groups.values()) {
    const strongest = group.items!.reduce<Emphasis>((best, item) => (STRENGTH[item.emphasis] < STRENGTH[best] ? item.emphasis : best), "quiet")
    group.emphasis = decide<Emphasis>(trace, `node ${group.id}.emphasis`, [
      strongest !== "quiet" && { rule: "importance", level: "task", value: strongest, because: "a list stands out as much as its strongest alternative" },
      { rule: "importance", level: "default", value: "quiet", because: "every alternative in it is quiet" },
    ])
  }

  // ── Autonomy and reading: other ways to go fold behind one disclosure ───────────────────────────────────────────
  // Never when something there is critical, and never beside an act that cannot be undone: the person sees every way
  // before committing to one that is permanent.
  const primaryIrreversible = primaryNode !== undefined && isIrreversible(primaryNode)
  for (const node of secondary) {
    const collapsed = decide<boolean>(trace, `node ${node.id}.collapsed`, [
      node.emphasis === "critical" && { rule: "critical-never-hidden", level: "safety", value: false, because: "a critical option is never folded away" },
      primaryIrreversible && { rule: "irreversible-explicit", level: "safety", value: false, because: `the primary act "${primary}" cannot be undone: every other way stays in view` },
      capability.reading === "plain" && { rule: "reading", level: "accessibility", value: true, because: "plain reading: other options fold behind one disclosure" },
      persona.autonomy === "delegate" && { rule: "autonomy", level: preference("autonomy"), value: true, because: "the person delegates: only the recommended way stays in view" },
      persona.autonomy === "ask" && { rule: "autonomy", level: preference("autonomy"), value: false, because: "the person picks for themselves: every option stays in view" },
      { rule: "defaults", level: "default", value: false, because: "other ways to go show below the main path" },
    ])
    if (collapsed) node.collapsed = true
  }

  // ── Order: every IR node once, as it is read, spoken or scanned ─────────────────────────────────────────────────
  const order: string[] = []
  const seen = new Set<string>()
  const visit = (n: PlanNode) => {
    if (!n.id.startsWith("~") && !seen.has(n.id)) {
      seen.add(n.id)
      order.push(n.id)
    }
    for (const child of [...(n.merged ?? []), ...(n.attached ?? []), ...(n.items ?? [])]) visit(child)
  }
  for (const n of [...main, ...secondary]) visit(n)

  return {
    plan: PLAN_VERSION,
    experience: experience.experience,
    revision: experience.revision ?? 0,
    locale,
    manifestation,
    chrome,
    density,
    minTarget,
    motion,
    contrast,
    cues,
    primary,
    focus,
    order,
    regions: [
      { id: "main", nodes: main },
      { id: "secondary", nodes: secondary },
    ],
    trace,
  }
}
