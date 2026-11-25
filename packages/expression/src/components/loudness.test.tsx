import { act, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as revealModule from "../core/reveal"
import { DisplayTitle } from "./display-title"
import { ImageSequence } from "./image-sequence"
import { declaredLoudness, loudnessAllows } from "./loudness"
import { ScrollLayers } from "./scroll-layers"
import { Section } from "./section"
import { Stage } from "./stage"
import { World } from "./world"

vi.mock("../core/reveal", async (original) => {
  const actual = await original<typeof import("../core/reveal")>()
  return { ...actual, reveal: vi.fn(actual.reveal) }
})

const stubMotion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(revealModule.reveal).mockClear()
  document.documentElement.style.removeProperty("--loudness")
})
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve() })
const at = (level: number | null, node: React.ReactNode) => (level === null ? <div>{node}</div> : <div data-loudness={level}>{node}</div>)

describe("declared loudness", () => {
  it("is null where nothing declares it, so components do what their props ask", () => {
    const el = document.createElement("div")
    document.body.append(el)
    expect(declaredLoudness(el)).toBeNull()
    expect(loudnessAllows(el, "scene")).toBe(true)
    el.remove()
  })

  it("reads the nearest data-loudness, then the brand's --loudness", () => {
    const outer = document.createElement("div")
    outer.dataset.loudness = "3"
    const inner = document.createElement("div")
    inner.dataset.loudness = "0"
    const leaf = document.createElement("span")
    inner.append(leaf)
    outer.append(inner)
    document.body.append(outer)
    expect(declaredLoudness(leaf)).toBe(0)
    expect(loudnessAllows(leaf, "reveal")).toBe(false)
    inner.remove()
    document.documentElement.style.setProperty("--loudness", "2")
    const free = document.createElement("p")
    document.body.append(free)
    expect(declaredLoudness(free)).toBe(2)
    expect(loudnessAllows(free, "scroll")).toBe(true)
    expect(loudnessAllows(free, "scene")).toBe(false)
    free.remove()
    outer.remove()
  })
})

describe("Section", () => {
  it.each([[null, 1], [1, 1], [3, 1], [0, 0]] as const)("at loudness %s reveals %s time(s)", async (level, calls) => {
    stubMotion(false)
    render(at(level, <Section aria-label="A">content</Section>))
    await settle()
    expect(vi.mocked(revealModule.reveal)).toHaveBeenCalledTimes(calls)
  })
})

describe("DisplayTitle", () => {
  const variant = (c: HTMLElement) => c.querySelector('[data-slot="display-title"]')!.getAttribute("data-variant")
  const visual = (c: HTMLElement) => c.querySelector('[data-slot="display-title-visual"]')

  it("plays kinetic effects at 2 and up, and where nothing is declared", async () => {
    stubMotion(false)
    for (const level of [null, 2, 3]) {
      const { container, unmount } = render(at(level, <DisplayTitle effect="mask">Make it liquid</DisplayTitle>))
      await settle()
      expect(variant(container)).toBe("mask")
      unmount()
    }
  })

  it("falls back to rise at 1", async () => {
    stubMotion(false)
    for (const effect of ["mask", "skew", "oval", "blink", "scramble"] as const) {
      const { container, unmount } = render(at(1, <DisplayTitle effect={effect}>Make it liquid</DisplayTitle>))
      await settle()
      expect(variant(container)).toBe("word")
      expect(visual(container)).not.toBeNull()
      unmount()
    }
    const swap = render(at(1, <DisplayTitle effect="swap" words={["liquid", "kind"]}>{"Make it {word}"}</DisplayTitle>))
    await settle()
    expect(variant(swap.container)).toBe("word")
  })

  it("is plain at 0: no pieces and no reveal", async () => {
    stubMotion(false)
    const { container } = render(at(0, <DisplayTitle as="h1" effect="scramble">Make it liquid</DisplayTitle>))
    await settle()
    expect(visual(container)).toBeNull()
    expect(container.querySelector("h1")!.textContent).toBe("Make it liquid")
  })

  it("stays plain under reduced motion at any loudness", async () => {
    stubMotion(true)
    const { container } = render(at(3, <DisplayTitle effect="mask">Make it liquid</DisplayTitle>))
    await settle()
    expect(visual(container)).toBeNull()
  })
})

describe("scroll choreography needs loudness 2", () => {
  const cards = [<div key="a">One</div>, <div key="b">Two</div>]

  it("ScrollLayers rests in its static form below 2 and moves at 2", async () => {
    stubMotion(false)
    for (const [level, state] of [[1, "static"], [0, "static"], [2, "scrub"], [null, "scrub"]] as const) {
      const { container, unmount } = render(at(level, <ScrollLayers variant="stack">{cards}</ScrollLayers>))
      await settle()
      expect(container.querySelector('[data-slot="scroll-layers"]')!.getAttribute("data-state")).toBe(state)
      unmount()
    }
    const scale = render(at(1, <ScrollLayers variant="scale"><img src="a.jpg" alt="" /></ScrollLayers>))
    await settle()
    expect(scale.container.querySelector('[data-slot="scroll-layers"]')!.getAttribute("data-state")).toBe("static")
  })

  it("Stage does not pin below 2", async () => {
    stubMotion(false)
    for (const [level, variant] of [[1, "static"], [2, "pinned"]] as const) {
      const { container, unmount } = render(at(level, <Stage steps={["One", "Two"]}>{() => <p>scene</p>}</Stage>))
      await settle()
      expect(container.querySelector('[data-slot="stage"]')!.getAttribute("data-variant")).toBe(variant)
      unmount()
    }
  })

  it("ImageSequence keeps its poster below 2", async () => {
    stubMotion(false)
    for (const [level, variant] of [[1, "poster"], [2, "scrubbed"]] as const) {
      const { container, unmount } = render(at(level, <ImageSequence frames={["a.webp", "b.webp", "c.webp"]} poster="p.webp" alt="A turn of the product" />))
      await settle()
      expect(container.querySelector('[data-slot="image-sequence"]')!.getAttribute("data-variant")).toBe(variant)
      unmount()
    }
  })

  it("reduced motion is stronger than loudness 3", async () => {
    stubMotion(true)
    const { container } = render(at(3, <ScrollLayers variant="stack">{cards}</ScrollLayers>))
    await settle()
    expect(container.querySelector('[data-slot="scroll-layers"]')!.getAttribute("data-state")).toBe("static")
  })
})

describe("World needs loudness 3", () => {
  const renderer = { frame: () => false }
  it("keeps its still below 3", async () => {
    stubMotion(false)
    for (const [level, still] of [[2, true], [3, false]] as const) {
      const { container, unmount } = render(at(level, <World renderer={renderer} quality="high" still="still.jpg" />))
      await settle()
      expect(container.querySelector('[data-slot="world"]')!.getAttribute("data-variant") === "static").toBe(still)
      unmount()
    }
  })
})
