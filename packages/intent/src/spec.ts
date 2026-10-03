// The Experience IR, as data. One table describes every node type: its fields, whether it is an act, which reply
// acts it takes. The validator (validate.ts) reads it at runtime; scripts/generate.ts writes the JSON Schema and the
// reference docs from it, so the three cannot drift apart. The TypeScript types (types.ts) mirror it by hand.

export type Field =
  | { kind: "string"; doc: string; required?: boolean; maxLength?: number }
  | { kind: "number"; doc: string; required?: boolean; min?: number; max?: number; integer?: boolean }
  | { kind: "boolean"; doc: string; required?: boolean }
  | { kind: "enum"; doc: string; required?: boolean; values: readonly string[] }
  | { kind: "currency"; doc: string; required?: boolean }
  | { kind: "date"; doc: string; required?: boolean }
  | { kind: "scalar"; doc: string; required?: boolean }
  | { kind: "ref"; doc: string; required?: boolean; to?: readonly string[] }
  | { kind: "refs"; doc: string; required?: boolean; to?: readonly string[]; minItems?: number }
  | { kind: "strings"; doc: string; required?: boolean; minItems?: number }
  | { kind: "scalars"; doc: string; required?: boolean; minItems?: number }
  | { kind: "array"; doc: string; required?: boolean; minItems?: number; of: Record<string, Field> }
  | { kind: "object"; doc: string; required?: boolean; fields: Record<string, Field>; atLeastOne?: boolean }
  | { kind: "record"; doc: string; required?: boolean; of: "scalar" }

export interface NodeSpec {
  type: string
  family: "content" | "decision"
  doc: string
  /** An act node is something the person does: it needs an intent and takes replies. */
  act: boolean
  /** It may be the experience's one primary act. */
  primaryCapable: boolean
  /** The acts its replies may carry, and whether each carries a value. */
  acts: Record<string, { value: "none" | "required" | "optional"; doc: string }>
  fields: Record<string, Field>
  /** Default values the composer assumes when the caller leaves a field out. */
  defaults?: { importance?: string; reversible?: boolean }
}

const money: Record<string, Field> = {
  amount: { kind: "number", doc: "In the currency's major unit.", required: true, min: 0 },
  currency: { kind: "currency", doc: "ISO 4217 code.", required: true },
}

export const consequenceField: Field = {
  kind: "object",
  doc: "What the act does, stated so it can be shown verbatim. At least one entry.",
  atLeastOne: true,
  fields: {
    spend: { kind: "object", doc: "Money that will be spent.", fields: money },
    publish: { kind: "object", doc: "Something that will be made public.", fields: { audience: { kind: "string", doc: "Who will see it.", required: true } } },
    send: {
      kind: "object",
      doc: "Something that will be sent.",
      fields: { to: { kind: "string", doc: "The recipient.", required: true }, channel: { kind: "string", doc: "How: email, SMS…" } },
    },
    consent: {
      kind: "object",
      doc: "Permission the person grants.",
      fields: { to: { kind: "string", doc: "Who receives it.", required: true }, scope: { kind: "string", doc: "What it covers.", required: true } },
    },
    delete: { kind: "object", doc: "Something that will be deleted.", fields: { what: { kind: "string", doc: "What.", required: true } } },
    statement: { kind: "string", doc: "The consequence in the caller's own words." },
  },
}

/** Fields every node carries. `primary` is added for primary-capable nodes. */
export const commonFields: Record<string, Field> = {
  id: { kind: "string", doc: "Stable within the experience; replies and references use it.", required: true, maxLength: 64 },
  intent: { kind: "string", doc: "What the human is doing here, in a few words. Required on act nodes.", maxLength: 120 },
  importance: { kind: "enum", doc: "How much it matters. Default normal; critical is never hidden behind expansion.", values: ["low", "normal", "high", "critical"] },
  reversible: { kind: "boolean", doc: "Whether the effect can be undone. Default true." },
  expandable: {
    kind: "object",
    doc: 'Detail on demand, behind "Why?". At least one entry.',
    atLeastOne: true,
    fields: { why: { kind: "string", doc: "The reason, in a sentence or two." }, detail: { kind: "string", doc: "Longer supporting detail." } },
  },
}

