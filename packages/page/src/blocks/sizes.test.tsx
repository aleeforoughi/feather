// srcset and the sizes Feather derives: every block and variant that takes media writes its image's widths with the
// sizes of where it sits (MEDIA_SIZES), the LCP keeps its high priority, and media without a srcset is unchanged.
import { act, render } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { validatePage } from "../core/validate"
import type { Media, PageDocument } from "../core/types"
import { FeatherPage } from "../render"
import { BLOCKS, GALLERY, PLACEHOLDER, WORK } from "./fixtures"
import { GalleryBlock } from "./gallery"
import { mediaProps, srcsetOf } from "./media"
import { MEDIA_SIZES, contentSizes, sizesOf, type MediaPlace } from "./sizes"

const WIDTHS = [
  { src: "/m/a-800.jpg", w: 800 },
  { src: "/m/a-1600.jpg", w: 1600 },
  { src: "/m/a-2400.jpg", w: 2400 },
]
const SRCSET = "/m/a-800.jpg 800w, /m/a-1600.jpg 1600w, /m/a-2400.jpg 2400w"
const wide = (m: Media | undefined, alt = "A picture"): Media => ({ ...(typeof m === "object" ? m : { src: m ?? "/m/a.jpg" }), alt, srcset: WIDTHS })
const work = WORK.map((w) => ({ ...w, media: wide(w.media) }))

