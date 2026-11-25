// The knobs of feather.page/1 (wave 2): every one validates, every bad value is refused with its JSON pointer and a
// code, a knob on a /0 page names the schema it needs, and knobs that fight are contradictions.
import { describe, expect, it } from "vitest"
import { BLOCK_RANGE, BLOCKS, ENTERS, SCROLL_PATTERNS, TONES } from "./spec"
import { validatePage } from "./validate"
import { pageJsonSchema } from "../../scripts/json-schema"

const hero = { block: "hero", title: "Hello" }
const page = (sections: unknown[], extra: Record<string, unknown> = {}) => ({ schema: "feather.page/1", brand: "b.json", sections, ...extra })
const issues = (doc: unknown) => {
  const r = validatePage(doc)
  return r.ok ? [] : r.issues.map((i) => `${i.path} ${i.code}`)
}
const ok = (doc: unknown) => expect(issues(doc)).toEqual([])

describe("the knobs validate", () => {
  it("every block takes every one of its variants", () => {
    for (const [kind, range] of Object.entries(BLOCK_RANGE)) {
      for (const variant of range.variants ?? []) {
        const extra = kind === "statement" && variant === "swap" ? { words: ["a", "b"] } : kind === "quote" && variant === "rail" ? { items: [{ text: "More", by: "Someone" }] } : {}
        const media = (BLOCK_RANGE[kind].needsMedia ?? []).includes(variant) ? { media: "a.jpg" } : {}
        const base = { block: kind, ...minimal(kind), ...media, ...extra, variant }
        ok(page(kind === "hero" ? [base] : [hero, base]))
      }
    }
  })

  it("takes loudness, tone, space, align, scale, crop, motion and scroll", () => {
    ok(
      page(
        [
          { ...hero, loudness: 3, tone: "inverse", space: "xl", align: "center", scale: "l", crop: "bleed", motion: { enter: "mask", intensity: 0.4, direction: "down", stagger: "tight" }, scroll: { pattern: "parallax" } },
          { block: "process", steps: [{ title: "A" }, { title: "B" }], variant: "pinned", scroll: { pattern: "pin", length: 3, snap: true } },
          ...TONES.map((tone, i) => ({ block: "faq", id: `faq-${i}`, items: [{ q: "Q", a: "A" }], tone })),
        ],
        { loudness: 2, defaults: { space: "m", align: "split", scale: "m", crop: "edge" } }
      )
    )
    for (const enter of ENTERS) ok(page([{ ...hero, loudness: 2, motion: { enter } }]))
  })

  it("refuses bad values with their pointers", () => {
    expect(
      issues(
        page(
          [
            { ...hero, variant: "carousel", loudness: 4, tone: "neon", space: "xxl", align: "left", scale: "huge", crop: "zoom", motion: { enter: "wobble", intensity: 1.5, direction: "in", stagger: "fast", speed: 2 }, scroll: { pattern: "spin", length: 9, snap: "yes" } },
          ],
          { loudness: 1.5, defaults: { tone: "inverse" } }
        )
      )
    ).toEqual([
      "/loudness out-of-range",
      "/defaults/tone unknown-field",
      "/sections/0/variant unknown-variant",
      "/sections/0/loudness out-of-range",
      "/sections/0/tone type",
      "/sections/0/space type",
      "/sections/0/align type",
      "/sections/0/scale type",
      "/sections/0/crop type",
      "/sections/0/motion/speed unknown-field",
      "/sections/0/motion/enter type",
      "/sections/0/motion/intensity out-of-range",
      "/sections/0/motion/direction type",
      "/sections/0/motion/stagger type",
      "/sections/0/scroll/pattern type",
      "/sections/0/scroll/length out-of-range",
      "/sections/0/scroll/snap type",
    ])
  })

  it("refuses a value a block does not support", () => {
    expect(issues(page([hero, { block: "faq", items: [{ q: "Q", a: "A" }], align: "offset", crop: "bleed", scroll: { pattern: "stack" } }]))).toEqual([
      "/sections/1/align unsupported",
      "/sections/1/crop unsupported",
      "/sections/1/scroll/pattern unsupported",
    ])
    expect(issues(page([hero, { block: "statement", title: "T", motion: { direction: "left" } }]))).toEqual(["/sections/1/motion/direction unsupported"])
    ok(page([hero, { block: "statement", title: "T", variant: "marquee", motion: { direction: "left" } }]))
  })

  it("names what a variant is built on", () => {
    expect(issues(page([{ ...hero, variant: "film" }]))).toEqual(["/sections/0/media missing"])
    expect(issues(page([hero, { block: "statement", title: "T", variant: "swap" }]))).toEqual(["/sections/1/words missing"])
    expect(issues(page([hero, { block: "statement", title: "T", words: ["a", "b"] }]))).toEqual(["/sections/1/words contradiction"])
    expect(issues(page([hero, { block: "quote", text: "T", by: "B", items: [{ text: "x", by: "y" }] }]))).toEqual(["/sections/1/items contradiction"])
  })
})

