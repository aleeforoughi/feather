// How wide each block draws its images, as the `sizes` an image with a srcset takes. Feather derives it from where the
// image sits (the block, its variant, its crop and the page grid), never from the caller: one table, so the browser
// picks the smallest rendition that fills the frame (a 358px phone frame takes the 800w file, not the 2400w one).
//
// The page grid (foundation.css): the content is the viewport less its margins (1rem a side under 640px, 1.5rem to
// 1024px, 2rem to 1440px), capped at --layout-max (90rem, 1440px) less 3rem a side from 1440px: 1344px at most. The
// breakpoints are Tailwind's (sm 640px, md 768px, lg 1024px). Gutters are left in: a slight overestimate, never a
// blurry image.

/** The share of the content width an image takes at each breakpoint (from that breakpoint up). */
export interface Share {
  base: number
  sm?: number
  md?: number
  lg?: number
}

const CONTENT_MAX = 1344
const round = (n: number) => Math.round(n * 10000) / 10000
const part = (share: number, width: string) => (share === 1 ? `calc(${width})` : `calc((${width}) * ${round(share)})`)

/** The sizes of an image that takes `share` of the page grid's content width. */
export function contentSizes(share: Share): string {
  const lg = share.lg ?? share.md ?? share.sm ?? share.base
  const md = share.md ?? share.sm ?? share.base
  const sm = share.sm ?? share.base
  return [
    `(min-width: 1440px) ${Math.round(CONTENT_MAX * lg)}px`,
    `(min-width: 1024px) ${part(lg, "100vw - 4rem")}`,
    ...(share.md !== undefined ? [`(min-width: 768px) ${part(md, "100vw - 3rem")}`] : []),
    `(min-width: 640px) ${part(sm, "100vw - 3rem")}`,
    part(share.base, "100vw - 2rem"),
  ].join(", ")
}

const FULL = "100vw"
/** A fixed frame: 20rem, 24rem from sm (w-xs sm:w-sm). */
const CARD = "(min-width: 640px) 24rem, 20rem"

/**
 * Every place a block draws an image, and its sizes. The key is `block.variant`, with `.crop` where an edge or bleed
 * crop changes it, or `.part` for a secondary frame.
 */
export const MEDIA_SIZES = {
  // hero: stacked and giant-type draw the media across the grid; edge or bleed (and the scale move) take the viewport.
  "hero.stacked": contentSizes({ base: 1 }),
  "hero.stacked.crop": FULL,
  "hero.giant-type": contentSizes({ base: 1 }),
  "hero.giant-type.crop": FULL,
  "hero.split": contentSizes({ base: 1, lg: 0.5 }),
  "hero.split.crop": "(min-width: 1024px) 50vw, 100vw",
  "hero.film": FULL,
  "hero.product": contentSizes({ base: 1, lg: 0.5 }),
  "hero.interactive": FULL,
  // case: the media is the 7 of a 7:5 split (md), the 7 of 12 when cropped (lg), the viewport in the scale move.
  "case.editorial": contentSizes({ base: 1, md: 7 / 12 }),
  "case.editorial.crop": "(min-width: 1024px) 58vw, 100vw",
  "case.scale": FULL,
  "signature.default": contentSizes({ base: 1 }),
  "signature.default.crop": FULL,
  // work: grid cards by column count (two from md, three from lg), the stack's panel (7 of 12 from lg), the rail's
  // fixed cards, the bento's cells, a full screen per case, and the touch thumbnail of hover-list.
  "work.grid.2": contentSizes({ base: 1, md: 0.5 }),
  "work.grid.3": contentSizes({ base: 1, md: 0.5, lg: 1 / 3 }),
  "work.stack": contentSizes({ base: 1, lg: 7 / 12 }),
  "work.rail": CARD,
  "work.bento.lead": contentSizes({ base: 1, md: 8 / 12 }),
  "work.bento.half": contentSizes({ base: 1, md: 0.5 }),
  "work.bento.third": contentSizes({ base: 1, md: 4 / 12 }),
  "work.bento.full": contentSizes({ base: 1 }),
  "work.fullscreen-cases": FULL,
  "work.hover-list.part": "6rem",
  // gallery: the rail's and the wheel's fixed frames, masonry columns (two from sm, three from lg), the grid (two, three
  // from lg), the touch thumbnail of hover-list.
  "gallery.rail": CARD,
  "gallery.masonry": contentSizes({ base: 1, sm: 0.5, lg: 1 / 3 }),
  "gallery.grid": contentSizes({ base: 0.5, lg: 1 / 3 }),
  "gallery.hover-list.part": "6rem",
  "gallery.wheel": "20rem",
  "comparison.slider": contentSizes({ base: 1 }),
  "comparison.slider.crop": FULL,
  // story: the pinned picture fills the screen; stacked, it is half the row from md.
  "story.pinned": FULL,
  "story.stacked": contentSizes({ base: 1, md: 0.5 }),
  // journal: the featured entry's picture (half from lg) and a row's thumbnail (3 of 12, shown from md).
  "journal.featured": contentSizes({ base: 1, lg: 0.5 }),
  "journal.list.part": contentSizes({ base: 0.25, md: 0.25 }),
} as const

export type MediaPlace = keyof typeof MEDIA_SIZES

/** The sizes of one place, with its crop variant where the block is cropped (edge or bleed). */
export function sizesOf(place: MediaPlace, cropped = false): string {
  const crop = `${place}.crop` as MediaPlace
  return cropped && crop in MEDIA_SIZES ? MEDIA_SIZES[crop] : MEDIA_SIZES[place]
}
