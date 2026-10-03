// The Experience IR, feather.ir/0: what a caller asks Feather to render.
//
// A caller describes meaning: what must happen, how much it matters, whether it can be undone. It never names a
// component, a color or a position (principle 1); Feather decides how each node manifests for this person, on this
// device. These types mirror src/spec.ts, which the validator, the JSON Schema and the reference docs are built from.

export const IR_VERSION = "feather.ir/0"

/** How much a node matters. `critical` is never hidden behind expansion. */
export type Importance = "low" | "normal" | "high" | "critical"

/** Detail on demand, behind "Why?": at least one of the two. */
export interface Expandable {
  /** The reason, in a sentence or two. */
  why?: string
  /** Longer supporting detail. */
  detail?: string
}

/** Fields every node carries. */
export interface NodeBase {
  /** Stable within the experience; replies and references use it. */
  id: string
  /** What the human is doing here, in a few words ("confirm spend"). Required on act nodes. */
  intent?: string
  /** Default `normal`. */
  importance?: Importance
  /** Whether the effect can be undone. Default `true`; an IrreversibleAction is always `false`. */
  reversible?: boolean
  expandable?: Expandable
}

/** Nodes that are the experience's main act may say so. At most one node per experience is primary. */
export interface PrimaryCapable {
  primary?: boolean
}

export interface Money {
  /** In the currency's major unit (1050 means AED 1,050). */
  amount: number
  /** ISO 4217 code: AED, USD, EUR. */
  currency: string
}

/** What an irreversible act does, stated so it can be shown verbatim. At least one entry. */
export interface Consequence {
  spend?: Money
  publish?: { audience: string }
  send?: { to: string; channel?: string }
  consent?: { to: string; scope: string }
  delete?: { what: string }
  /** The consequence in the caller's own words, when the kinds above do not fit. */
  statement?: string
}

// ── Content nodes ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Plain words. One line with no decision renders as text, never a card. */
export interface TextNode extends NodeBase {
  type: "Text"
  text: string
}

/** Something the person can do. */
export interface ActionNode extends NodeBase, PrimaryCapable {
  type: "Action"
  intent: string
  /** The words for the act; defaults to the intent. */
  label?: string
}

export interface ChoiceOption {
  id: string
  label: string
  description?: string
}

/** Pick one (or several) of a known set. */
export interface ChoiceNode extends NodeBase, PrimaryCapable {
  type: "Choice"
  intent: string
  prompt: string
  options: ChoiceOption[]
  /** Several may be picked. Default `false`. */
  multiple?: boolean
  /** Option ids already picked. */
  selected?: string[]
}

/** A fact Feather does not have yet, asked of the person. */
export interface InputNode extends NodeBase, PrimaryCapable {
  type: "Input"
  intent: string
  prompt: string
  kind: "text" | "long-text" | "number" | "email" | "phone" | "url" | "date" | "money"
  required?: boolean
  /** The current value, if any. */
  value?: string | number
  /** For number and money: the smallest and largest accepted. */
  min?: number
  max?: number
  /** For text kinds: the longest accepted. */
  maxLength?: number
  /** For money: the currency (ISO 4217). */
  currency?: string
}

/** An amount of money. */
export interface PriceNode extends NodeBase {
  type: "Price"
  amount: number
  currency: string
  label?: string
  /** How often it is charged. Default `once`. */
  period?: "once" | "hour" | "day" | "week" | "month" | "year"
}

/** A person or an agent. */
export interface PersonNode extends NodeBase {
  type: "Person"
  name: string
  role?: string
  /** Default `human`. */
  kind?: "human" | "agent"
}

/** A date, a date and time, or a range. ISO 8601. */
export interface DateNode extends NodeBase {
  type: "Date"
  value: string
  /** The end of a range. */
  until?: string
  label?: string
}

/** A place. */
export interface LocationNode extends NodeBase {
  type: "Location"
  name: string
  address?: string
  coordinates?: { lat: number; lng: number }
}

/** The state of something ongoing. */
export interface StatusNode extends NodeBase {
  type: "Status"
  state: "idle" | "working" | "waiting" | "done" | "failed" | "blocked"
  label: string
}

export interface ProgressStep {
  id: string
  label: string
  state: "pending" | "active" | "done" | "blocked"
}

/** How far along something is. No `value` means indeterminate. */
export interface ProgressNode extends NodeBase {
  type: "Progress"
  label: string
  /** 0 to 1. */
  value?: number
  steps?: ProgressStep[]
}

/** An image, video, audio or document. Every medium carries its text equivalent. */
export interface MediaNode extends NodeBase {
  type: "Media"
  kind: "image" | "video" | "audio" | "document"
  src: string
  /** Required for image and video. */
  alt?: string
  /** Required for audio; for video, captions or a transcript. */
  transcript?: string
  /** URL of a caption track (WebVTT) for video. */
  captions?: string
  caption?: string
}

