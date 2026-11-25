// Wave 5 part A in the DOM: each page block's semantics, its keyboard path, its no-script form (the server's markup)
// and its states; the new work and offer variants; and the film hero's poster.
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BLOCKS, GALLERY, VARIANT_EXTRAS, WORK } from "./fixtures"
import { ComparisonBlock } from "./comparison"
import { FormBlock, fieldProblem } from "./form"
import { GalleryBlock } from "./gallery"
import { journalDate, JournalBlock } from "./journal"
import { OfferBlock } from "./offer"
import { ShowreelBlock } from "./showreel"
import { StoryBlock } from "./story"
import { TestimonialsBlock } from "./testimonials"
import { WorkBlock } from "./work"
import { HeroBlock } from "./hero"
import type { BlockOf } from "./shared"

const parse = (html: string) => {
  const doc = document.implementation.createHTMLDocument("t")
  doc.body.innerHTML = html
  return doc
}
const settle = () => act(async () => {})
/** The fixtures' media as written (objects with alt text and a poster). */
const alt = (m: unknown) => (m as { alt: string }).alt
const poster = (m: unknown) => (m as { poster: string }).poster
afterEach(() => vi.unstubAllGlobals())

describe("gallery", () => {
  it.each(["rail", "masonry", "grid", "hover-list"] as const)("%s: every image is a link to its file, with its alt text", (variant) => {
    const doc = parse(renderToStaticMarkup(<GalleryBlock block={{ ...BLOCKS.gallery, variant }} />))
    const links = [...doc.querySelectorAll<HTMLAnchorElement>('[data-slot="gallery-open"]')]
    expect(links).toHaveLength(GALLERY.length)
    expect(links[0].getAttribute("href")).toBe(GALLERY[0].media.src)
    expect(links[0].getAttribute("aria-haspopup")).toBe("dialog")
    if (variant !== "hover-list") expect(links.map((a) => a.querySelector("img")?.getAttribute("alt"))).toEqual(GALLERY.map((g) => g.media.alt))
  })

  it("opens the lightbox at the image, steps through all of them, and offers no download", async () => {
    // The lazy chunk, fetched ahead as a pointer or focus reaches an image does (its first load in jsdom is slow).
    await import("./react-parts")
    render(<GalleryBlock block={{ ...BLOCKS.gallery, variant: "grid" }} />)
    fireEvent.click(screen.getByRole("link", { name: GALLERY[1].media.alt }))
    await settle()
    const dialog = await screen.findByRole("dialog", {}, { timeout: 3000 })
    expect(within(dialog).getByRole("heading", { name: GALLERY[1].media.alt })).toBeTruthy()
    expect(within(dialog).getByText(/2 of 6/)).toBeTruthy()
    expect(within(dialog).queryByRole("link", { name: /Download/ })).toBeNull()
    fireEvent.click(within(dialog).getByRole("button", { name: "Next image" }))
    await settle()
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: GALLERY[2].media.alt })).toBeTruthy()
  })

  it("leaves a modified click (a new tab) to the browser", () => {
    render(<GalleryBlock block={{ ...BLOCKS.gallery, variant: "masonry" }} />)
    const link = screen.getByRole("link", { name: GALLERY[0].media.alt })
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true })
    link.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("the wheel is the rail on the server and under reduced motion", () => {
    const doc = parse(renderToStaticMarkup(<GalleryBlock block={{ ...BLOCKS.gallery, variant: "wheel" }} />))
    expect(doc.querySelector('[data-slot="gallery"]')?.getAttribute("data-variant")).toBe("rail")
    expect(doc.querySelector('[data-block="gallery"]')?.getAttribute("data-state")).toBe("rail")
  })

  it("the wheel turns one step per arrow key, keeps one image reachable and says which", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
    const { container } = render(<GalleryBlock block={{ ...BLOCKS.gallery, variant: "wheel" }} />)
    await settle()
    expect(container.querySelector('[data-slot="gallery"]')?.getAttribute("data-variant")).toBe("wheel")
    const stage = screen.getByRole("group", { name: /arrow keys/ })
    const status = container.querySelector('[data-slot="gallery-wheel-status"]')!
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status.textContent).toBe(`1 of 6: ${GALLERY[0].title}`)
    fireEvent.keyDown(stage, { key: "ArrowRight" })
    expect(status.textContent).toBe(`2 of 6: ${GALLERY[1].title}`)
    fireEvent.keyDown(stage, { key: "ArrowLeft" })
    fireEvent.keyDown(stage, { key: "ArrowLeft" })
    expect(status.textContent).toBe(`6 of 6: ${GALLERY[5].title}`)
    fireEvent.keyDown(stage, { key: "Home" })
    expect(status.textContent).toContain("1 of 6")
    const items = [...container.querySelectorAll('[data-slot="gallery-wheel-ring"] > [data-slot="gallery-item"]')]
    expect(items.filter((li) => !li.hasAttribute("inert"))).toHaveLength(1)
    expect(items.filter((li) => li.getAttribute("aria-hidden") === "true")).toHaveLength(5)
    fireEvent.click(screen.getByRole("button", { name: "Next image" }))
    expect(status.textContent).toContain("2 of 6")
  })

  it("names its rail apart from its section (landmarks are told apart by name)", () => {
    render(<GalleryBlock block={BLOCKS.gallery} />)
    const names = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label") ?? document.getElementById(r.getAttribute("aria-labelledby")!)?.textContent)
    expect(names).toEqual(["From the studio", "From the studio, one image at a time"])
  })

  it("an endless rail adds copies only after mount, hidden and inert", async () => {
    const doc = parse(renderToStaticMarkup(<GalleryBlock block={{ ...BLOCKS.gallery, loop: true }} />))
    expect(doc.querySelectorAll('[data-slot="reel-item"][data-variant="copy"]')).toHaveLength(0)
    const { container } = render(<GalleryBlock block={{ ...BLOCKS.gallery, loop: true }} />)
    await settle()
    const copies = [...container.querySelectorAll('[data-slot="reel-item"][data-variant="copy"]')]
    expect(copies).toHaveLength(GALLERY.length * 2)
    for (const c of copies) {
      expect(c.getAttribute("aria-hidden")).toBe("true")
      expect(c.hasAttribute("inert")).toBe(true)
    }
    expect(screen.getAllByRole("link")).toHaveLength(GALLERY.length)
  })
})

