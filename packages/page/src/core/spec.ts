// feather.page/0: a website as data. One document, rendered by any brand, makes a complete site; changing `brand`
// restyles all of it. This file is the single table of block fields: `validate.ts` reads it, and
// `scripts/generate.ts` writes `schema/feather.page-0.json` from it. The block set is the Living Page library (Qooler
// file 22 §3) and matches @aleeforoughi/feather-living's BLOCK_KINDS.

/** The schema a new page is written in. `feather.page/1` adds the page edges (EDGES) to /0; every /0 page is valid. */
export const PAGE_SCHEMA = "feather.page/1"
/** Every schema the validator reads. */
export const PAGE_SCHEMAS = ["feather.page/0", "feather.page/1"] as const

/** A field's shape. Kept small on purpose: what a page needs, nothing a renderer would have to guess. */
export type FieldSpec =
  | { kind: "text"; max?: number }
  /** A number, optionally bounded (inclusive) and whole. Out of bounds is `out-of-range`. */
  | { kind: "number"; min?: number; max?: number; integer?: boolean }
  | { kind: "boolean" }
  /** One of a fixed set of names (a variant). A value outside the set is `type`, or `code` when given. */
  | { kind: "enum"; values: readonly string[]; code?: "unknown-variant" }
  /** A small object of its own fields (the knobs' motion and scroll). */
  | { kind: "object"; of: Record<string, FieldSpec & { required?: boolean }> }
  | { kind: "media" }
  | { kind: "href" }
  | { kind: "texts"; min?: number; max?: number }
  | { kind: "list"; of: Record<string, FieldSpec & { required?: boolean }>; min?: number; max?: number; ids?: boolean }
  /** A list of library ids (strings) or inline items of the given shape. */
  | { kind: "refs"; library: string; of: Record<string, FieldSpec & { required?: boolean }>; min?: number; max?: number }
  /** A fixed-length list of numbers (a point in a model's space). */
  | { kind: "vector"; length: number; min?: number; max?: number }
  /** An object of free keys (slugs or names) to text: a variant's material colours. */
  | { kind: "map"; key?: string; max?: number; value?: number }
  /** A list of finite numbers, `min` to `max` of them (a chart row's values). */
  | { kind: "numbers"; min?: number; max?: number }

export type Fields = Record<string, FieldSpec & { required?: boolean }>

const text = (max?: number, required = false) => ({ kind: "text" as const, ...(max ? { max } : {}), ...(required ? { required } : {}) })
const TITLE = text(120)
const BODY = text(600)

const WORK_ITEM: Fields = { id: text(60, true), title: text(120, true), summary: BODY, media: { kind: "media" }, href: { kind: "href" }, year: text(12), role: text(80) }

// ---- Product flows in a page (feather.page/1, wave 5, range proposal §5 J) ----------------------------------------
// The quiz, the booking flow, the pricing calculator, the chart, the places list and the podcast player, plus two
// knobs: the page's colour scheme toggle and the view-mode switch. BLOCKS, BLOCK_RANGE, PAGE_KNOBS and blockFields
// spread these in; validate-flows.ts holds what a field table cannot say. Every one of them works in full with no
// script, as a static, honest form.

type Field = FieldSpec & { required?: boolean }
const FLOW_ID = text(40, true)
const int = (min: number, max: number, required = false): Field => ({ kind: "number", min, max, integer: true, ...(required ? { required } : {}) })

/** How a quiz decides: tally (each answer points to a result; the most chosen wins) or score (each answer adds points;
 * the total picks the result by its min–max range). A result's `match` (an exact combination) comes first in both. */
