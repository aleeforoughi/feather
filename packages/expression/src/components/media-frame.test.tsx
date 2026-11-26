import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MediaFrame } from "./media-frame"

const stubMotion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }))
afterEach(() => vi.unstubAllGlobals())
const settle = () => act(async () => {})
const img = (c: HTMLElement) => c.querySelector("img")!

describe("MediaFrame image", () => {
  it("renders an image with alt text and the aspect through inline style", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="A harbour" aspect="4/5" />)
    await settle()
    expect(screen.getByAltText("A harbour")).toBeTruthy()
    expect(container.querySelector<HTMLElement>('[data-slot="media-frame"]')!.style.aspectRatio).toBe("4/5")
  })

  it("decorative gives empty alt", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" decorative alt="ignored" />)
    await settle()
    expect(img(container).getAttribute("alt")).toBe("")
  })

  it("priority is eager with high fetch priority, never lazy", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="Hero" priority />)
    await settle()
    const el = img(container)
    expect(el.getAttribute("loading")).toBe("eager")
    expect(el.getAttribute("fetchpriority")).toBe("high")
    expect(el.getAttribute("decoding")).toBe("async")
  })

  it("otherwise lazy, with no high priority", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="Below" />)
    await settle()
    expect(img(container).getAttribute("loading")).toBe("lazy")
    expect(img(container).getAttribute("fetchpriority")).toBeNull()
  })

  it("lists picture sources in order before the fallback img", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" sources={[{ src: "/a.avif", type: "image/avif" }, { src: "/a.webp", type: "image/webp" }]} />)
    await settle()
    const sources = container.querySelectorAll("picture source")
    expect(Array.from(sources, (s) => s.getAttribute("type"))).toEqual(["image/avif", "image/webp"])
    expect(sources[0].getAttribute("srcset")).toBe("/a.avif")
  })

  it("scales on hover from 1 with motion-media, and back with motion-hover-out", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" />)
    await settle()
    const frame = container.querySelector('[data-slot="media-frame"]')!
    expect(img(container).className).toContain("motion-hover-out")
    expect(img(container).style.scale).toBe("1")
    fireEvent.pointerEnter(frame)
    expect(img(container).className).toContain("motion-media")
    expect(Number(img(container).style.scale)).toBeGreaterThan(1)
    fireEvent.pointerLeave(frame)
    expect(img(container).style.scale).toBe("1")
  })

  it("does not scale on hover under reduced motion", async () => {
    stubMotion(true)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" />)
    await settle()
    fireEvent.pointerEnter(container.querySelector('[data-slot="media-frame"]')!)
    expect(img(container).style.scale).toBe("1")
  })

  it("has a data-slot on every classed element", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" video={{ loop: true, autoPlay: true }} />)
    await settle()
    for (const el of container.querySelectorAll("[class]")) expect(el.getAttribute("data-slot")).toBeTruthy()
  })
})

describe("MediaFrame video", () => {
  // Like a browser: play() and pause() fire the element's play and pause events, and set `paused`.
  const play = vi.fn(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: false })
    this.dispatchEvent(new Event("play"))
    return Promise.resolve()
  })
  const pause = vi.fn(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: true })
    this.dispatchEvent(new Event("pause"))
  })
  const patch = () => {
    play.mockClear()
    pause.mockClear()
    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play })
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pause })
  }

  it("autoplays when motion is allowed and shows a named pause button for a long loop", async () => {
    stubMotion(false)
    patch()
    render(<MediaFrame alt="Clip" src="/c.mp4" video={{ autoPlay: true, loop: true, poster: "/p.jpg", duration: 12 }} />)
    await settle()
    expect(play).toHaveBeenCalled()
    const button = screen.getByRole("button", { name: "Pause video" })
    expect(button.className).toContain("hit-area")
    fireEvent.click(button)
    expect(pause).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Play video" })).toBeTruthy()
  })

  it("has no pause button for a short loop", async () => {
    stubMotion(false)
    patch()
    render(<MediaFrame alt="Clip" src="/c.mp4" video={{ autoPlay: true, loop: true, duration: 4 }} />)
    await settle()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("does not autoplay under reduced motion: poster and a play button", async () => {
    stubMotion(true)
    patch()
    const { container } = render(<MediaFrame alt="Clip" src="/c.mp4" video={{ autoPlay: true, loop: true, poster: "/p.jpg" }} />)
    await settle()
    expect(play).not.toHaveBeenCalled()
    expect(container.querySelector("video")!.getAttribute("poster")).toBe("/p.jpg")
    expect(screen.getByRole("button", { name: "Play video" })).toBeTruthy()
  })

  it("renders video sources with their types", async () => {
    stubMotion(false)
    patch()
    const { container } = render(<MediaFrame alt="Clip" video={{ autoPlay: true }} sources={[{ src: "/c.mp4", type: 'video/mp4; codecs="hvc1"' }, { src: "/c.webm", type: 'video/webm; codecs="vp9"' }]} />)
    await settle()
    expect(container.querySelectorAll("video source")).toHaveLength(2)
    expect(container.querySelector('[data-slot="media-frame"]')!.getAttribute("data-variant")).toBe("video")
  })
})