describe("comparison", () => {
  it("is a named native range that moves the divider and speaks both shares", () => {
    const { container } = render(<ComparisonBlock block={BLOCKS.comparison} />)
    const range = screen.getByRole("slider", { name: /Before and After/ })
    expect(range.getAttribute("type")).toBe("range")
    expect(range.getAttribute("aria-valuetext")).toBe("Before 50%, After 50%")
    fireEvent.change(range, { target: { value: "70" } })
    expect(range.getAttribute("aria-valuetext")).toBe("Before 70%, After 30%")
    expect((container.querySelector('[data-slot="comparison"]') as HTMLElement).style.getPropertyValue("--split")).toBe("70%")
  })

  it("keeps both pictures with their alt text, side by side with no script", () => {
    const doc = parse(renderToStaticMarkup(<ComparisonBlock block={{ ...BLOCKS.comparison, start: 30 }} />))
    expect([...doc.querySelectorAll("img")].map((i) => i.getAttribute("alt"))).toEqual([alt(BLOCKS.comparison.before), alt(BLOCKS.comparison.after)])
    const frame = doc.querySelector('[data-slot="comparison"]')!
    expect(frame.className).toContain("grid-cols-2")
    expect(frame.className).toContain("scripting:block")
    expect(doc.querySelector('[data-slot="comparison-range"]')?.className).toContain("hidden")
    expect(doc.querySelector('[data-slot="comparison-range"]')?.getAttribute("value")).toBe("30")
  })
})