describe("knobs compose, never fight", () => {
  const work = { block: "work", items: [{ id: "a", title: "A" }] }
  it("scroll at loudness 0 is a contradiction, from the block or the page", () => {
    expect(issues(page([hero, { ...work, loudness: 0, scroll: { pattern: "reveal" } }]))).toEqual(["/sections/1/scroll contradiction"])
    expect(issues(page([hero, { ...work, scroll: {} }], { loudness: 0 }))).toEqual(["/sections/1/scroll contradiction"])
    ok(page([hero, { ...work, loudness: 1, scroll: { pattern: "reveal" } }], { loudness: 0 }))
  })

  it("a pin inside a horizontal rail is a contradiction", () => {
    expect(issues(page([hero, { ...work, variant: "rail", scroll: { pattern: "stack" } }]))).toEqual(["/sections/1/scroll/pattern contradiction"])
    ok(page([hero, { ...work, variant: "rail", scroll: { pattern: "horizontal", length: 2 } }]))
  })

  it("choreography and kinetic type need loudness 2; quiet means no entrance", () => {
    expect(issues(page([hero, { ...work, loudness: 1, variant: "stack", scroll: { pattern: "stack" } }]))).toEqual(["/sections/1/scroll/pattern contradiction"])
    expect(issues(page([{ ...hero, motion: { enter: "scramble" } }], { loudness: 1 }))).toEqual(["/sections/0/motion/enter contradiction"])
    expect(issues(page([{ ...hero, loudness: 0, motion: { enter: "fade" } }]))).toEqual(["/sections/0/motion/enter contradiction"])
    ok(page([{ ...hero, loudness: 0, motion: { enter: "none" } }]))
    // Without a declared loudness the brand's decides at render time, so nothing is refused here.
    ok(page([{ ...hero, motion: { enter: "scramble" } }]))
  })

  it("length is for pinned patterns and snap for a pin", () => {
    expect(issues(page([hero, { ...work, scroll: { pattern: "reveal", length: 2 } }]))).toEqual(["/sections/1/scroll/length contradiction"])
    expect(issues(page([hero, { ...work, variant: "rail", scroll: { snap: true } }]))).toEqual(["/sections/1/scroll/snap contradiction"])
    ok(page([hero, { block: "process", steps: [{ title: "A" }, { title: "B" }], variant: "pinned", scroll: { length: 2, snap: true } }]))
  })
})

describe("feather.page/0 stays as it was", () => {
  it("a knob on a /0 page names the schema it needs, and the rest of the block is still checked", () => {
    expect(issues({ schema: "feather.page/0", brand: "b.json", loudness: 2, defaults: {}, sections: [{ ...hero, variant: "film", motion: { enter: "mask" }, facts: [], eyebrow: 3 }] })).toEqual([
      "/loudness needs-schema-1",
      "/defaults needs-schema-1",
      "/sections/0/variant needs-schema-1",
      "/sections/0/motion needs-schema-1",
      "/sections/0/facts needs-schema-1",
      "/sections/0/eyebrow type",
    ])
  })

  it("signature's own variant stays free text in both", () => {
    ok({ schema: "feather.page/0", brand: "b.json", sections: [{ block: "signature", title: "S", variant: "ink" }] })
    ok(page([{ block: "signature", title: "S", variant: "ink", crop: "edge", media: "a.jpg" }]))
  })

  it("the /0 JSON Schema has no knobs; /1 has them per block", () => {
    const zero = JSON.stringify(pageJsonSchema(0))
    expect(zero).not.toContain('"loudness"')
    const one = pageJsonSchema(1) as { properties: Record<string, unknown>; $defs: { block: { oneOf: { properties: Record<string, { enum?: string[] }> }[] } } }
    expect(one.properties.loudness).toEqual({ type: "integer", minimum: 0, maximum: 3 })
    const work = one.$defs.block.oneOf.find((b) => (b.properties.block as unknown as { const: string }).const === "work")!
    expect(work.properties.variant.enum).toEqual(["grid", "hover-list", "stack", "rail"])
    expect((work.properties.scroll as unknown as { properties: { pattern: { enum: string[] } } }).properties.pattern.enum).toEqual([...SCROLL_PATTERNS])
  })
})

function minimal(kind: string): Record<string, unknown> {
  const req: Record<string, Record<string, unknown>> = {
    hero: { title: "T" },
    statement: { title: "T" },
    work: { items: [{ id: "a", title: "A" }] },
    case: { title: "T" },
    numbers: { items: [{ value: 1, label: "L" }] },
    timeline: { items: [{ when: "1", what: "a" }, { when: "2", what: "b" }] },
    process: { steps: [{ title: "A" }, { title: "B" }] },
    logos: { items: [{ name: "A" }, { name: "B" }] },
    quote: { text: "T", by: "B" },
    offer: { items: [{ name: "A" }] },
    faq: { items: [{ q: "Q", a: "A" }] },
    contact: {},
    signature: {},
    // Product flows (wave 5).
    quiz: { title: "Q", questions: [{ id: "a", q: "A?", options: [{ id: "x", label: "X", result: "r" }, { id: "y", label: "Y", result: "r" }] }], results: [{ id: "r", title: "R" }] },
    booking: { title: "B", services: [{ id: "s", name: "S" }], days: [{ date: "2026-12-01", slots: ["09:00"] }], action: "/book" },
    calculator: { title: "C", inputs: [{ id: "n", label: "N", kind: "number", min: 0, max: 10 }], formula: "n * 2" },
    chart: { title: "C", summary: "S", series: [{ label: "A" }], rows: [{ label: "1", values: [1] }, { label: "2", values: [2] }] },
    places: { title: "P", items: [{ name: "A", address: "1 Road" }] },
    podcast: { title: "P", episodes: [{ id: "e", title: "E", audio: "e.mp3", transcript: [{ text: "Hello" }] }] },
  }
  expect(Object.keys(req).sort()).toEqual(Object.keys(BLOCKS).sort())
  return req[kind]
}