describe("MediaFrame placeholder", () => {
  it("paints the theme's surface until the image is ready, with no script (a class on the frame)", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" />)
    const frame = container.querySelector('[data-slot="media-frame"]')!
    expect(frame.className).toContain("bg-surface-subtle")
    await settle()
    // Mounted, not yet decoded: loading; the load event makes it ready (foundation.css then drops the background).
    expect(frame.getAttribute("data-state")).toBe("loading")
    fireEvent.load(img(container))
    expect(frame.getAttribute("data-state")).toBe("ready")
  })

  it("is ready at once when the image decoded before the script ran", async () => {
    stubMotion(false)
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true)
    const width = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(800)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" />)
    await settle()
    expect(container.querySelector('[data-slot="media-frame"]')!.getAttribute("data-state")).toBe("ready")
    complete.mockRestore()
    width.mockRestore()
  })

  it("film frames take the scrim", () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" placeholder="scrim" />)
    const frame = container.querySelector('[data-slot="media-frame"]')!
    expect(frame.className).toContain("media-placeholder-scrim")
    expect(frame.className).not.toContain("bg-surface-subtle")
    expect(frame.getAttribute("data-placeholder")).toBe("scrim")
  })
})

describe("MediaFrame treatments", () => {
  it("clean writes nothing extra", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" treatment="clean" />)
    await settle()
    const frame = container.querySelector('[data-slot="media-frame"]')!
    expect(frame.hasAttribute("data-treatment")).toBe(false)
    expect(container.querySelector("style")).toBeNull()
  })

  it("duotone and grain are still layers over the image, hidden from assistive technology", async () => {
    stubMotion(false)
    const duo = render(<MediaFrame src="/a.jpg" alt="x" treatment="duotone" />)
    expect(duo.container.querySelector('[data-slot="media-frame-duotone"]')?.getAttribute("aria-hidden")).toBe("true")
    expect(img(duo.container).className).toContain("grayscale")
    duo.unmount()
    const grain = render(<MediaFrame src="/a.jpg" alt="x" treatment="grain" />)
    const layer = grain.container.querySelector<HTMLElement>('[data-slot="media-frame-grain"]')!
    expect(layer.className).toContain("film-grain")
    expect(layer.style.opacity).toContain("0.16")
    expect(img(grain.container).getAttribute("alt")).toBe("x")
  })

  it("the moving ones rest under reduced motion and on the LCP image", async () => {
    stubMotion(true)
    const reduced = render(<MediaFrame src="/a.jpg" alt="x" treatment="clip-reveal" />)
    await settle()
    expect(reduced.container.querySelector('[data-slot="media-frame"]')!.hasAttribute("data-treatment-state")).toBe(false)
    reduced.unmount()
    stubMotion(false)
    const lcp = render(<MediaFrame src="/a.jpg" alt="x" treatment="inner-parallax" priority />)
    await settle()
    expect(lcp.container.querySelector('[data-slot="media-frame"]')!.hasAttribute("data-treatment-state")).toBe(false)
  })

  it("clip-reveal runs on the reveal role where the browser has no scroll timeline", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" treatment="clip-reveal" />)
    await settle()
    const frame = container.querySelector('[data-slot="media-frame"]')!
    expect(frame.getAttribute("data-treatment")).toBe("clip-reveal")
    expect(frame.getAttribute("data-treatment-state")).toBe("script")
  })

  it("a video is always clean", async () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/c.mp4" alt="x" video={{}} treatment="duotone" />)
    await settle()
    expect(container.querySelector('[data-slot="media-frame"]')!.hasAttribute("data-treatment")).toBe(false)
  })
})

describe("MediaFrame widths", () => {
  it("writes srcset and sizes on the image, and on a picture source with its own widths", () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" priority srcSet="/a-800.jpg 800w, /a-1600.jpg 1600w" sizes="100vw" sources={[{ src: "/a.avif", type: "image/avif", srcSet: "/a-800.avif 800w" }]} />)
    expect(img(container).getAttribute("srcset")).toBe("/a-800.jpg 800w, /a-1600.jpg 1600w")
    expect(img(container).getAttribute("sizes")).toBe("100vw")
    expect(img(container).getAttribute("fetchpriority")).toBe("high")
    const source = container.querySelector("source")!
    expect(source.getAttribute("srcset")).toBe("/a-800.avif 800w")
    expect(source.getAttribute("sizes")).toBe("100vw")
  })

  it("writes no sizes without a srcset", () => {
    stubMotion(false)
    const { container } = render(<MediaFrame src="/a.jpg" alt="x" sizes="100vw" />)
    expect(img(container).hasAttribute("sizes")).toBe(false)
    expect(img(container).hasAttribute("srcset")).toBe(false)
  })
})
