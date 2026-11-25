import { act, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { staggerDelays } from "../core/motion"
import { fakeFrames, mockMedia, REDUCED } from "../test/helpers"
import { DisplayTitle, type DisplayEffect } from "./display-title"

const stubMotion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }))
afterEach(() => vi.unstubAllGlobals())
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe("DisplayTitle", () => {
  it("keeps the real text for screen readers and hides the split pieces", async () => {
    stubMotion(false)
    const { container } = render(<DisplayTitle as="h1" split="word">Make it liquid</DisplayTitle>)
    await settle()
    expect(screen.getByRole("heading", { level: 1, name: "Make it liquid" })).toBeTruthy()
    expect(container.querySelector('[data-slot="display-title-text"]')!.className).toContain("sr-only")
    const visual = container.querySelector('[data-slot="display-title-visual"]')!
    expect(visual.getAttribute("aria-hidden")).toBe("true")
    expect(visual.querySelectorAll('[data-piece="word"]')).toHaveLength(3)
  })

  it("splits characters inside words", async () => {
    stubMotion(false)
    const { container } = render(<DisplayTitle split="char">Hi you</DisplayTitle>)
    await settle()
    expect(container.querySelectorAll('[data-piece="char"]')).toHaveLength(5)
  })

  it("sizes and tags: size maps to type-display-*, data-variant is the split", async () => {
    stubMotion(false)
    const { container } = render(<DisplayTitle as="h3" size="xl" split="line">T</DisplayTitle>)
    await settle()
    const el = container.querySelector('[data-slot="display-title"]')!
    expect(el.tagName).toBe("H3")
    expect(el.className).toContain("type-display-xl")
    expect(el.getAttribute("data-variant")).toBe("line")
  })

  it("is plain text under reduced motion: no pieces, no animation", async () => {
    stubMotion(true)
    const animate = vi.fn()
    Element.prototype.animate = animate as never
    const { container } = render(<DisplayTitle split="char">Plain text</DisplayTitle>)
    await settle()
    expect(container.querySelectorAll('[data-slot="display-title-piece"]')).toHaveLength(0)
    expect(container.textContent).toBe("Plain text")
    expect(animate).not.toHaveBeenCalled()
    delete (Element.prototype as { animate?: unknown }).animate
  })

  it("does not start hidden when already in view at mount (LCP-safe)", async () => {
    stubMotion(false)
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} })
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 200, left: 0, right: 400, width: 400, height: 100, x: 0, y: 100, toJSON() {} })
    const { container } = render(<DisplayTitle split="word">In view now</DisplayTitle>)
    await settle()
    for (const p of container.querySelectorAll<HTMLElement>('[data-piece="word"]')) expect(p.style.opacity).not.toBe("0")
    rect.mockRestore()
  })

  it("hides pieces that start below the fold until they enter", async () => {
    stubMotion(false)
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} })
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 5000, bottom: 5100, left: 0, right: 400, width: 400, height: 100, x: 0, y: 5000, toJSON() {} })
    const { container } = render(<DisplayTitle split="word">Far below</DisplayTitle>)
    await settle()
    for (const p of container.querySelectorAll<HTMLElement>('[data-piece="word"]')) expect(p.style.opacity).toBe("0")
    rect.mockRestore()
  })

  it("the whole sequence fits the cap however long the title is", () => {
    const words = 200
    const delays = staggerDelays(words, 40, 700)
    expect(delays.at(-1)! + 700).toBeLessThanOrEqual(1200)
  })

  it("has a data-slot on every classed element", async () => {
    stubMotion(false)
    const { container } = render(<DisplayTitle split="char">Slots ok</DisplayTitle>)
    await settle()
    for (const el of container.querySelectorAll("[class]")) expect(el.getAttribute("data-slot")).toBeTruthy()
  })
})

// ---- the effects -----------------------------------------------------------------------------------------------

type Watcher = { cb: (entries: { isIntersecting: boolean }[]) => void }
const observers: Watcher[] = []
const calls: { el: Element; frames: Keyframe[]; options: KeyframeAnimationOptions }[] = []

