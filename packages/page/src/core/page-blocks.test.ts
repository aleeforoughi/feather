// Wave 5 part A: the page blocks (gallery, comparison, story, testimonials, journal, form, showreel), the new variants
// (work fullscreen-cases and bento, offer toggle) and the treatment knob validate, and every contradiction has its code.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { BLOCK_KINDS } from "../../../living/src/core/blocks"
import { pageJsonSchema } from "../../scripts/json-schema"
import { BLOCK_NAMES, BLOCK_RANGE, PAGE_BLOCK_NAMES, TREATMENTS } from "./spec"
import { validatePage } from "./validate"

const hero = { block: "hero", title: "Hello" }
const page = (sections: unknown[], extra: Record<string, unknown> = {}) => ({ schema: "feather.page/1", brand: "b.json", sections: [hero, ...sections], ...extra })
const issues = (doc: unknown) => {
  const r = validatePage(doc)
  return r.ok ? [] : r.issues.map((i) => `${i.path} ${i.code}`)
}
const img = (alt = "A picture") => ({ src: "a.jpg", alt })
const gallery = (extra: Record<string, unknown> = {}) => ({ block: "gallery", items: [{ media: img("One") }, { media: img("Two") }, { media: img("Three") }], ...extra })
const form = (fields: unknown[], extra: Record<string, unknown> = {}) => ({ block: "form", action: "/contact", fields, ...extra })

describe("the page blocks", () => {
  it("are /1 blocks beside the Living Page's library, which stays as it was", () => {
    expect(BLOCK_NAMES).toEqual([...BLOCK_KINDS])
    expect(PAGE_BLOCK_NAMES).toEqual(["gallery", "comparison", "story", "testimonials", "journal", "form", "showreel"])
    for (const name of PAGE_BLOCK_NAMES) expect(BLOCK_RANGE[name].variants?.length, name).toBeGreaterThan(0)
  })

  it("need feather.page/1, and never stand in an answer", () => {
    expect(issues({ schema: "feather.page/0", brand: "b.json", sections: [hero, gallery()] })).toEqual(["/sections/1/block needs-schema-1"])
    expect(issues(page([], { scenes: { look: { ask: "Show me", line: "Here.", blocks: [gallery()] } } }))).toEqual(["/scenes/look/blocks/0/block unknown-block"])
  })

  it("take every one of their variants, and refuse others", () => {
    for (const variant of BLOCK_RANGE.gallery.variants!) expect(issues(page([gallery({ variant })])), variant).toEqual([])
    expect(issues(page([gallery({ variant: "carousel" })]))).toEqual(["/sections/1/variant unknown-variant"])
  })

  it("hold their bounds", () => {
    expect(issues(page([{ block: "gallery", items: [{ media: img() }] }]))).toEqual(["/sections/1/items too-few"])
    expect(issues(page([{ block: "comparison", before: img(), after: img(), start: 140 }]))).toEqual(["/sections/1/start out-of-range"])
    expect(issues(page([{ block: "story", steps: Array.from({ length: 7 }, (_, i) => ({ title: `S${i}`, media: "a.jpg" })) }]))).toEqual(["/sections/1/steps too-many"])
    expect(issues(page([form(Array.from({ length: 9 }, (_, i) => ({ name: `f${i}`, label: "F" })))]))).toEqual(["/sections/1/fields too-many"])
  })
})

describe("gallery", () => {
  it("loops only as a rail or a wheel", () => {
    expect(issues(page([gallery({ variant: "rail", loop: true }), gallery({ variant: "wheel", loop: true })]))).toEqual([])
    expect(issues(page([gallery({ variant: "grid", loop: true })]))).toEqual(["/sections/1/loop contradiction"])
  })

  it("treats every image as content: alt text, never decorative", () => {
    expect(issues(page([{ block: "gallery", items: [{ media: "a.jpg" }, { media: { src: "b.jpg", decorative: true } }] }]))).toEqual(["/sections/1/items/0/media missing", "/sections/1/items/1/media/decorative contradiction"])
  })
})

describe("comparison", () => {
  it("needs both pictures, each with its alt text", () => {
    expect(issues(page([{ block: "comparison", before: img() }]))).toEqual(["/sections/1/after missing"])
    expect(issues(page([{ block: "comparison", before: "a.jpg", after: img() }]))).toEqual(["/sections/1/before missing"])
  })
})

describe("journal", () => {
  it("writes its dates as YYYY-MM-DD", () => {
    expect(issues(page([{ block: "journal", items: [{ date: "2026/11/24", title: "A", href: "/a" }] }]))).toEqual(["/sections/1/items/0/date type"])
  })
})