/** Something the person did took effect. */
export interface ConfirmationNode extends NodeBase {
  type: "Confirmation"
  text: string
  /** The node whose act this confirms. */
  of?: string
}

/** A risk the person should know about. */
export interface WarningNode extends NodeBase {
  type: "Warning"
  text: string
  /** Default `caution`. */
  severity?: "caution" | "danger"
  /** The person must acknowledge it (reply act `acknowledge`). */
  acknowledge?: boolean
}

/** A request for the person's authority: approve or reject. */
export interface ApprovalNode extends NodeBase, PrimaryCapable {
  type: "Approval"
  intent: string
  request: string
  /** The Person node asking. */
  requester?: string
  /** What the approval covers, in words. */
  scope?: string
  consequence?: Consequence
}

// ── Decision nodes ────────────────────────────────────────────────────────────────────────────────────────────────

/** What the caller recommends. Comes first; alternatives follow. */
export interface RecommendationNode extends NodeBase, PrimaryCapable {
  type: "Recommendation"
  intent: string
  summary: string
  /** 0 to 1. */
  confidence?: number
  consequence?: Consequence
}

/** The option the caller expects the person to pick, in a Choice. */
export interface PredictedChoiceNode extends NodeBase {
  type: "PredictedChoice"
  intent: string
  /** The Choice node. */
  of: string
  /** The predicted option's id in that Choice. */
  option: string
  summary?: string
  confidence?: number
}

/** Another way to go than the recommendation. */
export interface AlternativeNode extends NodeBase {
  type: "Alternative"
  intent: string
  label?: string
  /** The node this is an alternative to. */
  for?: string
  /** The person supplies a value of this kind when choosing it ("set my own budget": Price). */
  input?: "Price" | "Date" | "Text" | "Location" | "Person"
}

/** What one option gains and costs. */
export interface TradeoffNode extends NodeBase {
  type: "Tradeoff"
  /** The node the tradeoff describes. */
  of?: string
  summary?: string
  gains?: string[]
  costs?: string[]
}

/** A decision already made for the person ("decide for me"), which they may keep or undo. */
export interface AutopickNode extends NodeBase {
  type: "Autopick"
  intent: string
  summary: string
  /** The node decided on. */
  of?: string
  /** Seconds the person has to undo. */
  undoWithin?: number
}

/** The person corrects something Feather or the caller got wrong ("not that one, the blue one"). */
export interface CorrectionNode extends NodeBase {
  type: "Correction"
  intent: string
  /** The node being corrected. */
  target: string
  prompt: string
  /** What was understood, in words. */
  original?: string
}

/** A setting the person may change. Feather stores nothing; the reply goes back to the caller. */
export interface PreferenceNode extends NodeBase {
  type: "Preference"
  intent: string
  key: string
  label: string
  value: string | number | boolean
  /** The values allowed, when a fixed set. */
  options?: Array<string | number | boolean>
}

export interface ComparisonCriterion {
  label: string
  /** One value per compared node id. */
  values: Record<string, string | number>
}

/** Several nodes side by side on the same criteria. */
export interface ComparisonNode extends NodeBase {
  type: "Comparison"
  /** The compared node ids, at least two. */
  items: string[]
  criteria: ComparisonCriterion[]
}

/** An act that cannot be undone: spending, publishing, sending, consent. Always explicit, never the default focus. */
export interface IrreversibleActionNode extends NodeBase, PrimaryCapable {
  type: "IrreversibleAction"
  intent: string
  label?: string
  consequence: Consequence
  reversible?: false
}

/** More is available on request; the caller sends it when the person asks. */
export interface ExploreMoreNode extends NodeBase {
  type: "ExploreMore"
  intent: string
  label?: string
  topics?: string[]
}

export type ContentNode =
  | TextNode
  | ActionNode
  | ChoiceNode
  | InputNode
  | PriceNode
  | PersonNode
  | DateNode
  | LocationNode
  | StatusNode
  | ProgressNode
  | MediaNode
  | ConfirmationNode
  | WarningNode
  | ApprovalNode

export type DecisionNode =
  | RecommendationNode
  | PredictedChoiceNode
  | AlternativeNode
  | TradeoffNode
  | AutopickNode
  | CorrectionNode
  | PreferenceNode
  | ComparisonNode
  | IrreversibleActionNode
  | ExploreMoreNode

export type IRNode = ContentNode | DecisionNode
export type NodeType = IRNode["type"]

/** One experience: the next necessary interaction, as meaning. */
export interface Experience {
  ir: typeof IR_VERSION
  /** Names the experience; replies carry it back. */
  experience: string
  /** BCP 47 language of the words in it ("en", "ar-AE"). */
  locale?: string
  nodes: IRNode[]
}

/** What the person did, sent back to the caller. */
export interface ReplyEvent {
  experience: string
  node: string
  act: string
  value?: string | number | boolean | string[]
}
