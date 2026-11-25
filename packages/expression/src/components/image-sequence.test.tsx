import { act, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clock } from "../core/clock"
import { mockMedia, REDUCED } from "../test/helpers"
import { ImageSequence } from "./image-sequence"

const frames = Array.from({ length: 24 }, (_, i) => `data:image/svg+xml,frame-${i}`)
const small = Array.from({ length: 12 }, (_, i) => `data:image/svg+xml,small-${i}`)
const POSTER = "data:image/svg+xml,poster"
const ALT = "A ceramic cup turning once on a stone table"

const settle = () => act(async () => {})

beforeEach(() => {
  // No real frames run in jsdom: the clock's frames never fire, and the canvas has no 2D context.
  vi.stubGlobal("requestAnimationFrame", () => 1)
  vi.stubGlobal("cancelAnimationFrame", () => {})
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("ImageSequence", () => {
  it("server-renders the poster with its alt and no canvas", () => {
    const html = renderToString(<ImageSequence frames={frames} poster={POSTER} alt={ALT} />)
    const doc = new DOMParser().parseFromString(html, "text/html")
    const img = doc.querySelector("img")
    expect(img?.getAttribute("src")).toBe(POSTER)
    expect(img?.getAttribute("alt")).toBe(ALT)
    expect(img?.getAttribute("loading")).toBeNull()
    expect(doc.querySelector("canvas")).toBeNull()
    expect(doc.querySelector('[data-slot="image-sequence"]')?.getAttribute("data-variant")).toBe("poster")
  })

  it("is the poster alone under reduced motion: no pin, no canvas, no frames requested", async () => {
    mockMedia([REDUCED])
    const created = vi.spyOn(globalThis, "Image")
    const { container } = render(<ImageSequence frames={frames} poster={POSTER} alt={ALT} />)
    await settle()
    expect(screen.getByRole("img", { name: ALT }).getAttribute("src")).toBe(POSTER)
    expect(container.querySelector("canvas")).toBeNull()
    expect(container.querySelector(".sticky")).toBeNull()
    expect(created).not.toHaveBeenCalled()
  })

  it("is the poster alone on data saver", async () => {
    mockMedia([])
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } })
    try {
      const { container } = render(<ImageSequence frames={frames} poster={POSTER} alt={ALT} />)
      await settle()
      expect(container.querySelector("canvas")).toBeNull()
    } finally {
      delete (navigator as { connection?: unknown }).connection
    }
  })

  it("pins a decorative canvas over the poster, sized by the capped pixel ratio", async () => {
    mockMedia([])
    vi.stubGlobal("devicePixelRatio", 3)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300, x: 0, y: 0, toJSON() {} } as DOMRect)
    const { container } = render(<ImageSequence frames={frames} poster={POSTER} alt={ALT} length={3} />)
    await settle()
    const root = container.querySelector('[data-slot="image-sequence"]')!
    expect(root.getAttribute("data-variant")).toBe("scrubbed")
    expect(container.querySelector<HTMLElement>('[data-slot="image-sequence-track"]')!.style.height).toBe("300vh")
    const canvas = container.querySelector("canvas")!
    expect(canvas.getAttribute("aria-hidden")).toBe("true")
    // A fine pointer is the high tier: a ratio of 3 is capped at 2.
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
    expect(screen.getByRole("img", { name: ALT })).toBeTruthy()
  })

  it("caps a phone at 1.5 and uses the lighter frame set below 768px", async () => {
    mockMedia(["pointer: coarse", "max-width: 767px"])
    vi.stubGlobal("devicePixelRatio", 3)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 0, left: 0, right: 390, bottom: 844, width: 390, height: 844, x: 0, y: 0, toJSON() {} } as DOMRect)
    const requested: string[] = []
    vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation((url: string) => {
      if (url.startsWith("data:image/svg+xml,small") || url.startsWith("data:image/svg+xml,frame")) requested.push(url)
    })
    const { container } = render(<ImageSequence frames={frames} framesSmall={small} poster={POSTER} alt={ALT} />)
    await settle()
    const canvas = container.querySelector("canvas")!
    expect(canvas.width).toBe(585)
    // First and last of the small set, two at a time.
    expect(requested).toEqual([small[0], small[11]])
  })

  it("stops on unmount: off the clock, requests aborted", async () => {
    mockMedia([])
    const { unmount } = render(<ImageSequence frames={frames} poster={POSTER} alt={ALT} />)
    await settle()
    expect(clock.size).toBeGreaterThan(0)
    const abort = vi.spyOn(AbortController.prototype, "abort")
    unmount()
    expect(clock.size).toBe(0)
    expect(abort).toHaveBeenCalled()
  })

  it("leaves the clock while the tab is hidden", async () => {
    mockMedia([])
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false)
    const { unmount } = render(<ImageSequence frames={frames} poster={POSTER} alt={ALT} />)
    await settle()
    expect(clock.size).toBeGreaterThan(0)
    hidden.mockReturnValue(true)
    act(() => void document.dispatchEvent(new Event("visibilitychange")))
    expect(clock.size).toBe(0)
    hidden.mockReturnValue(false)
    act(() => void document.dispatchEvent(new Event("visibilitychange")))
    expect(clock.size).toBeGreaterThan(0)
    unmount()
  })

  it("has a data-slot on every classed element", async () => {
    for (const media of [[], [REDUCED]]) {
      mockMedia(media)
      const { container, unmount } = render(<ImageSequence frames={frames} poster={POSTER} alt={ALT} />)
      await settle()
      for (const el of container.querySelectorAll("[class]")) expect(el.getAttribute("data-slot")).toBeTruthy()
      unmount()
    }
  })
})