describe("story", () => {
  it("stacks its steps in reading order, each with its picture, when it cannot pin", () => {
    const doc = parse(renderToStaticMarkup(<StoryBlock block={BLOCKS.story} />))
    const steps = [...doc.querySelectorAll('[data-slot="stage-step"]')]
    expect(steps).toHaveLength(3)
    expect(steps.map((s) => s.querySelector("img")?.getAttribute("alt"))).toEqual(BLOCKS.story.steps.map((s) => alt(s.media)))
    expect(steps.map((s) => s.querySelector("h3")?.textContent)).toEqual(BLOCKS.story.steps.map((s) => s.title))
    expect(doc.querySelector("h2")?.textContent).toBe(BLOCKS.story.title)
  })

  it("stacked is always that form, as an ordered list", () => {
    const doc = parse(renderToStaticMarkup(<StoryBlock block={{ ...BLOCKS.story, variant: "stacked" }} />))
    expect(doc.querySelectorAll('ol[data-slot="story-steps"] > li img')).toHaveLength(3)
  })
})

describe("testimonials", () => {
  it("are quote figures with blockquotes and attributions, as a grid or a rail", () => {
    for (const variant of ["grid", "rail"] as const) {
      const doc = parse(renderToStaticMarkup(<TestimonialsBlock block={{ ...BLOCKS.testimonials, variant }} />))
      expect(doc.querySelectorAll("figure > blockquote")).toHaveLength(3)
      expect([...doc.querySelectorAll('[data-slot="quote-name"]')].map((n) => n.textContent)).toEqual(["Mara Ellis", "Jun Park", "Sam Okafor"])
    }
  })
})

describe("journal", () => {
  it("dates each entry with a real time element and links its title", () => {
    const doc = parse(renderToStaticMarkup(<JournalBlock block={BLOCKS.journal} />))
    const times = [...doc.querySelectorAll("time")]
    expect(times.map((t) => t.getAttribute("datetime"))).toEqual(["2026-11-12", "2026-09-30", "2026-06-04"])
    expect(times[0].textContent).toBe("12 November 2026")
    expect([...doc.querySelectorAll("h3 a")].map((a) => a.getAttribute("href"))).toEqual(["/journal/not-there", "/journal/states-first", "/journal/one-sentence"])
    expect(doc.querySelector('[data-slot="journal-more-link"]')?.getAttribute("href")).toBe("/journal")
  })

  it("featured leads with the first entry's picture", () => {
    const doc = parse(renderToStaticMarkup(<JournalBlock block={{ ...BLOCKS.journal, variant: "featured" }} />))
    expect(doc.querySelector('[data-slot="journal-entry"][data-variant="lead"] [data-slot="journal-media"] img')).not.toBeNull()
    expect(journalDate("2026-01-05")).toBe("5 January 2026")
  })
})