function page(sections: unknown[], extra: Record<string, unknown> = {}): PageDocument {
  const r = validatePage({ schema: "feather.page/1", brand: "b.json", title: "Sizes", sections, ...extra })
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}: ${i.message}`).join("\n"))
  return r.page
}
const parse = (html: string) => {
  const doc = document.implementation.createHTMLDocument("t")
  doc.body.innerHTML = html
  return doc
}
/** The first image the block draws with a srcset. */
function image(block: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const hero = block.block === "hero" ? [] : [{ block: "hero", title: "Hello" }]
  const doc = parse(renderToStaticMarkup(<FeatherPage page={page([...hero, block], extra)} />))
  const img = doc.querySelector(`[data-block="${block.block}"] img[srcset]`)
  if (!img) throw new Error(`${block.block} ${String(block.variant)}: no image with a srcset`)
  return img
}

type Case = [name: string, block: Record<string, unknown>, place: MediaPlace, extra?: Record<string, unknown>]
const hero = (variant: string, more: Record<string, unknown> = {}) => ({ ...BLOCKS.hero, variant, media: wide(PLACEHOLDER.src), ...more })
const CASES: Case[] = [
  ["hero stacked", hero("stacked"), "hero.stacked"],
  ["hero stacked, bleed", hero("stacked", { crop: "bleed" }), "hero.stacked.crop"],
  ["hero giant-type", hero("giant-type"), "hero.giant-type"],
  ["hero giant-type, edge", hero("giant-type", { crop: "edge" }), "hero.giant-type.crop"],
  ["hero split", hero("split"), "hero.split"],
  ["hero split, edge", hero("split", { crop: "edge" }), "hero.split.crop"],
  ["hero film", hero("film"), "hero.film"],
  ["hero product", hero("product"), "hero.product"],
  ["hero interactive", hero("interactive", { scene: { kind: "shader" } }), "hero.interactive", { loudness: 3 }],
  ["case editorial", { ...BLOCKS.case, media: wide(PLACEHOLDER.src) }, "case.editorial"],
  ["case editorial, bleed", { ...BLOCKS.case, media: wide(PLACEHOLDER.src), crop: "bleed" }, "case.editorial.crop"],
  ["case scale", { ...BLOCKS.case, variant: "scale", media: wide(PLACEHOLDER.src) }, "case.scale"],
  ["signature", { ...BLOCKS.signature, media: wide(PLACEHOLDER.src) }, "signature.default"],
  ["signature, bleed", { ...BLOCKS.signature, media: wide(PLACEHOLDER.src), crop: "bleed" }, "signature.default.crop"],
  ["work grid, three", { ...BLOCKS.work, items: work }, "work.grid.3"],
  ["work grid, two", { ...BLOCKS.work, variant: "grid", items: work.slice(0, 2) }, "work.grid.2"],
  ["work stack", { ...BLOCKS.work, variant: "stack", items: work }, "work.stack"],
  ["work rail", { ...BLOCKS.work, variant: "rail", items: work }, "work.rail"],
  ["work bento", { ...BLOCKS.work, variant: "bento", items: work }, "work.bento.lead"],
  ["work fullscreen-cases", { ...BLOCKS.work, variant: "fullscreen-cases", items: work }, "work.fullscreen-cases"],
  ["work hover-list", { ...BLOCKS.work, variant: "hover-list", items: work }, "work.hover-list.part"],
  ...(["rail", "masonry", "grid", "hover-list"] as const).map((v): Case => [`gallery ${v}`, { ...BLOCKS.gallery, variant: v, items: GALLERY.map((g) => ({ ...g, media: wide(g.media.src, g.media.alt) })) }, v === "hover-list" ? "gallery.hover-list.part" : `gallery.${v}`]),
  // The wheel is the rail until the script has read the loudness (below), so the server writes the rail's sizes.
  ["gallery wheel, on the server", { ...BLOCKS.gallery, variant: "wheel", items: GALLERY.map((g) => ({ ...g, media: wide(g.media.src, g.media.alt) })) }, "gallery.rail"],
  ["comparison", { ...BLOCKS.comparison, before: wide("/m/b.jpg", "Before"), after: wide("/m/c.jpg", "After") }, "comparison.slider"],
  ["comparison, bleed", { ...BLOCKS.comparison, before: wide("/m/b.jpg", "Before"), after: wide("/m/c.jpg", "After"), crop: "bleed" }, "comparison.slider.crop"],
  ["story pinned", { ...BLOCKS.story, steps: BLOCKS.story.steps.map((s) => ({ ...s, media: wide(s.media) })) }, "story.pinned"],
  ["story stacked", { ...BLOCKS.story, variant: "stacked", steps: BLOCKS.story.steps.map((s) => ({ ...s, media: wide(s.media) })) }, "story.stacked"],
  ["journal featured", { ...BLOCKS.journal, variant: "featured", items: BLOCKS.journal.items.map((e) => ({ ...e, media: wide(e.media) })) }, "journal.featured"],
  ["places map", { ...BLOCKS.places, variant: "map", media: wide(PLACEHOLDER.src, "A map") }, "places.map"],
  ["places map, split", { ...BLOCKS.places, variant: "map", align: "split", media: wide(PLACEHOLDER.src, "A map") }, "places.map.split"],
  ["work views, list", { ...BLOCKS.work, views: "list", items: work }, "work.views-list.part"],
  ["work views, grid", { ...BLOCKS.work, views: "grid", items: work }, "work.grid.3"],
  ["journal list", { ...BLOCKS.journal, items: BLOCKS.journal.items.map((e) => ({ ...e, media: wide(e.media) })) }, "journal.list.part"],
]

describe("sizes, by block and variant", () => {
  it.each(CASES)("%s", (_name, block, place, extra) => {
    const img = image(block, extra)
    expect(img.getAttribute("srcset")).toBe(SRCSET)
    expect(img.getAttribute("sizes")).toBe(MEDIA_SIZES[place])
  })

  it("every place in the table is used by a case", () => {
    const used = new Set([...CASES.map(([, , place]) => place), "gallery.wheel", "work.bento.half", "work.bento.third", "work.bento.full"])
    expect(Object.keys(MEDIA_SIZES).filter((k) => !used.has(k as MediaPlace))).toEqual([])
  })

  it("the wheel's frames take the wheel's sizes once it turns", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
    const { container } = render(<GalleryBlock block={{ ...BLOCKS.gallery, variant: "wheel", items: GALLERY.map((g) => ({ ...g, media: wide(g.media.src, g.media.alt) })) }} />)
    await act(async () => {})
    expect(container.querySelector('[data-slot="gallery-wheel-ring"] img')?.getAttribute("sizes")).toBe(MEDIA_SIZES["gallery.wheel"])
  })
})
afterEach(() => vi.unstubAllGlobals())

describe("srcset", () => {
  it("the LCP image keeps its high priority, with its widths", () => {
    const img = image(hero("split"))
    expect(img.getAttribute("fetchpriority")).toBe("high")
    expect(img.getAttribute("loading")).toBe("eager")
  })

  it("a srcset string is written as it is; picture sources take their own widths and the same sizes", () => {
    const doc = parse(renderToStaticMarkup(<FeatherPage page={page([hero("split", { media: { src: "/m/a.jpg", alt: "A", srcset: "/m/a-800.jpg 800w, /m/a-1600.jpg 1600w", sources: [{ src: "/m/a.avif", type: "image/avif", srcset: [{ src: "/m/a-800.avif", w: 800 }, { src: "/m/a-1600.avif", w: 1600 }] }] } })])} />))
    const source = doc.querySelector("picture source")!
    expect(source.getAttribute("srcset")).toBe("/m/a-800.avif 800w, /m/a-1600.avif 1600w")
    expect(source.getAttribute("sizes")).toBe(MEDIA_SIZES["hero.split"])
    expect(doc.querySelector("picture img")?.getAttribute("srcset")).toBe("/m/a-800.jpg 800w, /m/a-1600.jpg 1600w")
  })

  it("without a srcset nothing changes: no srcset and no sizes", () => {
    const doc = parse(renderToStaticMarkup(<FeatherPage page={page([{ ...BLOCKS.hero, variant: "split", media: PLACEHOLDER }])} />))
    const img = doc.querySelector("img")!
    expect(img.hasAttribute("srcset")).toBe(false)
    expect(img.hasAttribute("sizes")).toBe(false)
    expect(mediaProps(PLACEHOLDER, undefined, MEDIA_SIZES["hero.split"])).toEqual({ src: PLACEHOLDER.src, alt: PLACEHOLDER.alt, decorative: false })
  })

  it("is written as the attribute reads, and a video's srcset is its poster's (never on the video)", () => {
    expect(srcsetOf(WIDTHS)).toBe(SRCSET)
    expect(srcsetOf("  a.jpg 800w ")).toBe("a.jpg 800w")
    const video = mediaProps({ src: "reel.mp4", alt: "Reel", poster: "p.jpg", srcset: WIDTHS }, undefined, "100vw")
    expect(video.srcSet).toBeUndefined()
    expect(video.sizes).toBeUndefined()
    const doc = parse(renderToStaticMarkup(<FeatherPage page={page([hero("film", { media: { src: "reel.mp4", alt: "Reel", poster: "/m/p.jpg", srcset: WIDTHS } })])} />))
    expect(doc.querySelector('[data-slot="hero-film-poster"]')?.getAttribute("srcset")).toBe(SRCSET)
  })

  it("sizes follow the page grid: the content's width at each breakpoint, capped at 1344px", () => {
    expect(contentSizes({ base: 1 })).toBe("(min-width: 1440px) 1344px, (min-width: 1024px) calc(100vw - 4rem), (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)")
    expect(contentSizes({ base: 1, lg: 0.5 })).toBe("(min-width: 1440px) 672px, (min-width: 1024px) calc((100vw - 4rem) * 0.5), (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)")
    expect(sizesOf("hero.split", true)).toBe("(min-width: 1024px) 50vw, 100vw")
    expect(sizesOf("hero.film", true)).toBe("100vw")
  })
})

describe("srcset validates", () => {
  const issues = (media: unknown, schema = "feather.page/1") => {
    const r = validatePage({ schema, brand: "b.json", sections: [{ block: "hero", title: "T", media }] })
    return r.ok ? [] : r.issues.map((i) => `${i.path} ${i.code}`)
  }
  it("as a list of { src, w } or a srcset string", () => {
    expect(issues({ src: "a.jpg", alt: "A", srcset: WIDTHS })).toEqual([])
    expect(issues({ src: "a.jpg", alt: "A", srcset: SRCSET })).toEqual([])
    expect(issues({ src: "a.avif", alt: "A", sources: [{ src: "a.avif", type: "image/avif", srcset: SRCSET }] })).toEqual([])
  })

  it("refuses a malformed entry with bad-srcset, and holds 1 to 8", () => {
    expect(issues({ src: "a.jpg", alt: "A", srcset: [{ src: "a.jpg", w: 0 }, { src: "javascript:x", w: 800 }, { src: "b.jpg", w: 1.5 }, { src: "c.jpg" }] })).toEqual([
      "/sections/0/media/srcset/0/w bad-srcset",
      "/sections/0/media/srcset/1/src bad-srcset",
      "/sections/0/media/srcset/2/w bad-srcset",
      "/sections/0/media/srcset/3/w bad-srcset",
    ])
    expect(issues({ src: "a.jpg", alt: "A", srcset: [{ src: "a.jpg", w: 800 }, { src: "b.jpg", w: 800 }] })).toEqual(["/sections/0/media/srcset/1/w bad-srcset"])
    expect(issues({ src: "a.jpg", alt: "A", srcset: "a.jpg 800w, b.jpg 2x" })).toEqual(["/sections/0/media/srcset bad-srcset"])
    expect(issues({ src: "a.jpg", alt: "A", srcset: "a.jpg" })).toEqual(["/sections/0/media/srcset bad-srcset"])
    expect(issues({ src: "a.jpg", alt: "A", srcset: [] })).toEqual(["/sections/0/media/srcset too-few"])
    expect(issues({ src: "a.jpg", alt: "A", srcset: Array.from({ length: 9 }, (_, i) => ({ src: `a${i}.jpg`, w: 100 * (i + 1) })) })).toEqual(["/sections/0/media/srcset too-many"])
    expect(issues({ src: "a.jpg", alt: "A", srcset: 800 })).toEqual(["/sections/0/media/srcset type"])
    expect(issues({ src: "a.avif", alt: "A", sources: [{ src: "a.avif", type: "image/avif", srcset: "nope" }] })).toEqual(["/sections/0/media/sources/0/srcset bad-srcset"])
  })

  it("is feather.page/1's", () => {
    expect(issues({ src: "a.jpg", alt: "A", srcset: WIDTHS }, "feather.page/0")).toEqual(["/sections/0/media/srcset needs-schema-1"])
  })
})
