// The product-flow blocks and knobs in use (wave 5): the quiz's keyboard path to a result, the booking's review, the
// calculator's announced total, the chart's table, the podcast's named controls, the places' links, the view-mode
// switch and the colour scheme toggle; and what each one is with no script (the static markup).
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import fs from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { buildTheme } from "@aleeforoughi/feather-tokens"
import { validatePage } from "../core/validate"
import type { PageDocument } from "../core/types"
import { FeatherPage } from "../render"
import { BLOCKS, FLOW_BLOCKS, VARIANT_EXTRAS } from "./fixtures"
import { BookingBlock, CalculatorBlock, ChartBlock, PlacesBlock, PodcastBlock, QuizBlock } from "./index"
import { SCHEME_KEY, schemeCss, schemeScript } from "./scheme"
import { viewKey } from "./views"

const themes = path.join(import.meta.dirname, "../../../tokens/themes")
const theme = (name: string) => JSON.parse(fs.readFileSync(path.join(themes, `${name}.json`), "utf8")).tokens
const page = (sections: unknown[], extra: Record<string, unknown> = {}): PageDocument => {
  const r = validatePage({ schema: "feather.page/1", brand: "b.json", title: "Flows", sections: [{ ...BLOCKS.hero, id: "top" }, ...sections], ...extra })
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}: ${i.message}`).join("\n"))
  return r.page
}

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute("data-scheme")
})

describe("quiz", () => {
  it("goes one question at a time, by keyboard, to a result, back, and again", () => {
    const { container } = render(<QuizBlock block={FLOW_BLOCKS.quiz} />)
    const questions = container.querySelectorAll('[data-slot="quiz-question"]')
    expect([...questions].map((q) => q.getAttribute("data-state"))).toEqual(["current", "hidden", "hidden"])
    // Next without an answer says why and stays.
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(container.querySelector('[data-slot="quiz-nudge"]')?.textContent).toBe("Choose an answer to go on.")
    expect(questions[0].getAttribute("data-state")).toBe("current")
    // Choosing an answer never advances on its own.
    fireEvent.click(screen.getByRole("radio", { name: "Live, with people using it" }))
    expect(questions[0].getAttribute("data-state")).toBe("current")
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(questions[1].getAttribute("data-state")).toBe("current")
    expect(document.activeElement?.textContent).toBe("Who would I work with?")
    fireEvent.click(screen.getByRole("radio", { name: "A few designers and engineers" }))
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect((screen.getByRole("radio", { name: "Live, with people using it" }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("radio", { name: "In two weeks" }))
    fireEvent.click(screen.getByRole("button", { name: "See my result" }))
    const result = container.querySelector('[data-slot="quiz-result"]')!
    expect(result.getAttribute("data-state")).toBe("shown")
    expect(within(result as HTMLElement).getByRole("heading", { level: 3 }).textContent).toBe("A design system")
    expect(document.activeElement?.textContent).toBe("A design system")
    expect(result.textContent).toContain("2 of your 3 answers pointed here.")
    expect(within(result as HTMLElement).getByRole("link", { name: "See the system" }).getAttribute("href")).toBe("#hire")
    fireEvent.click(screen.getByRole("button", { name: "Start again" }))
    expect(questions[0].getAttribute("data-state")).toBe("current")
    expect(screen.getAllByRole("radio").every((r) => !(r as HTMLInputElement).checked)).toBe(true)
  })

  it("with no script, shows every question and how the result is decided", () => {
    const html = renderToStaticMarkup(<QuizBlock block={FLOW_BLOCKS.quiz} />)
    const doc = new DOMParser().parseFromString(html, "text/html")
    expect(doc.querySelectorAll('[data-slot="quiz-question"] input[type="radio"]')).toHaveLength(9)
    // Hidden steps are hidden only where script runs.
    for (const q of doc.querySelectorAll('[data-slot="quiz-question"]')) expect(q.className).toContain("scripting:data-[state=hidden]:hidden")
    expect(doc.querySelector('[data-slot="quiz-actions"]')?.className).toContain("noscript:hidden")
    const rules = doc.querySelector('[data-slot="quiz-rules"]')!
    expect(rules.tagName).toBe("DETAILS")
    expect(rules.textContent).toContain("Each answer points to a result")
    expect([...rules.querySelectorAll('[data-slot="quiz-rules-name"]')].map((n) => n.textContent)).toEqual(["A product sprint", "A design system", "Join the team"])
  })

  it("a scored quiz says the total that chose the result", () => {
    const block = {
      block: "quiz" as const,
      title: "How loud?",
      scoring: "score" as const,
      questions: [{ id: "a", q: "A?", options: [{ id: "lo", label: "Quiet", score: 0 }, { id: "hi", label: "Loud", score: 3 }] }],
      results: [{ id: "calm", title: "Calm", min: 0, max: 1 }, { id: "loud", title: "Loud", min: 2, max: 3 }],
    }
    render(<QuizBlock block={block} />)
    fireEvent.click(screen.getByRole("radio", { name: "Loud" }))
    fireEvent.click(screen.getByRole("button", { name: "See my result" }))
    expect(screen.getByText("Your answers added up to 3 (2 to 3 gives this result).")).toBeTruthy()
  })
})

describe("booking", () => {
  it("goes service, time, details, review; every choice can be changed; the email is written out, not sent", () => {
    const { container } = render(<BookingBlock block={FLOW_BLOCKS.booking} />)
    const step = () => container.querySelector('[data-slot="booking-step"][data-state="current"]')?.getAttribute("data-step")
    expect(step()).toBe("service")
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(container.querySelector('[data-slot="booking-nudge"]')?.textContent).toBe("Choose a service to go on.")
    fireEvent.click(screen.getByRole("radio", { name: /Design review/ }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(step()).toBe("time")
    // The days are listed, each a group of real radios named with its date.
    expect(screen.getByRole("group", { name: "Tuesday 1 December" })).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: "Wednesday 2 December, 14:30" }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(step()).toBe("details")
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Sam" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Review" }))
    expect(step()).toBe("review")
    const review = container.querySelector('[data-slot="booking-review"]')!
    expect(review.textContent).toContain("Design review")
    expect(review.textContent).toContain("Wednesday 2 December, 14:30 (Times are in London time (GMT).)")
    const send = screen.getByRole("link", { name: "Write the email" })
    const href = send.getAttribute("href")!
    expect(href.startsWith("mailto:hello@example.com?")).toBe(true)
    expect(decodeURIComponent(href)).toContain("Name: Sam\nEmail: sam@example.com")
    expect(screen.getByText(/Nothing is sent until you send it/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /^Change\s*time$/ }))
    expect(step()).toBe("time")
  })

  it("with no script, is one form that posts to the action", () => {
    const html = renderToStaticMarkup(<BookingBlock block={{ ...FLOW_BLOCKS.booking, mailto: undefined, action: "/book" }} />)
    const doc = new DOMParser().parseFromString(html, "text/html")
    const form = doc.querySelector("form")!
    expect(form.getAttribute("action")).toBe("/book")
    expect(form.getAttribute("method")).toBe("post")
    expect(form.querySelectorAll('input[name="slot"]')).toHaveLength(8)
    expect(form.querySelector('[data-slot="booking-send-static"]')?.getAttribute("type")).toBe("submit")
    expect(form.querySelector('input[name="email"]')?.hasAttribute("required")).toBe(true)
  })
})

describe("calculator", () => {
  it("announces the total and its breakdown as the inputs change", () => {
    render(<CalculatorBlock block={FLOW_BLOCKS.calculator} />)
    const total = screen.getByRole("status")
    expect(total.getAttribute("aria-live")).toBe("polite")
    expect(total.getAttribute("aria-atomic")).toBe("true")
    // 5 pages: 2000 design + 1250 build.
    expect(total.textContent).toContain("£3,250")
    fireEvent.change(screen.getByRole("slider", { name: "Pages" }), { target: { value: "10" } })
    expect(total.textContent).toContain("£6,500")
    expect(screen.getByRole("slider", { name: "Pages" }).getAttribute("aria-valuetext")).toBe("10 pages")
    fireEvent.click(screen.getByRole("radio", { name: "Make a new one" }))
    fireEvent.click(screen.getByRole("switch", { name: "Copywriting" }))
    expect(total.textContent).toContain("£10,100")
    expect(within(total).getByText("Words").nextElementSibling?.textContent).toBe("£1,200")
  })

  it("with no script, shows the starting prices instead of inputs that cannot count", () => {
    const html = renderToStaticMarkup(<CalculatorBlock block={FLOW_BLOCKS.calculator} />)
    const doc = new DOMParser().parseFromString(html, "text/html")
    expect(doc.querySelector('[data-slot="calculator-form"]')?.className).toContain("noscript:hidden")
    const prices = doc.querySelector('[data-slot="calculator-static"]')!
    expect(prices.className).toContain("scripting:hidden")
    const rows = [...prices.querySelectorAll("tbody tr")].map((r) => [...r.children].map((c) => c.textContent))
    expect(rows).toEqual([
      ["At the starting choices", "£3,250"],
      ["Pages: 20 pages", "£13,000"],
      ["Design system: Make a new one", "£5,650"],
      ["Copywriting: on", "£3,850"],
    ])
  })
})

describe("chart", () => {
  it("captions its summary, keeps the drawing out of the accessibility tree, and has the data as a table", () => {
    const { container } = render(<ChartBlock block={FLOW_BLOCKS.chart} />)
    expect(container.querySelector("figcaption")?.textContent).toContain("about half")
    expect(container.querySelector('[data-slot="chart-frame"]')?.getAttribute("aria-hidden")).toBe("true")
    expect(container.querySelectorAll('[data-slot="chart-bar"]')).toHaveLength(6)
    const table = screen.getByRole("table", { hidden: true })
    expect(table.querySelector("caption")?.textContent).toBe("Fewer tickets, month by month")
    expect([...table.querySelectorAll("thead th")].map((t) => t.textContent)).toEqual(["Month", "Tickets"])
    expect([...table.querySelectorAll("tbody td")].map((t) => t.textContent)).toEqual(["1,240", "1,110", "930", "820", "700", "610"])
    expect(container.querySelector("details")?.contains(table)).toBe(true)
  })

  it("line and area draw one path per series, told apart by dash, with a legend", () => {
    const block = { ...FLOW_BLOCKS.chart, ...VARIANT_EXTRAS.chart.line, variant: "line" as const }
    const { container } = render(<ChartBlock block={block as typeof FLOW_BLOCKS.chart} />)
    const lines = [...container.querySelectorAll('[data-slot="chart-line"]')]
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.getAttribute("stroke-dasharray"))).toEqual([null, "6 4"])
    expect([...container.querySelectorAll('[data-slot="chart-legend-item"]')].map((l) => l.textContent)).toEqual(["Tickets", "Self-served"])
  })

  it("draws in the text ink, which every reference brand holds at 7:1 or more", () => {
    for (const name of ["studio", "portrait", "seed"]) {
      const t = buildTheme(theme(name))
      if (!t.ok) throw new Error(name)
      const bg = theme(name).colors.background
      const lum = (hex: string) => {
        const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
      }
      const [a, b] = [lum(t.derived.textPrimary), lum(bg)]
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), name).toBeGreaterThanOrEqual(7)
    }
  })
})

describe("podcast", () => {
  it("never autoplays or preloads, names every control, and steps the speed", () => {
    const { container } = render(<PodcastBlock block={FLOW_BLOCKS.podcast} />)
    const audio = container.querySelector("audio")!
    expect(audio.hasAttribute("autoplay")).toBe(false)
    expect(audio.getAttribute("preload")).toBe("none")
    // The browser's own controls are the no-script player.
    expect(audio.hasAttribute("controls")).toBe(true)
    expect(audio.className).toContain("scripting:hidden")
    for (const name of ["Play The sound of a quiet room", "Back 15 seconds", "Forward 15 seconds", "Playback speed 1 times; change"]) expect(screen.getByRole("button", { name })).toBeTruthy()
    expect(screen.getByRole("slider", { name: "Position" }).getAttribute("aria-valuetext")).toBe("0 seconds of 4 seconds")
    fireEvent.click(screen.getByRole("button", { name: /Playback speed/ }))
    expect(screen.getByRole("button", { name: "Playback speed 1.25 times; change" })).toBeTruthy()
    expect(audio.playbackRate).toBe(1.25)
  })

  it("chapters seek, and the transcript sits in a disclosure that can follow along", () => {
    const { container } = render(<PodcastBlock block={FLOW_BLOCKS.podcast} />)
    const audio = container.querySelector("audio")!
    fireEvent.click(screen.getByRole("button", { name: /What it taught me/ }))
    expect(audio.currentTime).toBe(2)
    act(() => {
      audio.dispatchEvent(new Event("timeupdate"))
    })
    expect(container.querySelector('[data-cue="1"]')?.getAttribute("aria-current")).toBe("true")
    const transcript = container.querySelector('[data-slot="podcast-transcript"]')!
    expect(transcript.tagName).toBe("DETAILS")
    expect(within(transcript as HTMLElement).getByRole("switch", { name: "Follow along as it plays", hidden: true })).toBeTruthy()
  })
})

describe("places", () => {
  it("is always a list of addresses with real links, the directions built from the address when none is given", () => {
    render(<PlacesBlock block={FLOW_BLOCKS.places} />)
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByRole("link", { name: /^Directions\s*to The workshop$/ }).getAttribute("href")).toBe("https://www.openstreetmap.org/search?query=4%20Sample%20Street%0AMargate%20CT9%201AA")
    expect(screen.getByRole("link", { name: "+44 20 7946 0000" }).getAttribute("href")).toBe("tel:+442079460000")
  })
})

describe("views: the view-mode switch", () => {
  const work = { ...BLOCKS.work, views: "grid" as const }

  it("switches grid, list and index through a radio group, and remembers it for the page", () => {
    const { container, unmount } = render(<FeatherPage page={page([work])} />)
    const section = () => container.querySelector('[data-block="work"]')!
    expect(section().getAttribute("data-view")).toBe("grid")
    const group = screen.getByRole("group", { name: "View" })
    expect(within(group).getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["grid", "list", "index"])
    fireEvent.click(within(group).getByRole("radio", { name: "Index" }))
    expect(section().getAttribute("data-view")).toBe("index")
    expect(container.querySelector('[data-slot="work-view-index"]')).not.toBeNull()
    expect(localStorage.getItem(viewKey("work"))).toBe("index")
    unmount()
    const again = render(<FeatherPage page={page([work])} />)
    expect(again.container.querySelector('[data-block="work"]')?.getAttribute("data-view")).toBe("index")
  })

  it("with no script, is the view the block names", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([{ ...work, views: "list" }])} />)
    expect(html).toContain('data-view="list"')
    expect(html).toContain('data-slot="work-view-list"')
  })
})

describe("scheme: the colour scheme toggle", () => {
  const colors = { background: "#F6F1EA", surface: "#FFFFFF", text: "#1C130C", primary: "#1C130C", primaryText: "#FFFFFF" }
  const nav = { items: [{ label: "Work", href: "#work" }] }

  it("puts the other set in the head: the system's preference first, the person's choice over it", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([], { nav, scheme: { colors } })} tokens={theme("studio")} />)
    const css = /<style data-feather-scheme="">([\s\S]*?)<\/style>/.exec(html)?.[1] ?? ""
    expect(css).toContain('@media (prefers-color-scheme: light) {\n  :root:root:not([data-scheme="dark"])')
    expect(css).toContain(':root:root[data-scheme="light"]')
    expect(css).toContain("color-scheme: light")
  })

  it("refuses a set of the same scheme as the brand", () => {
    expect(() => renderToStaticMarkup(<FeatherPage page={page([], { nav, scheme: { colors: { background: "#000000", surface: "#111111", text: "#FFFFFF", primary: "#FFFFFF" } } })} tokens={theme("studio")} />)).toThrow(/dark set, like the brand's/)
  })

  it("applies and remembers light, dark and system", () => {
    render(<FeatherPage page={page([], { nav, scheme: { colors } })} tokens={theme("studio")} />)
    const group = screen.getByRole("group", { name: "Colour scheme" })
    expect((within(group).getByRole("radio", { name: "System" }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(within(group).getByRole("radio", { name: "Light" }))
    expect(document.documentElement.getAttribute("data-scheme")).toBe("light")
    expect(localStorage.getItem(SCHEME_KEY)).toBe("light")
    fireEvent.click(within(group).getByRole("radio", { name: "System" }))
    expect(document.documentElement.hasAttribute("data-scheme")).toBe(false)
    expect(localStorage.getItem(SCHEME_KEY)).toBeNull()
  })

  it("reads a remembered choice before paint, and its inline script does the same before the page", () => {
    localStorage.setItem(SCHEME_KEY, "dark")
    render(<FeatherPage page={page([], { footer: { links: [] }, scheme: { colors, toggle: "footer" } })} tokens={theme("studio")} />)
    expect(document.documentElement.getAttribute("data-scheme")).toBe("dark")
    expect((screen.getByRole("radio", { name: "Dark" }) as HTMLInputElement).checked).toBe(true)
    expect(document.querySelector('footer [data-slot="scheme-toggle"]')).not.toBeNull()
    document.documentElement.removeAttribute("data-scheme")
    new Function(schemeScript())()
    expect(document.documentElement.getAttribute("data-scheme")).toBe("dark")
  })

  it("schemeCss takes the other set's variables only", () => {
    const light = buildTheme({ ...theme("studio"), colors })
    const dark = buildTheme(theme("studio"))
    if (!light.ok || !dark.ok) throw new Error("themes")
    const css = schemeCss(dark.css, light.css)!
    expect(css).not.toContain("data-density")
    expect(css.match(/--surface-base:/g)).toHaveLength(2)
  })
})