describe("form", () => {
  const form = BLOCKS.form as BlockOf<"form">

  it("is a real form that posts with no script, every field native and labelled", () => {
    const doc = parse(renderToStaticMarkup(<FormBlock block={form} />))
    const el = doc.querySelector("form")!
    expect(el.getAttribute("action")).toBe("/contact")
    expect(el.getAttribute("method")).toBe("post")
    expect(el.hasAttribute("novalidate")).toBe(false)
    for (const f of form.fields) {
      const controls = doc.querySelectorAll(`[name="${f.name}"]`)
      expect(controls.length, f.name).toBeGreaterThan(0)
      for (const c of controls) expect(doc.querySelector(`label[for="${c.id}"]`), f.name).not.toBeNull()
    }
    expect(doc.querySelector('select[name="budget"]')?.hasAttribute("required")).toBe(true)
    expect(doc.querySelectorAll('input[type="radio"][name="start"]')).toHaveLength(3)
    expect(doc.querySelector('input[name="email"]')?.getAttribute("type")).toBe("email")
    expect(doc.querySelector('textarea[name="message"]')?.getAttribute("maxlength")).toBe("2000")
    expect(doc.querySelector('[data-slot="form-submit"]')?.getAttribute("type")).toBe("submit")
  })

  it("a mailto form writes its answers as text", () => {
    const doc = parse(renderToStaticMarkup(<FormBlock block={{ ...form, action: "mailto:hello@example.com" }} />))
    expect(doc.querySelector("form")?.getAttribute("enctype")).toBe("text/plain")
    expect(doc.querySelector('[data-slot="form-submit"]')?.textContent).toBe("Write the email")
  })

  it("says what is wrong in words, beside each field and in a summary, and focuses the first", async () => {
    render(<FormBlock block={form} />)
    await settle()
    const el = document.querySelector("form")!
    expect(el.noValidate).toBe(true)
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "alee@" } })
    fireEvent.submit(el)
    await act(async () => new Promise((r) => setTimeout(r, 5)))
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent)
    expect(alerts).toEqual(["Fill in your name.", "That email address looks incomplete: it needs an @ and a domain.", "Choose budget.", "Fill in what are you making."])
    expect(screen.getByRole("status").textContent).toBe("4 answers need a look: Your name, Email, Budget, What are you making.")
    expect(screen.getByLabelText(/Your name/).getAttribute("aria-invalid")).toBe("true")
    expect(document.activeElement).toBe(screen.getByLabelText(/Your name/))
  })

  it("conversational: one question at a time, its place announced, Back and Next, the send on the last", async () => {
    const short = { ...form, variant: "conversational" as const, fields: [form.fields[0], form.fields[1]] }
    const server = parse(renderToStaticMarkup(<FormBlock block={short} />))
    // No script: the whole form, the step buttons hidden, the send shown.
    expect(server.querySelectorAll('[data-slot="form-step"][hidden]')).toHaveLength(0)
    expect(server.querySelector('[data-slot="form-next"]')?.className).toContain("noscript:hidden")
    expect(server.querySelector('[data-slot="form-submit"]')?.className).toContain("scripting:hidden")
    const { container } = render(<FormBlock block={short} />)
    await settle()
    const steps = () => [...container.querySelectorAll('[data-slot="form-step"]')].map((s) => (s.hasAttribute("hidden") ? "hidden" : "shown"))
    expect(steps()).toEqual(["shown", "hidden"])
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    await settle()
    expect(screen.getByRole("alert").textContent).toBe("Fill in your name.")
    expect(steps()).toEqual(["shown", "hidden"])
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Ada" } })
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    await act(async () => new Promise((r) => setTimeout(r, 5)))
    expect(steps()).toEqual(["hidden", "shown"])
    expect(screen.getByRole("status").textContent).toBe("Question 2 of 2")
    expect(document.activeElement).toBe(screen.getByLabelText(/Email/))
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
    expect(screen.getByRole("button", { name: "Send" }).className).not.toContain("scripting:hidden")
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await settle()
    expect(steps()).toEqual(["shown", "hidden"])
  })

  it("checks each kind of answer as the browser would, in plain words", () => {
    expect(fieldProblem({ name: "u", label: "Site", type: "url" }, "example.com")).toBe("That link needs to start with https://")
    expect(fieldProblem({ name: "u", label: "Site", type: "url" }, "https://example.com")).toBeNull()
    expect(fieldProblem({ name: "t", label: "Phone", type: "tel" }, "call me")).toContain("letters")
    expect(fieldProblem({ name: "n", label: "Seats", type: "number", max: 12 }, "40")).toBe("At most 12.")
    expect(fieldProblem({ name: "m", label: "Note", max: 3 }, "four")).toBe("At most 3 characters (this is 4).")
    expect(fieldProblem({ name: "m", label: "Note" }, "")).toBeNull()
  })
})

