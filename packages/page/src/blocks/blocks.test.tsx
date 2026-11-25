import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { BlockName } from "../core/types"
import { defaultBlocks } from "./index"
import { BLOCKS } from "./fixtures"
import { BLOCK_NAMES, PAGE_BLOCK_NAMES } from "../core/spec"

const NAMES = Object.keys(defaultBlocks) as BlockName[]

// Renders one block of any kind (the union of props is checked by tsc where each component is used).
function renderBlock(kind: BlockName, extra: { onAsk?: (s: string) => void } = {}) {
  const Block = defaultBlocks[kind] as React.ComponentType<{ block: unknown; onAsk?: (s: string) => void }>
  return render(<Block block={BLOCKS[kind]} {...extra} />)
}

describe("default blocks", () => {
  it("has one component for every block kind", () => {
    expect(NAMES).toEqual([...BLOCK_NAMES, ...PAGE_BLOCK_NAMES])
  })

  it.each(NAMES)("%s renders as a labelled region", (kind) => {
    const { container } = renderBlock(kind)
    const region = container.querySelector("section")
    expect(region).not.toBeNull()
    expect(region?.getAttribute("data-block")).toBe(kind)
    // The block's own region (a rail inside it is a scrollable region of its own).
    expect(screen.getAllByRole("region")[0]).toBe(region)
    const labelledby = region?.getAttribute("aria-labelledby")
    if (labelledby) expect(container.querySelector(`#${labelledby}`)?.textContent).toBeTruthy()
    else expect(region?.getAttribute("aria-label")).toBeTruthy()
  })

  it("takes its heading id from block.id", () => {
    const { container } = renderBlock("work")
    expect(container.querySelector("section")?.getAttribute("aria-labelledby")).toBe("work-title")
    expect(container.querySelector("h2#work-title")).not.toBeNull()
  })

  it("only the hero has an h1; other titles are h2 and items h3", () => {
    const { container } = renderBlock("hero")
    expect(container.querySelectorAll("h1")).toHaveLength(1)
    expect(container.querySelectorAll("h2")).toHaveLength(0)
    for (const kind of NAMES.filter((k) => k !== "hero")) {
      const view = renderBlock(kind)
      expect(view.container.querySelectorAll("h1")).toHaveLength(0)
      view.unmount()
    }
    const work = renderBlock("work")
    expect(work.container.querySelectorAll("h3").length).toBe(3)
  })
})

describe("hero", () => {
  it("loads its media eagerly with high fetch priority", () => {
    const { container } = renderBlock("hero")
    const img = container.querySelector("img")
    expect(img?.getAttribute("loading")).toBe("eager")
    expect(img?.getAttribute("fetchpriority")).toBe("high")
  })

  it("can be told it is not the LCP", () => {
    const Hero = defaultBlocks.hero
    const { container } = render(<Hero block={BLOCKS.hero} priority={false} />)
    expect(container.querySelector("img")?.getAttribute("loading")).toBe("lazy")
  })

  it("starters call onAsk with their text", () => {
    const onAsk = vi.fn()
    renderBlock("hero", { onAsk })
    fireEvent.click(screen.getByRole("button", { name: "Can I hire you?" }))
    expect(onAsk).toHaveBeenCalledWith("Can I hire you?")
    expect(screen.getAllByRole("button")).toHaveLength(3)
  })

  it("shows no starters without onAsk, and still reads", () => {
    renderBlock("hero")
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("compose themselves")
    expect(screen.getByText(/websites that answer back/)).toBeTruthy()
  })
})