export const QUIZ_SCORING = ["tally", "score"] as const
/** The calculator's input kinds: a slider, a number field, a choice of options, an on/off switch (1 or 0). */
export const CALCULATOR_INPUTS = ["range", "number", "radio", "toggle"] as const
/** The views the view-mode switch offers (on work, and any block that lists it in VIEW_BLOCKS). */
export const VIEW_MODES = ["grid", "list", "index"] as const
/** The blocks that take `views`. */
export const VIEW_BLOCKS = ["work"] as const
/** Where the scheme toggle sits: in the nav's bar or in the footer. */
export const SCHEME_TOGGLES = ["nav", "footer"] as const
/** The colour roles a scheme's other set gives (the brand's four required roles, and the named ones it may set). */
export const SCHEME_COLORS = ["background", "surface", "text", "primary", "primaryText", "accent", "accentText", "destructive"] as const
/** The audio files a podcast episode may be. */
export const AUDIO_FILE = /\.(?:mp3|m4a|aac|ogg|oga|opus|wav|webm)(?:[?#]|$)/i

/** The new blocks. Each is a feather.page/1 block (`since: 1`): on a /0 page it reports `needs-schema-1`. */
export const FLOW_BLOCKS: Record<string, { fields: Fields; doc: string; since: 1 }> = {
  quiz: {
    doc: "Questions with real radio options, one per step, and a result keyed by the answers. With no script, every question shows, and how the result is decided.",
    since: 1,
    fields: {
      title: text(120, true),
      body: BODY,
      scoring: { kind: "enum", values: QUIZ_SCORING },
      questions: { kind: "list", min: 1, max: 8, of: { id: FLOW_ID, q: text(160, true), help: text(240), options: { kind: "list", required: true, min: 2, max: 6, of: { id: FLOW_ID, label: text(80, true), result: text(40), score: int(-100, 100) } } } },
      results: { kind: "list", min: 1, max: 8, of: { id: FLOW_ID, title: text(120, true), body: BODY, href: { kind: "href" }, label: text(40), min: int(-800, 800), max: int(-800, 800), match: { kind: "map", key: "a question id", max: 8, value: 40 } } },
    },
  },
  booking: {
    doc: "A booking flow: service, then date and time, then details, then a review before anything is sent. Slots come from the page; it sends to an action URL, a mailto, or hands over to a booking link.",
    since: 1,
    fields: {
      title: text(120, true),
      body: BODY,
      services: { kind: "list", min: 1, max: 8, of: { id: FLOW_ID, name: text(60, true), duration: text(40), price: text(40), body: text(240) } },
      days: { kind: "list", min: 1, max: 14, of: { date: text(10, true), label: text(40), slots: { kind: "texts", min: 1, max: 16 } } },
      zone: text(80),
      ask: { kind: "object", of: { phone: { kind: "boolean" }, note: { kind: "boolean" } } },
      action: { kind: "href" },
      mailto: text(120),
      link: { kind: "href" },
      confirm: text(40),
    },
  },
  calculator: {
    doc: "A pricing calculator: inputs (range, number, radio, toggle) and a price formula in a small safe language (+ - * /, min, max, round). The total and its breakdown are announced as they change; with no script, the starting prices show.",
    since: 1,
    fields: {
      title: text(120, true),
      body: BODY,
      inputs: {
        kind: "list",
        min: 1,
        max: 8,
        of: {
          id: text(32, true),
          label: text(60, true),
          kind: { kind: "enum", values: CALCULATOR_INPUTS, required: true },
          min: { kind: "number", min: -1e9, max: 1e9 },
          max: { kind: "number", min: -1e9, max: 1e9 },
          step: { kind: "number", min: 0.0001, max: 1e9 },
          value: { kind: "number", min: -1e9, max: 1e9 },
          unit: text(16),
          help: text(160),
          options: { kind: "list", min: 2, max: 6, of: { label: text(60, true), value: { kind: "number", min: -1e9, max: 1e9, required: true } } },
        },
      },
      lines: { kind: "list", max: 6, of: { id: text(32), label: text(60, true), formula: text(400, true) } },
      formula: text(400, true),
      total: text(60),
      prefix: text(4),
      suffix: text(24),
      decimals: int(0, 2),
      note: text(240),
    },
  },
  chart: {
    doc: "Data as a bar, line or area chart, drawn in SVG in the theme's inks, with its summary sentence and the data as a table behind a disclosure. The end state draws in on reveal; under reduced motion it is simply there.",
    since: 1,
    fields: {
      title: text(120, true),
      summary: text(240, true),
      series: { kind: "list", min: 1, max: 4, of: { label: text(40, true) } },
      rows: { kind: "list", min: 2, max: 24, of: { label: text(24, true), values: { kind: "numbers", min: 1, max: 4, required: true } } },
      axis: text(40),
      unit: text(12),
      prefix: text(4),
      decimals: int(0, 2),
      source: text(160),
    },
  },
  places: {
    doc: "Places to find: always a list of names, addresses and links (directions, the place's own site, a phone number), with an optional still map. No map SDK and no tiles.",
    since: 1,
    fields: {
      title: text(120, true),
      body: BODY,
      media: { kind: "media" },
      items: { kind: "list", min: 1, max: 24, of: { name: text(80, true), address: text(200, true), directions: { kind: "href" }, href: { kind: "href" }, phone: text(40), hours: text(120), note: text(160) } },
    },
  },
  podcast: {
    doc: "Episodes on native audio with real-button controls (play, ±15 s, speed, a scrub slider), chapters that seek, and a transcript (required) that can follow playback. Never autoplays; with no script, the browser's own controls.",
    since: 1,
    fields: {
      title: text(120, true),
      body: BODY,
      episodes: {
        kind: "list",
        min: 1,
        max: 12,
        of: {
          id: FLOW_ID,
          title: text(120, true),
          audio: { kind: "media", required: true },
          duration: text(12),
          date: text(24),
          summary: text(400),
          chapters: { kind: "list", max: 24, of: { at: { kind: "number", min: 0, max: 86400, required: true }, title: text(80, true) } },
          transcript: { kind: "list", required: true, min: 1, max: 600, of: { at: { kind: "number", min: 0, max: 86400 }, by: text(60), text: text(2000, true) } },
        },
      },
    },
  },
}

/** The new blocks' range: variants (the first is the default), aligns and scroll. None has a crop. */
export const FLOW_RANGE: Record<string, BlockRange> = {
  quiz: { variants: ["steps"], aligns: ["start", "center", "split"], scroll: ["reveal"], crop: false, scale: true },
  booking: { variants: ["steps"], aligns: ["start", "split"], scroll: ["reveal"], crop: false, scale: true },
  calculator: { variants: ["split", "stacked"], aligns: ["start", "split"], scroll: ["reveal"], crop: false, scale: true },
  chart: { variants: ["bar", "line", "area"], aligns: ["start", "center", "split"], scroll: ["reveal"], crop: false, scale: true },
  places: { variants: ["list", "map"], aligns: ["start", "split"], scroll: ["reveal"], crop: false, scale: true, needsMedia: ["map"] },
  podcast: { variants: ["list"], aligns: ["start", "split"], scroll: ["reveal"], crop: false, scale: true },
}

/** The view-mode switch, on the blocks in VIEW_BLOCKS: the view it starts in (the static form), and its presence
 * offers grid, list and index through a segmented radio group, remembered per page. */
export const VIEWS_FIELD: Field = { kind: "enum", values: VIEW_MODES }

/** The page's colour scheme toggle: light, dark and system, `prefers-color-scheme` first. `colors` is the brand's
 * other set (its dark colours for a light brand, its light ones for a dark brand), compiled by the theme engine. */
export const FLOW_PAGE_KNOBS: Fields = {
  scheme: {
    kind: "object",
    of: {
      toggle: { kind: "enum", values: SCHEME_TOGGLES },
      colors: { kind: "object", required: true, of: Object.fromEntries(SCHEME_COLORS.map((k, i) => [k, text(32, i < 4)])) },
    },
  },
}

/** Every block kind and its fields. `id` and `title` are allowed on every block. A block with `since: 1` is a
 * feather.page/1 block: on a /0 page it reports `needs-schema-1`. */
export const BLOCKS: Record<string, { fields: Fields; doc: string; since?: 1 }> = {
  hero: { doc: "The first view: the display title, a short lede, the brand's medium and the starters.", fields: { eyebrow: text(60), title: text(120, true), lede: BODY, media: { kind: "media" }, starters: { kind: "texts", max: 5 } } },
  statement: { doc: "One idea in display type, with an optional line of body.", fields: { title: text(160, true), body: BODY } },
  work: { doc: "Selected work, from the library or inline.", fields: { title: TITLE, items: { kind: "refs", library: "work", of: WORK_ITEM, min: 1, max: 12 } } },
  case: { doc: "One piece of work told: a title, the medium, the facts.", fields: { title: text(120, true), body: BODY, media: { kind: "media" }, facts: { kind: "list", of: { label: text(40, true), value: text(60, true) }, max: 6 } } },
  numbers: { doc: "Up to four numbers that prove something, counted in.", fields: { title: TITLE, items: { kind: "list", of: { value: { kind: "number", required: true }, unit: text(12), label: text(60, true) }, min: 1, max: 4 } } },
  timeline: { doc: "Moments in order.", fields: { title: TITLE, items: { kind: "list", of: { when: text(24, true), what: text(160, true) }, min: 2, max: 12 } } },
  process: { doc: "How the work is done, in two to six steps.", fields: { title: TITLE, steps: { kind: "list", of: { title: text(60, true), body: text(240) }, min: 2, max: 6 } } },
  logos: { doc: "Who it was for. Names are always text; a mark is optional.", fields: { title: TITLE, items: { kind: "list", of: { name: text(60, true), src: { kind: "media" } }, min: 2, max: 24 } } },
  quote: { doc: "Someone else's words, attributed.", fields: { text: text(400, true), by: text(80, true), role: text(80) } },
  offer: { doc: "What can be bought or booked, and for how much.", fields: { title: TITLE, items: { kind: "list", of: { name: text(60, true), price: text(40), body: text(240), href: { kind: "href" } }, min: 1, max: 4 } } },
  faq: { doc: "Questions people actually ask.", fields: { title: TITLE, items: { kind: "list", of: { q: text(160, true), a: text(600, true) }, min: 1, max: 12 } } },
  contact: { doc: "The one next act: how to reach the real person.", fields: { title: TITLE, body: BODY, actions: { kind: "list", of: { label: text(40, true), href: { kind: "href", required: true } }, min: 1, max: 3 } } },
  signature: { doc: "The one block only this brand has. Its renderer is the brand's; without one it shows as a statement.", fields: { title: TITLE, body: BODY, media: { kind: "media" }, variant: text(40) } },
  // Product flows (wave 5): quiz, booking, calculator, chart, places, podcast (FLOW_BLOCKS, above).
  ...FLOW_BLOCKS,
}

export const BLOCK_NAMES = Object.keys(BLOCKS)

/** The ways a route can arrive (createTransitions in @aleeforoughi/feather-expression). */
export const ROUTE_VARIANTS = ["none", "fade", "view", "push", "slide", "sheets", "circle", "columns"] as const

const LINK: Fields = { label: text(40, true), href: { kind: "href", required: true } }

/**
 * The page edges (feather.page/1): the chrome around the sections, which the 2026 award winners finish as carefully
 * as the page itself (Qooler file 27 sections 6 and 7: page transitions, loaders, the overlay menu, the footer and the
 * 404 are their most named moves). Each is a top-level field of the page, never a section, so the Living Page's
 * block library stays the same.
 */
export const EDGES: Record<string, { fields: Fields; doc: string }> = {
  nav: { doc: "The overlay menu: a minimal bar whose Menu opens a full-screen list of large links.", fields: { brand: text(60), label: text(40), items: { kind: "list", of: LINK, min: 1, max: 8 } } },
  footer: {
    doc: "The last scene. plain: links and a note. wordmark: the name set as large as the width allows. reveal: the footer waits behind the page and is uncovered as it ends.",
    fields: { variant: { kind: "enum", values: ["plain", "wordmark", "reveal"] }, wordmark: text(40), body: text(240), links: { kind: "list", of: LINK, max: 12 }, note: text(160) },
  },
  notFound: {
    doc: "The 404, as a small scene with a clear way home. type: the number as display type. minimal: the words alone.",
    fields: { variant: { kind: "enum", values: ["type", "minimal"] }, title: text(120), body: BODY, home: { kind: "list", of: LINK, max: 1 } },
  },
  loader: {
    doc: "Arrival. counter: an honest percentage that lifts off. dock: a bar that fills and becomes the header. Never shown without script or under reduced motion.",
    fields: { variant: { kind: "enum", values: ["counter", "dock"] }, label: text(80), sound: { kind: "boolean" } },
  },
  sound: { doc: "One ambient bed, off until the person turns it on; the toggle sits in the nav.", fields: { bed: { kind: "media", required: true } } },
}

// ---- The knobs (feather.page/1, wave 2; docs/proposals/2026-11-24-range.md sections 3.3, 4 and 5) ---------------
// Every knob is an enum or a bounded number with one documented meaning. They are additive: a /0 page renders as it
// did, and a knob on a /0 page is `needs-schema-1`. Knobs compose and never fight: contradictions are errors.

/** Loudness 0 quiet, 1 composed, 2 expressive, 3 spectacle (section 3.3). On the page (its default) and on a block. */
export const LOUDNESS = [0, 1, 2, 3] as const
/** The block's ground. inverse flips the semantic inks onto the inverse surface; block-1..4 are the brand's colour
 * blocks (feather-tokens/4 `--block-N` and `--block-N-ink`; before /4 they fall back to the inverse pair). */
export const TONES = ["base", "subtle", "raised", "inverse", "block-1", "block-2", "block-3", "block-4"] as const
/** The section's vertical rhythm (Section space). */
export const SPACES = ["s", "m", "l", "xl"] as const
/** The display size step of the block's title. */
export const SCALES = ["s", "m", "l", "xl"] as const
/** How media meets the page edge: none (inside the grid, rounded), edge (runs off one side), bleed (edge to edge). */
export const CROPS = ["none", "edge", "bleed"] as const
/** How the block's content sits on the grid: start, center, offset (set off-axis, from column 4 of 12), split (the
 * title beside the content). Each block takes the ones that make sense for it (BLOCK_RANGE). */
export const ALIGNS = ["start", "center", "offset", "split"] as const
/** How the block enters. none: it is simply there. fade: the block fades in. rise: the house reveal (the default).
 * mask, skew, oval, blink, scramble: the title's kinetic effect (DisplayTitle), which needs loudness 2. */
export const ENTERS = ["none", "fade", "rise", "mask", "skew", "oval", "blink", "scramble"] as const
export const KINETIC_ENTERS = ["mask", "skew", "oval", "blink", "scramble"] as const
/** Which way a reveal travels (up, down), or a marquee runs (left, right). */
export const DIRECTIONS = ["up", "down", "left", "right"] as const
/** The stagger between pieces, always inside the 1.2s sequence cap. */
export const STAGGERS = ["none", "tight", "default", "loose"] as const
/** The block's scroll move. reveal: it rises in (needs loudness 1). parallax, stack, horizontal, scale, pin: scroll
 * choreography (ScrollLayers and Stage), which needs loudness 2. */
export const SCROLL_PATTERNS = ["reveal", "parallax", "stack", "horizontal", "scale", "pin"] as const
/** The patterns that pin the block while it scrubs: they take `length`. Only `pin` takes `snap`. */
export const PINNED_PATTERNS = ["horizontal", "scale", "pin"] as const

/** What a 3D or WebGL scene is (feather-scene, wave 4). shader: a full-screen field (raw WebGL). particles: points that
 * drift, yield to the pointer or morph (Three.js). depth: the block's photo given depth by its depth map (raw WebGL).
 * model: a GLB product to turn and inspect, with hotspots and variants (Three.js). rail: a camera flight that scroll
 * drives (Three.js). A scene is decoration over the block's poster: it needs loudness 3, and the poster (the block's
 * media, or a field in the theme's colours) is what every device the scene does not run on keeps. */
export const SCENE_KINDS = ["shader", "particles", "depth", "model", "rail"] as const
/** The presets each kind takes (the first is its default); depth, model and rail have none. */
export const SCENE_PRESETS: Record<(typeof SCENE_KINDS)[number], readonly string[]> = {
  shader: ["gradient-noise", "aurora", "grain-field", "flow"],
  particles: ["dust", "field", "morph"],
  depth: [],
  model: [],
  rail: [],
}
/** The kinds that load Three.js (a separate chunk, fetched only where the scene runs); shader and depth are raw WebGL. */
export const THREE_SCENES = ["particles", "model", "rail"] as const
/** The quality a scene may reach. auto: the capability gate and the device decide. high, medium, low: a ceiling under
 * what the device allows (the gate still runs). poster: the poster alone, everywhere. */
export const SCENE_QUALITIES = ["auto", "high", "medium", "low", "poster"] as const
/** The blocks that take a scene: the hero (its interactive variant), the case and the signature. */
export const SCENE_BLOCKS = ["hero", "case", "signature"] as const

const SLUG = text(40, true)
export const SCENE_FIELD: FieldSpec = {
  kind: "object",
  of: {
    kind: { kind: "enum", values: SCENE_KINDS, required: true },
    preset: { kind: "enum", values: [...new Set(Object.values(SCENE_PRESETS).flat())], code: "unknown-variant" },
    quality: { kind: "enum", values: SCENE_QUALITIES },
    model: { kind: "media" },
    depth: { kind: "media" },
    hotspots: { kind: "list", of: { id: SLUG, position: { kind: "vector", length: 3, min: -100, max: 100, required: true }, label: text(60, true) }, min: 1, max: 8 },
    variants: { kind: "list", of: { id: SLUG, label: text(40, true), colors: { kind: "map", key: "a material name", max: 12, value: 60, required: true } }, min: 2, max: 6 },
  },
}

/** The knob fields every block takes in /1. `variant` is set per block from BLOCK_RANGE. */
export const KNOB_FIELDS: Fields = {
  loudness: { kind: "number", min: 0, max: 3, integer: true },
  tone: { kind: "enum", values: TONES },
  space: { kind: "enum", values: SPACES },
  align: { kind: "enum", values: ALIGNS },
  scale: { kind: "enum", values: SCALES },
  crop: { kind: "enum", values: CROPS },
  motion: {
    kind: "object",
    of: {
      enter: { kind: "enum", values: ENTERS },
      intensity: { kind: "number", min: 0, max: 1 },
      direction: { kind: "enum", values: DIRECTIONS },
      stagger: { kind: "enum", values: STAGGERS },
    },
  },
  scroll: {
    kind: "object",
    of: {
      pattern: { kind: "enum", values: SCROLL_PATTERNS },
      length: { kind: "number", min: 1, max: 4 },
      snap: { kind: "boolean" },
    },
  },
}

export interface BlockRange {
  /** The block's named variants; the first is today's rendering (the default). null: free text (the brand's own). */
  variants: readonly string[] | null
  /** The aligns the block takes (start is always one). */
  aligns: readonly (typeof ALIGNS)[number][]
  /** The scroll patterns the block supports (reveal always). */
  scroll: readonly (typeof SCROLL_PATTERNS)[number][]
  /** Whether the block has media that `crop` applies to, and a display title that `scale` sizes. */
  crop: boolean
  scale: boolean
  /** The scroll pattern a variant is built on: another non-reveal pattern on it contradicts it. */
  implies?: Record<string, (typeof SCROLL_PATTERNS)[number]>
  /** Variants that need media. */
  needsMedia?: readonly string[]
  /** Variants that run a marquee: the only ones where motion.direction may be left or right. */
  sideways?: readonly string[]
  /** Fields the block gains in /1. */
  fields?: Fields
}

const LINKS2: FieldSpec & { required?: boolean } = { kind: "list", of: { label: text(40, true), href: { kind: "href", required: true } }, min: 1, max: 2 }
const FACTS: FieldSpec & { required?: boolean } = { kind: "list", of: { label: text(40, true), value: text(60, true) }, max: 6 }

/** Every block's variants and the knobs that apply to it. */
export const BLOCK_RANGE: Record<string, BlockRange> = {
  hero: {
    variants: ["stacked", "giant-type", "split", "film", "product", "index", "interactive"],
    aligns: ["start", "center", "offset"],
    scroll: ["reveal", "parallax", "scale"],
    crop: true,
    scale: true,
    needsMedia: ["split", "film", "product"],
    fields: { facts: FACTS, actions: LINKS2 },
  },
  statement: {
    variants: ["plain", "centred", "offset", "marquee", "fill", "swap"],
    // The variants carry the statement's placement (centred, offset), so it takes no align of its own.
    aligns: ["start"],
    scroll: ["reveal"],
    crop: false,
    scale: true,
    sideways: ["marquee"],
    fields: { words: { kind: "texts", min: 2, max: 6 } },
  },
  work: { variants: ["grid", "hover-list", "stack", "rail"], aligns: ["start", "split"], scroll: ["reveal", "stack", "horizontal"], crop: false, scale: true, implies: { stack: "stack", rail: "horizontal" } },
  case: { variants: ["editorial", "scale"], aligns: ["start", "center"], scroll: ["reveal", "parallax", "scale"], crop: true, scale: true, implies: { scale: "scale" }, needsMedia: ["scale"] },
  numbers: { variants: ["counter", "plain", "lead"], aligns: ["start", "center", "split"], scroll: ["reveal"], crop: false, scale: true },
  timeline: { variants: ["list", "horizontal"], aligns: ["start", "split"], scroll: ["reveal"], crop: false, scale: true },
  process: { variants: ["list", "pinned", "rows"], aligns: ["start", "split"], scroll: ["reveal", "pin"], crop: false, scale: true, implies: { pinned: "pin" } },
  logos: { variants: ["grid", "marquee"], aligns: ["start", "center"], scroll: ["reveal"], crop: false, scale: true, sideways: ["marquee"] },
  quote: { variants: ["large", "rail", "pull"], aligns: ["start", "center", "offset"], scroll: ["reveal"], crop: false, scale: true, fields: { items: { kind: "list", of: { text: text(400, true), by: text(80, true), role: text(80) }, min: 1, max: 8 } } },
  offer: { variants: ["cards", "table"], aligns: ["start", "split"], scroll: ["reveal"], crop: false, scale: true },
  faq: { variants: ["list"], aligns: ["start", "split"], scroll: ["reveal"], crop: false, scale: true },
  contact: { variants: ["plain"], aligns: ["start", "center", "offset"], scroll: ["reveal"], crop: false, scale: true },
  signature: { variants: null, aligns: ["start", "center"], scroll: ["reveal", "parallax"], crop: true, scale: true },
  // Product flows (wave 5, FLOW_RANGE above).
  ...FLOW_RANGE,
}

/** Page-level knobs (feather.page/1): the page's loudness, and defaults a block takes when it sets none. A default
 * align or crop a block does not take is ignored for that block. */
export const PAGE_KNOBS: Fields = {
  loudness: { kind: "number", min: 0, max: 3, integer: true },
  defaults: { kind: "object", of: { space: { kind: "enum", values: SPACES }, align: { kind: "enum", values: ALIGNS }, scale: { kind: "enum", values: SCALES }, crop: { kind: "enum", values: CROPS } } },
  /** The pointer: the native cursor alone (default), or a follower that grows and labels what it is over (work items
   * say View). The native cursor always stays; the follower is off on touch, under reduced motion and below loudness 2. */
  cursor: { kind: "enum", values: ["native", "follower"] },
  // The colour scheme toggle (wave 5, FLOW_PAGE_KNOBS above).
  ...FLOW_PAGE_KNOBS,
}

/** A block's fields in a schema version: /0 is the table above; /1 adds the knobs and the block's /1 fields. */
export function blockFields(name: string, version: 0 | 1): Fields {
  const spec = BLOCKS[name]
  const base: Fields = { title: { kind: "text", max: 160 }, ...spec.fields }
  if (version === 0) return base
  const range = BLOCK_RANGE[name]
  const variant: Fields = range.variants ? { variant: { kind: "enum", values: range.variants, code: "unknown-variant" } } : {}
  const scene: Fields = (SCENE_BLOCKS as readonly string[]).includes(name) ? { scene: SCENE_FIELD } : {}
  const views: Fields = (VIEW_BLOCKS as readonly string[]).includes(name) ? { views: VIEWS_FIELD } : {}
  return { ...base, ...range.fields, ...variant, ...KNOB_FIELDS, ...scene, ...views }
}

/** Top-level fields. */
export const SPEAKER_KINDS = ["person", "company", "product"] as const
export const ANCHORS = ["reader", "end"] as const
