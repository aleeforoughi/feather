// The layout plan: what compose() decides, for every manifestation to render. Plain JSON, so it can be logged,
// diffed, snapshot-tested and sent across a process boundary.
import type { Density } from "@aleeforoughi/feather-context"
import type { IRNode, NodeType, Resolution } from "@aleeforoughi/feather-intent"
import type { Level } from "./priority.ts"

export const PLAN_VERSION = "feather.plan/0"

/** Which body the experience takes (composer rule 6). */
export type Manifestation = "web" | "switch" | "voice" | "text"

/** What renders a plan node. Organisms (docs/organisms.md) or the manifestation's own renderer for content nodes. */
export type Organism =
  | "Text"
  | "Action"
  | "Choice"
  | "PredictedChoice"
  | "Input"
  | "Form"
  | "Price"
  | "Person"
  | "Date"
  | "Location"
  | "Status"
  | "Progress"
  | "Media"
  | "Confirmation"
  | "Warning"
  | "Approval"
  | "Recommendation"
  | "AlternativeList"
  | "Tradeoff"
  | "Autopick"
  | "CorrectionInput"
  | "Preference"
  | "Comparison"
  | "IrreversibleAction"
  | "ExploreMore"
  /** A PredictedChoice shown as a note beside an irreversible Choice, which is never preselected. */
  | "PredictionNote"

/** How strongly a node stands out. */
export type Emphasis = "critical" | "primary" | "high" | "default" | "quiet"

/** How an irreversible act is confirmed, per manifestation: two deliberate presses, a spoken or a typed keyword. */
export type ConfirmMode = "confirm" | "spoken-keyword" | "typed-keyword"

export interface PlanNode {
  /** The IR node's id; a group's id starts with "~", which no IR id can. */
  id: string
  type: NodeType | "AlternativeGroup"
  organism: Organism
  emphasis: Emphasis
  /** Whether its expandable detail shows open. Only on nodes that have expandable. */
  expanded?: boolean
  /** How the act is confirmed. Only on acts that commit by themselves; an act committed by an IrreversibleAction
   * that confirms it has none (that IrreversibleAction does). */
  confirm?: ConfirmMode
  /** The word to say or type for spoken-keyword and typed-keyword, in the plan's locale. */
  keyword?: string
  /** Render the text equivalent in place of the medium: an audio or video Media when there is no audio output. */
  textEquivalent?: true
  /** The option preselected in a Choice. */
  preselected?: string
  /** Nodes rendered as part of this one: a Tradeoff on its option, the Person who requests an Approval. */
  attached?: PlanNode[]
  /** A group's members, in order. */
  items?: PlanNode[]
  /** The IR node it renders (absent on groups). */
  node?: IRNode
  /** Nodes folded into this one, composed like any other: the PredictedChoice of a reversible Choice. */
  merged?: PlanNode[]
  /** A secondary node shown folded behind one disclosure ("Other options"), opened by one act. Its acts are unchanged
   * and stay reachable; only what is in view by default changes (rules autonomy and reading). */
  collapsed?: true
}

export interface Region {
  /** "main": the path through the experience, in the IR's order. "secondary": other ways to go. */
  id: "main" | "secondary"
  nodes: PlanNode[]
}

/** Why a value was chosen, and what it overrode (principle 8 order). */
export interface TraceEntry {
  rule: RuleId
  /** The principle 8 level the winning rule acted at. */
  level: Level
  /** What was decided: "plan.density", "node go.confirm", "structure". */
  subject: string
  value: unknown
  because: string
  overrode?: Array<{ rule: RuleId; value: unknown; because: string }>
}

export type RuleId =
  | "one-primary"
  | "irreversible-explicit"
  | "recommendation-first"
  | "critical-never-hidden"
  | "density-and-targets"
  | "output-routing"
  | "explanation-depth"
  | "reduced-motion"
  | "text-without-decision"
  | "contrast"
  | "importance"
  | "structure"
  | "autonomy"
  | "lifecycle"
  | "reading"
  | "defaults"

export interface LayoutPlan {
  plan: typeof PLAN_VERSION
  experience: string
  /** The experience's revision (0 when opened). A body that sees it grow knows the experience was updated (L6). */
  revision: number
  /** "open": render the interaction. "collapsed": the experience is resolved; render only `resolution` (L6). */
  lifecycle: "open" | "collapsed"
  /** How the experience ended, when it has: a one-line summary and what it left behind. */
  resolution?: Resolution
  locale: string
  manifestation: Manifestation
  /** "none": the experience renders as plain text, with no card around it (composer rule 9). */
  chrome: "card" | "none"
  density: Density
  /** Smallest target size, in CSS pixels. */
  minTarget: 24 | 44
  motion: "full" | "reduced"
  /** The WCAG contrast level the theme must reach. */
  contrast: "AA" | "AAA"
  /** "text-only": every cue that would be audio-only is also, or only, text (composer rule 6). */
  cues: "audio-and-text" | "text-only"
  /** The experience's one primary act, if any (composer rule 1). */
  primary: string | null
  /** Where focus starts; never an irreversible act (composer rule 2). Null: focus stays where it is. */
  focus: string | null
  /** Every IR node id once, in reading, speaking and scanning order: main then secondary, each node followed by
   * what is merged into it, attached to it, or grouped in it. */
  order: string[]
  regions: Region[]
  trace: TraceEntry[]
}