describe("content blocks", () => {
  it("numbers keep the final values readable, with a non-breaking space before the unit", () => {
    const { container } = renderBlock("numbers")
    const finals = Array.from(container.querySelectorAll('[data-slot="counter-final"]')).map((n) => n.textContent)
    expect(finals).toEqual(["12 years", "40 %", "3"])
    expect(screen.getByText("designing products")).toBeTruthy()
  })

  it("faq uses details and summary", () => {
    const { container } = renderBlock("faq")
    const details = container.querySelectorAll("details")
    expect(details).toHaveLength(2)
    expect(within(details[0] as HTMLElement).getByText("Are you available?").tagName).toBe("SUMMARY")
  })

  it("logos keep names as text, and loop in a Marquee past eight", () => {
    const { container, unmount } = renderBlock("logos")
    expect(screen.getByText("Godpip")).toBeTruthy()
    expect(container.querySelector('[data-slot="marquee"]')).toBeNull()
    unmount()
    const Logos = defaultBlocks.logos
    const many = render(<Logos block={{ ...BLOCKS.logos, items: Array.from({ length: 9 }, (_, i) => ({ name: `Name ${i}`, src: "mark.svg" })) }} />)
    expect(many.container.querySelector('[data-slot="marquee"]')).not.toBeNull()
    expect(screen.getAllByText("Name 0").length).toBeGreaterThan(0)
    expect(many.container.querySelector("img")?.getAttribute("alt")).toBe("")
  })

  it("contact links are real hrefs", () => {
    renderBlock("contact")
    expect(screen.getByRole("link", { name: "Write to me" }).getAttribute("href")).toBe("mailto:hello@example.com")
    expect(screen.getByRole("link", { name: "Book a call" }).getAttribute("href")).toBe("https://cal.example.com/alee")
  })

  it("work cards are whole links with the item's href, and accept bare ids", () => {
    const { container, unmount } = renderBlock("work")
    const link = screen.getByRole("link", { name: /Acceptto/ })
    expect(link.getAttribute("href")).toBe("/work/acceptto")
    expect(link.querySelector("h3")?.textContent).toBe("Acceptto")
    unmount()
    const Work = defaultBlocks.work
    const bare = render(<Work block={{ block: "work", items: ["acceptto"] }} />)
    expect(bare.container.querySelector("h3")?.textContent).toBe("acceptto")
    expect(container).toBeTruthy()
  })

  it("quote is a figure with a blockquote, a caption and curly quotes", () => {
    const { container } = renderBlock("quote")
    expect(container.querySelector("figure > blockquote")).not.toBeNull()
    expect(container.querySelector("figure > figcaption")?.textContent).toContain("Mara Ellis")
    expect(container.querySelector("blockquote")?.textContent?.startsWith("“")).toBe(true)
  })

  it("case shows facts as a definition list", () => {
    const { container } = renderBlock("case")
    expect(container.querySelectorAll("dl dt")).toHaveLength(2)
    expect(container.querySelector("dl dd")?.textContent).toBe("Design lead")
  })

  it("timeline and process are ordered lists", () => {
    expect(renderBlock("timeline").container.querySelectorAll("ol > li")).toHaveLength(3)
    expect(renderBlock("process").container.querySelectorAll("ol > li")).toHaveLength(3)
  })

  it("signature carries the brand's variant", () => {
    const { container } = renderBlock("signature")
    expect(container.querySelector('[data-slot="signature"]')?.getAttribute("data-variant")).toBe("ink")
  })
})

describe("fit (docs/visual-system.md section 14.1)", () => {
  const Numbers = defaultBlocks.numbers as React.ComponentType<{ block: unknown }>
  const Timeline = defaultBlocks.timeline as React.ComponentType<{ block: unknown }>

  it("a block title with a run longer than the measure writes it, and sets that run as one fit-word", () => {
    const { container } = render(<Numbers block={{ block: "numbers", id: "n", title: "Die Rechtsschutzversicherungsgesellschaften", items: [{ value: 3, label: "systems" }] }} />)
    const title = container.querySelector<HTMLElement>('[data-slot="block-title"]')!
    expect(title.style.getPropertyValue("--fit-chars")).toBe("39")
    expect(title.querySelector('[data-slot="fit-word"]')?.textContent).toBe("Rechtsschutzversicherungsgesellschaften")
  })

  it("a long unit may wrap under its number; a short one stays on its line", () => {
    const { container } = render(<Numbers block={{ block: "numbers", id: "n", variant: "plain", items: [{ value: 1250, unit: "kilometres", label: "driven" }, { value: 12, unit: "years", label: "designing" }] }} />)
    const values = [...container.querySelectorAll('[data-slot="number-value"]')].map((v) => v.textContent)
    expect(values[0]).toMatch(/^1,250 kilometres$/)
    expect(values[1]).toBe("12\u00a0years")
  })

  it("a word value in a horizontal timeline is sized to fit its card", () => {
    const { container } = render(<Timeline block={{ block: "timeline", id: "t", variant: "horizontal", title: "Along the way", items: [{ when: "Scene", what: "One." }, { when: "Donaudampfschifffahrt", what: "Two." }] }} />)
    const whens = [...container.querySelectorAll<HTMLElement>('[data-slot="timeline-when"]')]
    expect(whens[0].getAttribute("style")).toBeNull()
    expect(whens[1].style.getPropertyValue("--fit-chars")).toBe("21")
    expect(whens[1].querySelector('[data-slot="fit-word"]')).not.toBeNull()
  })
})