function setup({ reduced = false, width = 1280, offscreen = false }: { reduced?: boolean; width?: number; offscreen?: boolean } = {}) {
  observers.length = 0
  calls.length = 0
  mockMedia(reduced ? [REDUCED] : [])
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width })
  vi.stubGlobal("IntersectionObserver", class { constructor(cb: Watcher["cb"]) { observers.push({ cb }) } observe() {} disconnect() {} })
  Element.prototype.animate = function (this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
    calls.push({ el: this, frames, options })
    return { cancel() {}, finish() {}, finished: Promise.resolve() } as never
  } as never
  const top = offscreen ? 5000 : 100
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top, bottom: top + 100, left: 0, right: 400, width: 400, height: 100, x: 0, y: top, toJSON() {} })
}
const enter = () => act(async () => { for (const o of observers) o.cb([{ isIntersecting: true }]); await Promise.resolve() })
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete (Element.prototype as { animate?: unknown }).animate
})

const COPY = "Design that answers to the person"
const EFFECTS: DisplayEffect[] = ["rise", "mask", "skew", "oval", "blink", "scramble"]

describe("DisplayTitle effects", () => {
  for (const effect of EFFECTS) {
    it(`${effect}: one heading, one accessible name equal to the text, the visual layer hidden`, async () => {
      setup()
      const { container } = render(<DisplayTitle as="h1" effect={effect}>{COPY}</DisplayTitle>)
      await settle()
      expect(screen.getAllByRole("heading")).toHaveLength(1)
      expect(screen.getByRole("heading", { level: 1, name: COPY })).toBeTruthy()
      expect(container.querySelector('[data-slot="display-title-visual"]')!.getAttribute("aria-hidden")).toBe("true")
      expect(container.querySelector('[data-slot="display-title-visual"]')!.textContent).toBe(COPY)
    })

    it(`${effect}: reduced motion shows the final text, no animation`, async () => {
      setup({ reduced: true })
      const { container } = render(<DisplayTitle effect={effect}>{COPY}</DisplayTitle>)
      await settle()
      await enter()
      expect(container.textContent).toBe(COPY)
      expect(container.querySelectorAll('[data-slot="display-title-piece"]')).toHaveLength(0)
      expect(calls).toHaveLength(0)
    })

    it(`${effect}: server markup is the full plain text`, () => {
      const html = renderToStaticMarkup(<DisplayTitle as="h2" effect={effect}>{COPY}</DisplayTitle>)
      expect(html).toContain(COPY)
      expect(html).not.toContain("opacity")
      expect(html).not.toContain("aria-hidden")
    })
  }

  it("mask by line: lines are wrapped when the title enters, rise 110% to 0, and the wrappers are released after", async () => {
    setup({ offscreen: true })
    // Two lines: the first two words, then the rest.
    const top = vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
      const words = Array.from(this.parentElement?.querySelectorAll('[data-piece="word"]') ?? [])
      return words.indexOf(this) < 3 ? 0 : 40
    })
    const { container } = render(<DisplayTitle effect="mask" split="line">{COPY}</DisplayTitle>)
    await settle()
    const visual = container.querySelector<HTMLElement>('[data-slot="display-title-visual"]')!
    expect(visual.style.opacity).toBe("0")
    expect(container.querySelectorAll('[data-piece="line"]')).toHaveLength(0)
    await enter()
    expect(visual.style.opacity).toBe("")
    expect(calls).toHaveLength(2)
    expect(calls[0].frames[0].transform).toBe("translateY(110%)")
    expect(calls[0].options.duration).toBe(800)
    expect(calls.map((c) => c.options.delay)).toEqual([0, 100])
    // the sequence ended: the layout is handed back
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelectorAll('[data-piece="line"]')).toHaveLength(0)
    expect(container.textContent).toBe(COPY + COPY)
    top.mockRestore()
  })

  it("never starts hidden when already in view", async () => {
    setup()
    const { container } = render(<DisplayTitle effect="oval">{COPY}</DisplayTitle>)
    await settle()
    expect(container.querySelector<HTMLElement>('[data-slot="display-title-visual"]')!.style.opacity).toBe("")
  })

  it("oval opens an ellipse over 1.5s on power2.inOut and ends within 1.8s", async () => {
    setup()
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
      return Array.from(this.parentElement?.querySelectorAll('[data-piece="word"]') ?? []).indexOf(this) * 40
    })
    render(<DisplayTitle effect="oval">{COPY}</DisplayTitle>)
    await settle()
    await enter()
    expect(calls.length).toBeGreaterThan(2)
    for (const c of calls) {
      expect(c.options.duration).toBe(1500)
      expect(c.options.easing).toBe("cubic-bezier(0.45, 0, 0.55, 1)")
      expect(Number(c.options.delay) + 1500).toBeLessThanOrEqual(1800)
    }
  })

  it("skew plays characters from 992px up and falls back to mask below", async () => {
    setup({ width: 1280 })
    const wide = render(<DisplayTitle effect="skew">Hi</DisplayTitle>)
    await settle()
    expect(wide.container.querySelector('[data-slot="display-title"]')!.getAttribute("data-variant")).toBe("skew")
    await enter()
    expect(calls).toHaveLength(2)
    expect(String(calls[0].frames[0].transform)).toContain("skewX(14deg)")
    wide.unmount()

    setup({ width: 800 })
    const narrow = render(<DisplayTitle effect="skew">Hi</DisplayTitle>)
    await settle()
    expect(narrow.container.querySelector('[data-slot="display-title"]')!.getAttribute("data-variant")).toBe("mask")
    await enter()
    expect(calls.every((c) => c.frames[0].transform === "translateY(110%)")).toBe(true)
  })

  it("blink flickers 0,1,0,1 over 210ms, on load too", async () => {
    setup({ offscreen: true })
    render(<DisplayTitle effect="blink" trigger="load">{COPY}</DisplayTitle>)
    await settle()
    expect(calls).toHaveLength(1)
    expect(calls[0].frames.map((f) => f.opacity)).toEqual([0, 1, 0, 1])
    expect(calls[0].options.duration).toBe(210)
  })

  it("trigger load plays without waiting for the viewport", async () => {
    setup({ offscreen: true })
    render(<DisplayTitle effect="mask" split="word" trigger="load">{COPY}</DisplayTitle>)
    await settle()
    expect(calls.length).toBeGreaterThan(0)
  })

  it("scramble settles to the exact text, leaves the accessible name alone, and stops the clock", async () => {
    setup()
    const frames = fakeFrames()
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(frames.request as never)
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(frames.cancel as never)
    const { container } = render(<DisplayTitle as="h1" effect="scramble">Make it liquid</DisplayTitle>)
    await settle()
    await enter()
    const visual = container.querySelector('[data-slot="display-title-visual"]')!
    expect(visual.textContent).not.toBe("Make it liquid")
    expect(screen.getByRole("heading", { name: "Make it liquid" })).toBeTruthy()
    let t = 0
    for (let i = 0; i < 100; i++) frames.flush((t += 16))
    expect(visual.textContent).toBe("Make it liquid")
    expect(screen.getByRole("heading", { name: "Make it liquid" })).toBeTruthy()
  })

  it("swap names the sentence with the first word, cycles, and holds on hover, focus and the paused prop", async () => {
    setup()
    vi.useFakeTimers()
    const { container, rerender } = render(<DisplayTitle as="h1" effect="swap" words={["calm", "bright", "exact"]} interval={2000}>{"Design that feels {word}."}</DisplayTitle>)
    await settle()
    expect(screen.getByRole("heading", { name: "Design that feels calm." })).toBeTruthy()
    const active = () => Array.from(container.querySelectorAll('[data-piece="swap-word"][data-state="active"]')).map((n) => n.textContent)
    expect(active()).toEqual(["calm"])
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(active()).toEqual(["bright"])
    expect(calls).toHaveLength(2)

    const title = container.querySelector('[data-slot="display-title"]')!
    act(() => { title.dispatchEvent(new Event("pointerenter")) })
    await act(async () => { vi.advanceTimersByTime(4000) })
    expect(active()).toEqual(["bright"])
    act(() => { title.dispatchEvent(new Event("pointerleave")) })
    act(() => { title.dispatchEvent(new Event("focusin", { bubbles: true })) })
    await act(async () => { vi.advanceTimersByTime(4000) })
    expect(active()).toEqual(["bright"])
    act(() => { title.dispatchEvent(new Event("focusout", { bubbles: true })) })
    rerender(<DisplayTitle as="h1" effect="swap" words={["calm", "bright", "exact"]} interval={2000} paused>{"Design that feels {word}."}</DisplayTitle>)
    await act(async () => { vi.advanceTimersByTime(4000) })
    expect(active()).toEqual(["bright"])
    rerender(<DisplayTitle as="h1" effect="swap" words={["calm", "bright", "exact"]} interval={2000}>{"Design that feels {word}."}</DisplayTitle>)
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(active()).toEqual(["exact"])
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(active()).toEqual(["calm"])
  })

  it("swap is static under reduced motion, showing the first word", async () => {
    setup({ reduced: true })
    vi.useFakeTimers()
    const { container } = render(<DisplayTitle effect="swap" words={["calm", "bright"]}>{"Design that feels {word}."}</DisplayTitle>)
    await settle()
    await act(async () => { vi.advanceTimersByTime(10000) })
    expect(container.textContent).toBe("Design that feels calm.")
    expect(calls).toHaveLength(0)
  })

  it("swap without words is a plain rise title", async () => {
    setup()
    const { container } = render(<DisplayTitle effect="swap">{COPY}</DisplayTitle>)
    await settle()
    expect(container.querySelector('[data-slot="display-title"]')!.getAttribute("data-variant")).toBe("word")
  })

  it("every classed element has a data-slot in every effect", async () => {
    for (const effect of EFFECTS) {
      setup()
      const { container, unmount } = render(<DisplayTitle effect={effect} split="char">Slots ok</DisplayTitle>)
      await settle()
      await enter()
      for (const el of container.querySelectorAll("[class]")) expect(el.getAttribute("data-slot")).toBeTruthy()
      unmount()
    }
  })

  describe("fits its box (docs/visual-system.md section 14.1)", () => {
    const LONG = "Die Donaudampfschifffahrtsgesellschaft is making moments"

    it("writes nothing for a title whose words are all within the measure, so it renders as before", () => {
      const html = renderToStaticMarkup(<DisplayTitle as="h1">I design interfaces that compose themselves.</DisplayTitle>)
      expect(html).toBe('<h1 data-slot="display-title" data-variant="word" data-split="word" class="type-display-l text-fg-primary">I design interfaces that compose themselves.</h1>')
    })

    it("writes the longest run as --fit-chars, and sets a long word as one fit-word in the plain title", () => {
      const html = renderToStaticMarkup(<DisplayTitle as="h1" style={{ color: "red" }}>{LONG}</DisplayTitle>)
      expect(html).toContain('style="--fit-chars:34;color:red"')
      expect(html).toContain('<span data-slot="fit-word" class="fit-word">Donaudampfschifffahrtsgesellschaft</span> is making moments')
    })

    it("sets a long word's piece as a fit-word in every split, the short ones still unbreakable", async () => {
      stubMotion(false)
      for (const effect of ["rise", "mask"] as DisplayEffect[]) {
        const { container, unmount } = render(<DisplayTitle effect={effect} split="word">{LONG}</DisplayTitle>)
        await settle()
        const words = [...container.querySelectorAll<HTMLElement>('[data-piece="word"]')]
        const long = words.find((w) => w.textContent === "Donaudampfschifffahrtsgesellschaft")!
        expect(long.className, effect).toContain("fit-word")
        expect(long.className, effect).not.toContain("whitespace-nowrap")
        for (const w of words.filter((w) => w !== long)) expect(w.className, effect).toContain("whitespace-nowrap")
        unmount()
      }
    })

    it("counts the swap's words in --fit-chars and lets a long one wrap in its slot", async () => {
      stubMotion(false)
      const { container } = render(
        <DisplayTitle effect="swap" words={["Rechtsschutzversicherungsgesellschaften", "calm"]}>
          {"Interfaces that feel {word}."}
        </DisplayTitle>
      )
      await settle()
      const title = container.querySelector<HTMLElement>('[data-slot="display-title"]')!
      expect(title.style.getPropertyValue("--fit-chars")).toBe("39")
      expect(container.querySelector('[data-slot="display-title-swap"]')!.className).toContain("max-w-full")
      expect(container.querySelector('[data-piece="swap-word"][data-state="active"]')!.className).toContain("fit-word")
    })
  })
})
