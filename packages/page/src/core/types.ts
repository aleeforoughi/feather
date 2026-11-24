// The feather.page/0 document, as TypeScript. Mirrors spec.ts by hand (the validator is the authority).

export type Media = string | { src: string; alt?: string; poster?: string; sources?: { src: string; type: string }[]; decorative?: boolean }

export interface WorkItem {
  id: string
  title: string
  summary?: string
  media?: Media
  href?: string
  year?: string
  role?: string
}

interface Base {
  id?: string
  title?: string
}
export type PageBlock =
  | (Base & { block: "hero"; title: string; eyebrow?: string; lede?: string; media?: Media; starters?: string[] })
  | (Base & { block: "statement"; title: string; body?: string })
  | (Base & { block: "work"; items: Array<string | WorkItem> })
  | (Base & { block: "case"; title: string; body?: string; media?: Media; facts?: { label: string; value: string }[] })
  | (Base & { block: "numbers"; items: { value: number; unit?: string; label: string }[] })
  | (Base & { block: "timeline"; items: { when: string; what: string }[] })
  | (Base & { block: "process"; steps: { title: string; body?: string }[] })
  | (Base & { block: "logos"; items: { name: string; src?: Media }[] })
  | (Base & { block: "quote"; text: string; by: string; role?: string })
  | (Base & { block: "offer"; items: { name: string; price?: string; body?: string; href?: string }[] })
  | (Base & { block: "faq"; items: { q: string; a: string }[] })
  | (Base & { block: "contact"; body?: string; actions?: { label: string; href: string }[] })
  | (Base & { block: "signature"; body?: string; media?: Media; variant?: string })

export type BlockName = PageBlock["block"]

export interface Scene {
  /** The starter label, in the visitor's words. */
  ask: string
  /** The spoken line, in the speaker's voice. */
  line: string
  blocks: PageBlock[]
  asks?: string[]
}

export interface PageLink {
  label: string
  href: string
}

/** The page edges (feather.page/1). */
export interface NavEdge {
  /** The wordmark in the bar (default the page title). */
  brand?: string
  /** The landmark's name (default "Site"). */
  label?: string
  items: PageLink[]
}
export interface FooterEdge {
  variant?: "plain" | "wordmark" | "reveal"
  wordmark?: string
  body?: string
  links?: PageLink[]
  note?: string
}
export interface NotFoundEdge {
  variant?: "type" | "minimal"
  title?: string
  body?: string
  /** At most one link; default the site root. */
  home?: PageLink[]
}
export interface LoaderEdge {
  variant?: "counter" | "dock"
  label?: string
  sound?: boolean
}
export type RouteVariant = "none" | "fade" | "view" | "push" | "columns"

export interface PageDocument {
  schema: "feather.page/0" | "feather.page/1"
  /** A path to the brand's feather-tokens file, or the tokens inline. */
  brand: string | Record<string, unknown>
  title?: string
  description?: string
  lang?: string
  speaker?: { kind: "person" | "company" | "product"; name: string; voice?: string }
  library?: { work?: Record<string, Omit<WorkItem, "id">> }
  sections: PageBlock[]
  scenes?: Record<string, Scene>
  living?: { anchor?: "reader" | "end"; fold?: boolean; prepared?: string[]; disclosure?: string }
  nav?: NavEdge
  footer?: FooterEdge
  notFound?: NotFoundEdge
  loader?: LoaderEdge
  /** How a route arrives (default "fade"). */
  transition?: RouteVariant
  sound?: { bed: Media }
}

export interface PageIssue {
  /** A JSON pointer into the document. */
  path: string
  code: "wrong-schema" | "needs-schema-1" | "not-object" | "missing" | "type" | "too-long" | "unknown-block" | "unknown-field" | "too-few" | "too-many" | "bad-href" | "bad-media" | "unknown-ref" | "unknown-scene" | "duplicate-id" | "no-speaker"
  message: string
}

export type PageResult = { ok: true; page: PageDocument } | { ok: false; issues: PageIssue[] }