describe("form", () => {
  it("posts to a URL or a path, or opens a mailto:", () => {
    for (const action of ["/contact", "https://example.com/hooks/form", "mailto:hello@example.com"]) expect(issues(page([form([{ name: "a", label: "A" }], { action })])), action).toEqual([])
    expect(issues(page([form([{ name: "a", label: "A" }], { action: "tel:+441234" })]))).toEqual(["/sections/1/action bad-href"])
    expect(issues(page([form([{ name: "a", label: "A" }], { action: "javascript:alert(1)" })]))).toEqual(["/sections/1/action bad-href"])
  })

  it("names its fields once each, as slugs", () => {
    expect(issues(page([form([{ name: "email", label: "A" }, { name: "email", label: "B" }, { name: "Your Name", label: "C" }])]))).toEqual(["/sections/1/fields/1/name duplicate-id", "/sections/1/fields/2/name type"])
  })

  it("gives a select and a choice their options, and only them", () => {
    expect(issues(page([form([{ name: "a", label: "A", type: "select" }, { name: "b", label: "B", options: ["x", "y"] }, { name: "c", label: "C", type: "choice", options: ["x", "y"], max: 4 }])]))).toEqual([
      "/sections/1/fields/0/options missing",
      "/sections/1/fields/1/options contradiction",
      "/sections/1/fields/2/max contradiction",
    ])
    expect(issues(page([form([{ name: "a", label: "A", type: "date" }])]))).toEqual(["/sections/1/fields/0/type type"])
  })
})

describe("showreel", () => {
  it("is a video with a poster, and a film with speech carries its captions", () => {
    expect(issues(page([{ block: "showreel", media: { src: "reel.mp4", alt: "Reel", poster: "reel.jpg" }, captions: "reel.vtt", speech: true }]))).toEqual([])
    expect(issues(page([{ block: "showreel", media: { src: "reel.jpg", alt: "Reel" } }]))).toEqual(["/sections/1/media bad-media"])
    expect(issues(page([{ block: "showreel", media: { src: "reel.mp4", alt: "Reel" } }]))).toEqual(["/sections/1/media/poster missing"])
    expect(issues(page([{ block: "showreel", media: { src: "reel.mp4", alt: "Reel", poster: "p.jpg" }, speech: true }]))).toEqual(["/sections/1/captions missing"])
    expect(issues(page([{ block: "showreel", media: { src: "reel.mp4", alt: "Reel", poster: "p.jpg" }, captions: "reel.srt" }]))).toEqual(["/sections/1/captions bad-media"])
  })
})

describe("the new variants", () => {
  it("work takes fullscreen-cases and bento", () => {
    for (const variant of ["fullscreen-cases", "bento"]) expect(issues(page([{ block: "work", variant, items: [{ id: "a", title: "A" }] }])), variant).toEqual([])
  })

  it("the toggle offer names its two periods and every item's two prices; nothing else takes them", () => {
    const items = [{ name: "A", prices: ["€9", "€90"] }]
    expect(issues(page([{ block: "offer", variant: "toggle", periods: ["Monthly", "Yearly"], items }]))).toEqual([])
    expect(issues(page([{ block: "offer", variant: "toggle", items: [{ name: "A" }] }]))).toEqual(["/sections/1/periods missing", "/sections/1/items/0/prices missing"])
    expect(issues(page([{ block: "offer", periods: ["Monthly", "Yearly"], items }]))).toEqual(["/sections/1/periods contradiction", "/sections/1/items/0/prices contradiction"])
    expect(issues(page([{ block: "offer", variant: "toggle", periods: ["Monthly"], items }]))).toEqual(["/sections/1/periods too-few"])
  })
})

describe("treatment", () => {
  it("is a knob of the blocks with images", () => {
    for (const treatment of TREATMENTS) expect(issues(page([gallery({ treatment })], { loudness: 2 })), treatment).toEqual([])
    expect(issues(page([{ block: "quote", text: "T", by: "B", treatment: "duotone" }]))).toEqual(["/sections/1/treatment unsupported"])
    expect(issues(page([gallery({ treatment: "sepia" })]))).toEqual(["/sections/1/treatment type"])
    expect(issues({ schema: "feather.page/0", brand: "b.json", sections: [{ ...hero, treatment: "grain" }] })).toEqual(["/sections/0/treatment needs-schema-1"])
  })

  it("moves only at a loudness that lets it", () => {
    expect(issues(page([gallery({ treatment: "inner-parallax", loudness: 1 })]))).toEqual(["/sections/1/treatment contradiction"])
    expect(issues(page([gallery({ treatment: "clip-reveal", loudness: 0 })]))).toEqual(["/sections/1/treatment contradiction"])
    expect(issues(page([gallery({ treatment: "duotone", loudness: 0 }), gallery({ treatment: "grain", loudness: 0 })]))).toEqual([])
  })
})

describe("the JSON Schema", () => {
  it("lists the page blocks in /1 only, and keeps answers to the living library", () => {
    const one = pageJsonSchema(1) as { $defs: { block: { oneOf: { properties: { block: { const: string } } }[] }; answer: { oneOf: { properties: { block: { const: string } } }[] } } }
    expect(one.$defs.block.oneOf.map((b) => b.properties.block.const)).toEqual([...BLOCK_NAMES, ...PAGE_BLOCK_NAMES])
    expect(one.$defs.answer.oneOf.map((b) => b.properties.block.const)).toEqual(BLOCK_NAMES)
    expect(JSON.stringify(pageJsonSchema(0))).not.toContain('"gallery"')
  })
})

describe("the media reference page", () => {
  it("validates, and uses every page block but the showreel", () => {
    const doc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../examples/studio-of-one-media.page.json"), "utf8"))
    expect(issues(doc)).toEqual([])
    const kinds = new Set((doc.sections as { block: string }[]).map((b) => b.block))
    for (const kind of PAGE_BLOCK_NAMES.filter((k) => k !== "showreel")) expect(kinds.has(kind), kind).toBe(true)
  })
})