describe("showreel", () => {
  it("with no script is the browser's player, with its captions track", () => {
    const doc = parse(renderToStaticMarkup(<ShowreelBlock block={BLOCKS.showreel} />))
    const video = doc.querySelector("video")!
    expect(video.hasAttribute("controls")).toBe(true)
    expect(video.getAttribute("poster")).toBe(poster(BLOCKS.showreel.media))
    expect(video.getAttribute("preload")).toBe("none")
    const track = video.querySelector("track")!
    expect(track.getAttribute("kind")).toBe("captions")
    expect(track.getAttribute("src")).toBe("reel.vtt")
    expect(doc.querySelector('[data-slot="showreel-controls"]')).toBeNull()
  })

  it("with script has real buttons: play and pause, sound and captions saying whether they are on", async () => {
    render(<ShowreelBlock block={BLOCKS.showreel} />)
    await settle()
    expect(document.querySelector("video")?.hasAttribute("controls")).toBe(false)
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy()
    const sound = screen.getByRole("button", { name: "Sound" })
    expect(sound.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(sound)
    expect(sound.getAttribute("aria-pressed")).toBe("true")
    const captions = screen.getByRole("button", { name: "Captions" })
    expect(captions.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(captions)
    expect(captions.getAttribute("aria-pressed")).toBe("false")
  })
})

describe("work, offer and the film hero", () => {
  it("work fullscreen-cases: each case a full screen with its words on the scrim", () => {
    const doc = parse(renderToStaticMarkup(<WorkBlock block={{ ...BLOCKS.work, variant: "fullscreen-cases" }} />))
    const cases = [...doc.querySelectorAll('[data-slot="work-item"][data-variant="case"]')]
    expect(cases).toHaveLength(WORK.length)
    expect(cases[0].className).toContain("min-h-svh")
    expect(cases[0].querySelector('[data-slot="work-case-scrim"]')?.className).toContain("bg-media-scrim")
    expect(cases[0].querySelector("a")?.getAttribute("href")).toBe("/work/acceptto")
  })

  it("work bento: a mosaic whose first piece leads", () => {
    const doc = parse(renderToStaticMarkup(<WorkBlock block={{ ...BLOCKS.work, variant: "bento" }} />))
    expect([...doc.querySelectorAll('[data-slot="bento-cell"]')].map((c) => c.getAttribute("data-variant"))).toEqual(["8x2", "4x1", "4x1"])
    expect(doc.querySelectorAll("h3")).toHaveLength(3)
  })

  it("offer toggle: a real radio group, both prices in the document, the price a live region", () => {
    const block = { ...BLOCKS.offer, ...VARIANT_EXTRAS.offer.toggle, variant: "toggle" } as BlockOf<"offer">
    render(<OfferBlock block={block} />)
    const radios = screen.getAllByRole("radio")
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(["Monthly", "Yearly"])
    expect((radios[0] as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole("group", { name: "Prices for" })).toBeTruthy()
    const price = document.querySelector('[data-slot="offer-price"]')!
    expect(price.getAttribute("aria-live")).toBe("polite")
    expect(price.textContent).toBe("€900 a month€9,000 a year")
    fireEvent.click(radios[1])
    expect((radios[1] as HTMLInputElement).checked).toBe(true)
  })

  it("the film hero's poster is the LCP, and under reduced motion it stays alone", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }))
    const block = { ...BLOCKS.hero, variant: "film" as const, media: { src: "reel.mp4", alt: "The studio at work", poster: "reel.jpg" } }
    render(<HeroBlock block={block} />)
    await settle()
    expect(document.querySelector('[data-slot="hero-film-poster"]')?.getAttribute("fetchpriority")).toBe("high")
    expect(document.querySelector("video")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Play film" }))
    await settle()
    expect(document.querySelector("video")).not.toBeNull()
  })

  it("the film hero brings its film after mount where motion is allowed, and not on data saver", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
    const block = { ...BLOCKS.hero, variant: "film" as const, media: { src: "reel.mp4", alt: "The studio at work", poster: "reel.jpg" } }
    const view = render(<HeroBlock block={block} />)
    await settle()
    expect(document.querySelector("video")?.getAttribute("aria-hidden")).toBe("true")
    view.unmount()
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } })
    render(<HeroBlock block={block} />)
    await settle()
    expect(document.querySelector("video")).toBeNull()
    Object.defineProperty(navigator, "connection", { configurable: true, value: undefined })
  })
})