export const primaryField: Field = { kind: "boolean", doc: "This node is the experience's main act. At most one per experience." }

const none = {} as NodeSpec["acts"]
const ALTERNATIVE_INPUTS = ["Price", "Date", "Text", "Location", "Person"] as const

export const NODES: NodeSpec[] = [
  // ── Content ──────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    type: "Text",
    family: "content",
    doc: "Plain words. One line with no decision renders as text, never a card.",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: { text: { kind: "string", doc: "The words.", required: true } },
  },
  {
    type: "Action",
    family: "content",
    doc: "Something the person can do.",
    act: true,
    primaryCapable: true,
    acts: { activate: { value: "none", doc: "The person did it." } },
    fields: { label: { kind: "string", doc: "The words for the act; defaults to the intent.", maxLength: 60 } },
  },
  {
    type: "Choice",
    family: "content",
    doc: "Pick one, or several, of a known set.",
    act: true,
    primaryCapable: true,
    acts: { choose: { value: "required", doc: "The picked option id (an array of ids when multiple)." } },
    fields: {
      prompt: { kind: "string", doc: "The question.", required: true },
      options: {
        kind: "array",
        doc: "The options, at least two, ids unique.",
        required: true,
        minItems: 2,
        of: {
          id: { kind: "string", doc: "Unique among the options.", required: true, maxLength: 64 },
          label: { kind: "string", doc: "The words for it.", required: true },
          description: { kind: "string", doc: "One line more." },
        },
      },
      multiple: { kind: "boolean", doc: "Several may be picked. Default false." },
      selected: { kind: "strings", doc: "Option ids already picked." },
    },
  },
  {
    type: "Input",
    family: "content",
    doc: "A fact the caller does not have yet, asked of the person.",
    act: true,
    primaryCapable: true,
    acts: { submit: { value: "required", doc: "The value given." } },
    fields: {
      prompt: { kind: "string", doc: "The question.", required: true },
      kind: { kind: "enum", doc: "What kind of value.", required: true, values: ["text", "long-text", "number", "email", "phone", "url", "date", "money"] },
      required: { kind: "boolean", doc: "An answer is needed to continue." },
      value: { kind: "scalar", doc: "The current value, if any." },
      min: { kind: "number", doc: "For number and money: the smallest accepted." },
      max: { kind: "number", doc: "For number and money: the largest accepted." },
      maxLength: { kind: "number", doc: "For text kinds: the longest accepted.", min: 1, integer: true },
      currency: { kind: "currency", doc: "For money: the currency." },
    },
  },
  {
    type: "Price",
    family: "content",
    doc: "An amount of money.",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: {
      ...money,
      label: { kind: "string", doc: "What the amount is." },
      period: { kind: "enum", doc: "How often it is charged. Default once.", values: ["once", "hour", "day", "week", "month", "year"] },
    },
  },
  {
    type: "Person",
    family: "content",
    doc: "A person or an agent.",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: {
      name: { kind: "string", doc: "Their name.", required: true },
      role: { kind: "string", doc: "What they do here." },
      kind: { kind: "enum", doc: "Default human.", values: ["human", "agent"] },
    },
  },
  {
    type: "Date",
    family: "content",
    doc: "A date, a date and time, or a range (ISO 8601).",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: {
      value: { kind: "date", doc: "ISO 8601 date or date-time.", required: true },
      until: { kind: "date", doc: "The end of a range." },
      label: { kind: "string", doc: "What the date is." },
    },
  },
  {
    type: "Location",
    family: "content",
    doc: "A place.",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: {
      name: { kind: "string", doc: "Its name.", required: true },
      address: { kind: "string", doc: "Postal address." },
      coordinates: {
        kind: "object",
        doc: "Latitude and longitude.",
        fields: {
          lat: { kind: "number", doc: "Latitude.", required: true, min: -90, max: 90 },
          lng: { kind: "number", doc: "Longitude.", required: true, min: -180, max: 180 },
        },
      },
    },
  },
  {
    type: "Status",
    family: "content",
    doc: "The state of something ongoing.",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: {
      state: { kind: "enum", doc: "Where it stands.", required: true, values: ["idle", "working", "waiting", "done", "failed", "blocked"] },
      label: { kind: "string", doc: "What is in that state.", required: true },
    },
  },
  {
    type: "Progress",
    family: "content",
    doc: "How far along something is. No value means indeterminate.",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: {
      label: { kind: "string", doc: "What is progressing.", required: true },
      value: { kind: "number", doc: "0 to 1.", min: 0, max: 1 },
      steps: {
        kind: "array",
        doc: "The plan, step by step.",
        of: {
          id: { kind: "string", doc: "Unique among the steps.", required: true, maxLength: 64 },
          label: { kind: "string", doc: "The step.", required: true },
          state: { kind: "enum", doc: "Where it stands.", required: true, values: ["pending", "active", "done", "blocked"] },
        },
      },
    },
  },
  {
    type: "Media",
    family: "content",
    doc: "An image, video, audio or document. Every medium carries its text equivalent.",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: {
      kind: { kind: "enum", doc: "What it is.", required: true, values: ["image", "video", "audio", "document"] },
      src: { kind: "string", doc: "Where it is (URL).", required: true },
      alt: { kind: "string", doc: "Required for image and video: what it shows." },
      transcript: { kind: "string", doc: "Required for audio; for video, this or captions." },
      captions: { kind: "string", doc: "URL of a caption track (WebVTT), for video." },
      caption: { kind: "string", doc: "A visible caption." },
    },
  },
  {
    type: "Confirmation",
    family: "content",
    doc: "Something the person did took effect.",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: {
      text: { kind: "string", doc: "What happened.", required: true },
      of: { kind: "ref", doc: "The node whose act this confirms." },
    },
  },
  {
    type: "Warning",
    family: "content",
    doc: "A risk the person should know about.",
    act: false,
    primaryCapable: false,
    acts: { acknowledge: { value: "none", doc: "The person acknowledged it (only when acknowledge is true)." } },
    defaults: { importance: "high" },
    fields: {
      text: { kind: "string", doc: "The risk.", required: true },
      severity: { kind: "enum", doc: "Default caution.", values: ["caution", "danger"] },
      acknowledge: { kind: "boolean", doc: "The person must acknowledge it." },
    },
  },
  {
    type: "Approval",
    family: "content",
    doc: "A request for the person's authority: approve or reject.",
    act: true,
    primaryCapable: true,
    acts: { approve: { value: "none", doc: "Approved." }, reject: { value: "optional", doc: "Rejected, optionally with a reason." } },
    fields: {
      request: { kind: "string", doc: "What is being asked.", required: true },
      requester: { kind: "ref", doc: "The Person node asking.", to: ["Person"] },
      scope: { kind: "string", doc: "What the approval covers." },
      consequence: consequenceField,
    },
  },

  // ── Decision ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    type: "Recommendation",
    family: "decision",
    doc: "What the caller recommends. It comes first; alternatives follow.",
    act: true,
    primaryCapable: true,
    acts: { accept: { value: "none", doc: "The person took the recommendation." } },
    fields: {
      summary: { kind: "string", doc: "The recommendation, in one line.", required: true },
      confidence: { kind: "number", doc: "0 to 1.", min: 0, max: 1 },
      consequence: consequenceField,
    },
  },
  {
    type: "PredictedChoice",
    family: "decision",
    doc: "The option the caller expects the person to pick in a Choice.",
    act: true,
    primaryCapable: false,
    acts: { accept: { value: "none", doc: "The prediction was right." }, change: { value: "required", doc: "The option id picked instead." } },
    fields: {
      of: { kind: "ref", doc: "The Choice node.", required: true, to: ["Choice"] },
      option: { kind: "string", doc: "The predicted option's id in that Choice.", required: true },
      summary: { kind: "string", doc: "Why, in one line." },
      confidence: { kind: "number", doc: "0 to 1.", min: 0, max: 1 },
    },
  },
  {
    type: "Alternative",
    family: "decision",
    doc: "Another way to go than the recommendation.",
    act: true,
    primaryCapable: false,
    acts: { choose: { value: "optional", doc: "Chosen; carries the value when the alternative takes an input." } },
    fields: {
      label: { kind: "string", doc: "The words for it; defaults to the intent.", maxLength: 60 },
      for: { kind: "ref", doc: "The node this is an alternative to." },
      input: { kind: "enum", doc: "The person supplies a value of this kind when choosing it.", values: ALTERNATIVE_INPUTS },
    },
  },
  {
    type: "Tradeoff",
    family: "decision",
    doc: "What one option gains and costs. At least one gain or cost.",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: {
      of: { kind: "ref", doc: "The node the tradeoff describes." },
      summary: { kind: "string", doc: "The tradeoff, in one line." },
      gains: { kind: "strings", doc: "What it gains." },
      costs: { kind: "strings", doc: "What it costs." },
    },
  },
  {
    type: "Autopick",
    family: "decision",
    doc: "A decision already made for the person, which they may keep or undo.",
    act: true,
    primaryCapable: false,
    acts: { keep: { value: "none", doc: "Kept." }, undo: { value: "none", doc: "Undone." } },
    fields: {
      summary: { kind: "string", doc: "What was decided, in one line.", required: true },
      of: { kind: "ref", doc: "The node decided on." },
      undoWithin: { kind: "number", doc: "Seconds the person has to undo.", min: 1, integer: true },
    },
  },
  {
    type: "Correction",
    family: "decision",
    doc: "The person corrects something that was understood wrong.",
    act: true,
    primaryCapable: false,
    acts: { submit: { value: "required", doc: "The correction." } },
    fields: {
      target: { kind: "ref", doc: "The node being corrected.", required: true },
      prompt: { kind: "string", doc: "The question.", required: true },
      original: { kind: "string", doc: "What was understood, in words." },
    },
  },
  {
    type: "Preference",
    family: "decision",
    doc: "A setting the person may change. Feather stores nothing; the reply goes back to the caller.",
    act: true,
    primaryCapable: false,
    acts: { set: { value: "required", doc: "The new value." } },
    fields: {
      key: { kind: "string", doc: "The caller's name for the setting.", required: true },
      label: { kind: "string", doc: "The words for it.", required: true },
      value: { kind: "scalar", doc: "The current value.", required: true },
      options: { kind: "scalars", doc: "The values allowed, when a fixed set.", minItems: 2 },
    },
  },
  {
    type: "Comparison",
    family: "decision",
    doc: "Several nodes side by side on the same criteria.",
    act: false,
    primaryCapable: false,
    acts: none,
    fields: {
      items: { kind: "refs", doc: "The compared node ids, at least two.", required: true, minItems: 2 },
      criteria: {
        kind: "array",
        doc: "What they are compared on; each gives a value for every item.",
        required: true,
        minItems: 1,
        of: {
          label: { kind: "string", doc: "The criterion.", required: true },
          values: { kind: "record", doc: "One value per compared node id.", required: true, of: "scalar" },
        },
      },
    },
  },
  {
    type: "IrreversibleAction",
    family: "decision",
    doc: "An act that cannot be undone: spending, publishing, sending, consent. Always explicit, never the default focus.",
    act: true,
    primaryCapable: true,
    acts: { confirm: { value: "none", doc: "Confirmed by a deliberate act." }, cancel: { value: "none", doc: "Not done." } },
    defaults: { importance: "critical", reversible: false },
    fields: {
      label: { kind: "string", doc: "The words for the act; defaults to the intent.", maxLength: 60 },
      consequence: { ...consequenceField, required: true },
    },
  },
  {
    type: "ExploreMore",
    family: "decision",
    doc: "More is available on request; the caller sends it when the person asks.",
    act: true,
    primaryCapable: false,
    acts: { expand: { value: "optional", doc: "The person asked for more, optionally about one topic." } },
    fields: {
      label: { kind: "string", doc: "The words for it; defaults to the intent.", maxLength: 60 },
      topics: { kind: "strings", doc: "What more is available." },
    },
  },
]

export const NODE_SPECS: Record<string, NodeSpec> = Object.fromEntries(NODES.map((n) => [n.type, n]))

/**
 * Field names that describe presentation, not meaning. A caller never sends them (principle 1: semantics, not
 * pixels); the validator names the principle instead of only saying "unknown field".
 */
export const PRESENTATIONAL_FIELDS = new Set([
  "color", "colour", "background", "style", "className", "class", "css", "theme", "variant", "size", "width", "height",
  "x", "y", "position", "top", "left", "right", "bottom", "margin", "padding", "font", "fontSize", "icon", "component",
  "layout", "align", "order", "zIndex", "animation", "radius",
])
