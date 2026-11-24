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
  | { kind: "number" }
  | { kind: "boolean" }
  /** One of a fixed set of names (a variant). */
  | { kind: "enum"; values: readonly string[] }
  | { kind: "media" }
  | { kind: "href" }
  | { kind: "texts"; min?: number; max?: number }
  | { kind: "list"; of: Record<string, FieldSpec & { required?: boolean }>; min?: number; max?: number; ids?: boolean }
  /** A list of library ids (strings) or inline items of the given shape. */
  | { kind: "refs"; library: string; of: Record<string, FieldSpec & { required?: boolean }>; min?: number; max?: number }

export type Fields = Record<string, FieldSpec & { required?: boolean }>

const text = (max?: number, required = false) => ({ kind: "text" as const, ...(max ? { max } : {}), ...(required ? { required } : {}) })
const TITLE = text(120)
const BODY = text(600)

const WORK_ITEM: Fields = { id: text(60, true), title: text(120, true), summary: BODY, media: { kind: "media" }, href: { kind: "href" }, year: text(12), role: text(80) }

/** Every block kind and its fields. `id` and `title` are allowed on every block. */
export const BLOCKS: Record<string, { fields: Fields; doc: string }> = {
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
}

export const BLOCK_NAMES = Object.keys(BLOCKS)

/** The ways a route can arrive (createTransitions in @aleeforoughi/feather-expression). */
export const ROUTE_VARIANTS = ["none", "fade", "view", "push", "columns"] as const

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

/** Top-level fields. */
export const SPEAKER_KINDS = ["person", "company", "product"] as const
export const ANCHORS = ["reader", "end"] as const
