// Every variant of every block renders, server-side, with its slots, inside a /1 page with exactly one h1. And the
// page's loudness reaches the markup.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { BLOCK_RANGE } from "./core/spec"
import { validatePage } from "./core/validate"
import { FeatherPage } from "./render"
import { BLOCKS, VARIANT_EXTRAS } from "./blocks/fixtures"
import type { BlockName, PageDocument } from "./core/types"

const themes = path.join(import.meta.dirname, "../../tokens/themes")
const studio = JSON.parse(fs.readFileSync(path.join(themes, "studio.json"), "utf8")).tokens

const CASES = Object.entries(BLOCK_RANGE).flatMap(([kind, range]) => (range.variants ?? []).map((variant) => [kind as BlockName, variant] as const))

function page(sections: unknown[], extra: Record<string, unknown> = {}): PageDocument {
  const r = validatePage({ schema: "feather.page/1", brand: "brand.json", title: "Variants", sections, ...extra })
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}: ${i.message}`).join("\n"))
  return r.page
}

const parse = (html: string) => {
  const doc = document.implementation.createHTMLDocument("t")
  doc.body.innerHTML = html
  return doc
}

describe("every variant renders", () => {
  it.each(CASES)("%s %s", (kind, variant) => {
    const block = { ...BLOCKS[kind], ...VARIANT_EXTRAS[kind]?.[variant], variant }
    const sections = kind === "hero" ? [block, BLOCKS.work, BLOCKS.contact] : [{ ...BLOCKS.hero, id: "top" }, { ...block, id: `${kind}-block` }]
    const html = renderToStaticMarkup(<FeatherPage page={page(sections)} tokens={studio} />)
    const doc = parse(html)
    expect(doc.querySelectorAll("h1")).toHaveLength(1)
    const section = doc.querySelector(`[data-block="${kind}"]`)!
    expect(section, `${kind} renders its section`).not.toBeNull()
    expect(section.getAttribute("data-block-variant")).toBe(variant)
    // A labelled region: by its heading, or by a label.
    const by = section.getAttribute("aria-labelledby")
    if (by) expect(doc.getElementById(by)?.textContent?.trim()).toBeTruthy()
    else expect(section.getAttribute("aria-label")).toBeTruthy()
    // Every element the block draws has a data-slot (the house anatomy rule).
    for (const el of section.querySelectorAll("[class]")) expect(el.getAttribute("data-slot"), `${kind} ${variant}: <${el.tagName.toLowerCase()} class="${el.getAttribute("class")}">`).toBeTruthy()
    // Ids are unique on the page.
    const ids = [...doc.querySelectorAll("[id]")].map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("the index hero lists the page's titled sections as in-page links", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([{ ...BLOCKS.hero, variant: "index" }, BLOCKS.work, BLOCKS.process, BLOCKS.contact])} tokens={studio} />)
    const links = [...parse(html).querySelectorAll('[data-slot="hero-index-link"]')].map((a) => a.getAttribute("href"))
    expect(links).toEqual(["#work", "#process", "#contact"])
  })

  it("the film hero keeps its scrim and its copy over the media, its poster as the LCP", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([{ ...BLOCKS.hero, variant: "film", media: { src: "reel.mp4", alt: "The studio at work", poster: "reel.jpg" } }])} tokens={studio} />)
    const doc = parse(html)
    expect(doc.querySelector('[data-slot="hero-film-scrim"]')?.className).toContain("bg-media-scrim")
    // The server writes the poster alone (eager, high priority) over the scrim placeholder; the film comes after mount.
    const poster = doc.querySelector('[data-slot="hero-film-poster"]')!
    expect(poster.getAttribute("src")).toBe("reel.jpg")
    expect(poster.getAttribute("fetchpriority")).toBe("high")
    expect(poster.getAttribute("loading")).toBe("eager")
    expect(poster.getAttribute("alt")).toBe("The studio at work")
    expect(doc.querySelector('[data-slot="hero-film"]')?.className).toContain("media-placeholder-scrim")
    expect(doc.querySelector("video")).toBeNull()
    // The control is there for the script, and hidden without it.
    expect(doc.querySelector('[data-slot="hero-film-control"]')?.className).toContain("noscript:hidden")
  })

  it("the swap statement names itself with its first word, and the marquee keeps a real heading", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([BLOCKS.hero, { ...BLOCKS.statement, ...VARIANT_EXTRAS.statement.swap, variant: "swap" }, { ...BLOCKS.statement, id: "band", variant: "marquee" }])} tokens={studio} />)
    const doc = parse(html)
    expect(doc.getElementById("now-title")?.textContent).toContain("I design interfaces that feel obvious.")
    expect(doc.getElementById("band-title")?.className).toContain("sr-only")
  })

  it("offer table is a real table with row headers", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([BLOCKS.hero, { ...BLOCKS.offer, variant: "table" }])} tokens={studio} />)
    const doc = parse(html)
    expect(doc.querySelectorAll('table th[scope="row"]')).toHaveLength(2)
    expect(doc.querySelector("table caption")?.textContent).toBe("Ways to work together")
  })
})

describe("knobs in the markup", () => {
  it("puts the page's loudness on main and a block's own on its section", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([BLOCKS.hero, { ...BLOCKS.work, loudness: 0 }], { loudness: 3 })} tokens={studio} />)
    const doc = parse(html)
    expect(doc.querySelector("main")?.getAttribute("data-loudness")).toBe("3")
    expect(doc.querySelector('[data-block="work"]')?.getAttribute("data-loudness")).toBe("0")
    expect(doc.querySelector('[data-block="hero"]')?.hasAttribute("data-loudness")).toBe(false)
  })

  it("tone, space and motion re-point tokens and variables, never colours", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([BLOCKS.hero, { ...BLOCKS.quote, tone: "block-2", space: "xl", motion: { intensity: 0.5, stagger: "loose" } }, { ...BLOCKS.faq, tone: "inverse" }])} tokens={studio} />)
    const doc = parse(html)
    const quote = doc.querySelector<HTMLElement>('[data-block="quote"]')!
    expect(quote.getAttribute("data-tone")).toBe("block-2")
    expect(quote.getAttribute("data-space")).toBe("xl")
    expect(quote.style.getPropertyValue("--surface-base")).toBe("var(--block-2)")
    expect(quote.style.getPropertyValue("--text-primary")).toBe("var(--block-2-ink)")
    expect(quote.style.getPropertyValue("--distance-reveal")).toBe("16px")
    expect(quote.style.getPropertyValue("--stagger-word")).toBe("60ms")
    const faq = doc.querySelector<HTMLElement>('[data-block="faq"]')!
    expect(faq.style.getPropertyValue("--surface-base")).toBe("var(--surface-inverse)")
    expect(faq.getAttribute("data-surface")).toBe("inverse")
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b(?![^<]*<\/style>)/i)
  })

  it("enter none holds the title still and turns the section's reveal off; a kinetic enter reaches the title", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([{ ...BLOCKS.hero, motion: { enter: "none" } }, { ...BLOCKS.work, scale: "l", motion: { enter: "mask" } }], { loudness: 2 })} tokens={studio} />)
    const doc = parse(html)
    expect(doc.querySelector("h1")?.getAttribute("data-loudness")).toBe("0")
    expect(doc.querySelector("#work-title")?.className).toContain("type-display-l")
  })

  it("page defaults reach blocks that take them, and are ignored by blocks that do not", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([BLOCKS.hero, BLOCKS.process, BLOCKS.statement], { defaults: { space: "s", align: "split" } })} tokens={studio} />)
    const doc = parse(html)
    expect(doc.querySelector('[data-block="process"]')?.getAttribute("data-space")).toBe("s")
    expect(doc.querySelector('[data-block="process"] [data-slot="block-body"]')).not.toBeNull()
    expect(doc.querySelector('[data-block="statement"] [data-slot="block-body"]')).toBeNull()
  })
})
