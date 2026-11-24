import { act, fireEvent, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { mockMedia, REDUCED } from "../test/helpers"
import { PARALLAX_MAX_TRAVEL, parallaxTravel, ScrollLayers, STACK_SCALE } from "./scroll-layers"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const settle = () => act(async () => {})
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html")

const Parallax = () => (
  <ScrollLayers variant="parallax" aria-label="Dunes at dusk">
    <ScrollLayers.Layer depth={0.8}>
      <div>sky</div>
    </ScrollLayers.Layer>
    <ScrollLayers.Layer depth={1.2}>
      <div>dunes</div>
    </ScrollLayers.Layer>
    <h2>Still title</h2>
  </ScrollLayers>
)

describe("ScrollLayers parallax", () => {
  it("bounds travel to ±15% for depths 0.8 to 1.2", () => {
    expect(PARALLAX_MAX_TRAVEL).toBe(15)
    expect(parallaxTravel(1)).toBe(0)
    expect(parallaxTravel(0.8)).toBe(-15)
    expect(parallaxTravel(1.2)).toBe(15)
    expect(parallaxTravel(1.1)).toBe(7.5)
    expect(parallaxTravel(3)).toBe(15)
    expect(parallaxTravel(0)).toBe(-15)
    expect(parallaxTravel(Number.NaN)).toBe(0)
  })

  it("uses the CSS view timeline where supported, and writes nothing inline", async () => {
    mockMedia([])
    vi.stubGlobal("CSS", { supports: (q: string) => q.includes("animation-timeline") })
    const { container } = render(<Parallax />)
    await settle()
    const root = container.querySelector('[data-slot="scroll-layers"]')!
    expect(root.getAttribute("data-state")).toBe("css")
    const layers = container.querySelectorAll<HTMLElement>('[data-slot="scroll-layers-layer"]')
    expect(layers[0].style.getPropertyValue("--layer-travel")).toBe("-15%")
    expect(layers[1].style.getPropertyValue("--layer-travel")).toBe("15%")
    for (const layer of layers) expect(layer.style.transform).toBe("")
    const css = document.querySelector('style[data-href="feather-scroll-layers"], style[href="feather-scroll-layers"]')?.textContent ?? ""
    expect(css).toContain("@supports (animation-timeline: view())")
    expect(css).toContain("prefers-reduced-motion: no-preference")
  })

  it("falls back to the one clock's scrub without timeline support", async () => {
    mockMedia([])
    const { container } = render(<Parallax />)
    await settle()
    expect(container.querySelector('[data-slot="scroll-layers"]')!.getAttribute("data-state")).toBe("scrub")
    const layers = container.querySelectorAll<HTMLElement>('[data-slot="scroll-layers-layer"]')
    expect(layers[0].style.transform).toMatch(/^translate3d\(0, -?\d/)
  })

  it("rests under reduced motion and on the server: no transforms, content in order", async () => {
    mockMedia([REDUCED])
    vi.stubGlobal("CSS", { supports: () => true })
    const { container } = render(<Parallax />)
    await settle()
    expect(container.querySelector('[data-slot="scroll-layers"]')!.getAttribute("data-state")).toBe("static")
    for (const layer of container.querySelectorAll<HTMLElement>('[data-slot="scroll-layers-layer"]')) expect(layer.style.transform).toBe("")
    const doc = parse(renderToString(<Parallax />))
    expect(doc.querySelector('[data-slot="scroll-layers"]')?.getAttribute("data-state")).toBe("static")
    expect(doc.body.textContent).toContain("skydunesStill title")
  })
})

const cards = ["Plan", "Build", "Ship"].map((t) => (
  <article key={t}>
    <h3>{t}</h3>
  </article>
))

describe("ScrollLayers stack", () => {
  it("sticks each card a spacing step below the last, with a dim layer hidden from assistive technology", async () => {
    mockMedia([])
    const { container } = render(<ScrollLayers variant="stack">{cards}</ScrollLayers>)
    await settle()
    const items = container.querySelectorAll<HTMLElement>('[data-slot="scroll-layers-card"]')
    expect(items).toHaveLength(3)
    expect(items[0].className).toContain("sticky")
    expect(items[0].style.top).toBe("calc(var(--layout-margin) + var(--spacing) * 0)")
    expect(items[2].style.top).toBe("calc(var(--layout-margin) + var(--spacing) * 8)")
    for (const dim of container.querySelectorAll('[data-slot="scroll-layers-card-dim"]')) expect(dim.getAttribute("aria-hidden")).toBe("true")
    expect(STACK_SCALE).toBe(0.95)
  })

  it("scales and dims an earlier card as the next one arrives", async () => {
    mockMedia([])
    const tops = [16, 48, 900]
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const items = [...document.querySelectorAll('[data-slot="scroll-layers-card"]')]
      const i = items.indexOf(this)
      return { top: i >= 0 ? tops[i] : 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} } as DOMRect
    })
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(400)
    const { container } = render(<ScrollLayers variant="stack">{cards}</ScrollLayers>)
    await settle()
    const items = container.querySelectorAll<HTMLElement>('[data-slot="scroll-layers-card"]')
    // The second card is 32px below the first's 400px: 92% of the way over it.
    expect(items[0].style.transform).toBe(`scale(${(1 - 0.05 * 0.92).toFixed(4)})`)
    expect(items[1].style.transform).toBe("")
    expect(items[2].style.transform).toBe("")
  })

  it("is a plain stack in normal flow under reduced motion", async () => {
    mockMedia([REDUCED])
    const { container } = render(<ScrollLayers variant="stack">{cards}</ScrollLayers>)
    await settle()
    for (const item of container.querySelectorAll<HTMLElement>('[data-slot="scroll-layers-card"]')) {
      expect(item.className).not.toContain("sticky")
      expect(item.style.top).toBe("")
    }
  })
})

