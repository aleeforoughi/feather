// The block library of a Living Page (Qooler file 22 §3): a closed set, designed per brand. An answer is built only
// from these, in the page's own tokens, so a grown page looks designed that way from the start. A new kind of answer
// is a new block designed into the library, never a one-off.

export const BLOCK_KINDS = ["hero", "statement", "work", "case", "numbers", "timeline", "process", "logos", "quote", "offer", "faq", "contact", "signature", "quiz", "booking", "calculator", "chart", "places", "podcast"] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]

/** One block as data. Every block may carry an id (its anchor) and a display title; the rest is the block's own. */
export interface Block {
  block: BlockKind
  id?: string
  title?: string
  [field: string]: unknown
}

export const isBlockKind = (v: unknown): v is BlockKind => typeof v === "string" && (BLOCK_KINDS as readonly string[]).includes(v)
