import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { staggerDelays } from "../core/motion"
import { DisplayTitle } from "./display-title"

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