const panels = ["One", "Two", "Three"].map((t) => (
  <a key={t} href={`#${t}`}>
    {t}
  </a>
))

describe("ScrollLayers horizontal", () => {
  const expectRail = (container: HTMLElement) => {
    const root = container.querySelector('[data-slot="scroll-layers"]')!
    expect(root.getAttribute("data-state")).toBe("rail")
    const rail = screen.getByRole("region", { name: "Selected work" })
    expect(rail.getAttribute("tabindex")).toBe("0")
    expect(rail.className).toContain("snap-x")
    expect(rail.className).toContain("snap-mandatory")
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy()
    expect(container.querySelector('[data-slot="scroll-layers-track"]')).toBeNull()
  }

  it("is a native snap rail on a coarse pointer", async () => {
    mockMedia(["pointer: coarse"])
    const { container } = render(<ScrollLayers variant="horizontal" aria-label="Selected work">{panels}</ScrollLayers>)
    await settle()
    expectRail(container)
  })

  it("is a native snap rail under reduced motion, even with a fine pointer", async () => {
    mockMedia(["pointer: fine", REDUCED])
    const { container } = render(<ScrollLayers variant="horizontal" aria-label="Selected work">{panels}</ScrollLayers>)
    await settle()
    expectRail(container)
  })

  it("server-renders the rail", () => {
    const doc = parse(renderToString(<ScrollLayers variant="horizontal" aria-label="Selected work">{panels}</ScrollLayers>))
    expect(doc.querySelector('[data-slot="scroll-layers"]')?.getAttribute("data-state")).toBe("rail")
    expect(doc.querySelector('[role="region"]')?.getAttribute("aria-label")).toBe("Selected work")
  })

  it("pins a row driven by vertical scroll on a fine pointer, and focus brings a panel into view", async () => {
    mockMedia(["pointer: fine"])
    const scrollTo = vi.fn()
    vi.stubGlobal("scrollTo", scrollTo)
    const { container } = render(
      <ScrollLayers variant="horizontal" aria-label="Selected work" length={3}>
        {panels}
      </ScrollLayers>
    )
    await settle()
    expect(container.querySelector('[data-slot="scroll-layers"]')!.getAttribute("data-state")).toBe("scrub")
    expect(container.querySelector<HTMLElement>('[data-slot="scroll-layers-track"]')!.style.height).toBe("300vh")
    expect(container.querySelector('[data-slot="scroll-layers-frame"]')!.className).toContain("sticky")
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(3000)
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockReturnValue(1500)
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(3000)
    fireEvent.focus(screen.getByRole("link", { name: "Three" }))
    expect(scrollTo).toHaveBeenCalled()
  })
})

describe("ScrollLayers scale", () => {
  const media = <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="The atelier at night" />

  it("starts the media inset and rounded, with the caption outside the scaled layer", async () => {
    mockMedia([])
    const { container } = render(
      <ScrollLayers variant="scale" length={3} caption={<p>Open late</p>}>
        {media}
      </ScrollLayers>
    )
    await settle()
    const layer = container.querySelector<HTMLElement>('[data-slot="scroll-layers-media"]')!
    expect(container.querySelector<HTMLElement>('[data-slot="scroll-layers-track"]')!.style.height).toBe("300vh")
    expect(layer.style.clipPath).toMatch(/^inset\(/)
    expect(layer.contains(screen.getByText("Open late"))).toBe(false)
    expect(screen.getByRole("img", { name: "The atelier at night" })).toBeTruthy()
  })

  it("shows the media at full size at once under reduced motion", async () => {
    mockMedia([REDUCED])
    const { container } = render(
      <ScrollLayers variant="scale" caption={<p>Open late</p>}>
        {media}
      </ScrollLayers>
    )
    await settle()
    const layer = container.querySelector<HTMLElement>('[data-slot="scroll-layers-media"]')!
    expect(layer.style.clipPath).toBe("")
    expect(container.querySelector(".sticky")).toBeNull()
    expect(layer.contains(screen.getByText("Open late"))).toBe(false)
  })
})

describe("ScrollLayers", () => {
  it("has a data-slot on every classed element in every variant and tier", async () => {
    for (const media of [[], [REDUCED], ["pointer: fine"]]) {
      mockMedia(media)
      for (const variant of ["parallax", "stack", "horizontal", "scale"] as const) {
        const { container, unmount } = render(
          <ScrollLayers variant={variant} aria-label="Section" caption="Caption">
            {variant === "parallax" ? <ScrollLayers.Layer depth={0.9}>x</ScrollLayers.Layer> : cards}
          </ScrollLayers>
        )
        await settle()
        for (const el of container.querySelectorAll("[class]")) expect(el.getAttribute("data-slot"), `${variant}: ${el.outerHTML.slice(0, 80)}`).toBeTruthy()
        unmount()
      }
    }
  })
})
