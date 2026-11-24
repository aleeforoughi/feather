// Scroll: one clock (docs/visual-system.md section 14.4). Either CSS scroll-driven timelines with no library, or
// Lenis driven by the GSAP ticker, so smoothing, ScrollTrigger and every Feather subscriber share one loop. Feather
// ships neither library: a site passes its own Lenis constructor and GSAP, and Feather wires them the way file 23
// measured on the winners (lerp 0.1, native scroll on touch, lagSmoothing(0)). Under reduced motion there is no
// smoothing at all: the page scrolls natively.
import { clock, type Clock, type Ticker } from "./clock"
import { prefersReducedMotion } from "./motion"

/** The Lenis options Feather uses: lerp 0.1 on the wheel, native scroll on touch. */
export const LENIS_OPTIONS = Object.freeze({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: false })

export interface LenisLike {
  raf(time: number): void
  destroy(): void
}
export interface GsapLike {
  ticker: Ticker & { lagSmoothing(threshold: number, adjustedLag?: number): void }
}

export type ScrollEngine =
  | { kind: "native" }
  /** CSS `scroll()` / `view()` timelines: the browser runs them; there is nothing to drive. */
  | { kind: "css" }
  | { kind: "lenis"; create: (options: typeof LENIS_OPTIONS) => LenisLike; gsap?: GsapLike }

export interface ScrollConnection {
  /** What is actually running: "lenis" only when smoothing is on. */
  kind: "native" | "css" | "lenis"
  lenis: LenisLike | null
  disconnect(): void
}

/** Whether the browser runs CSS scroll-driven animations. */
export function supportsScrollTimeline(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline: view()")
}

/** Connects a scroll engine to the clock. Exactly one loop runs: the clock's own, or GSAP's ticker. */
export function connectScroll(engine: ScrollEngine, on: Clock = clock): ScrollConnection {
  if (engine.kind !== "lenis") return { kind: engine.kind, lenis: null, disconnect: () => {} }
  if (prefersReducedMotion()) return { kind: "native", lenis: null, disconnect: () => {} }
  const lenis = engine.create(LENIS_OPTIONS)
  if (engine.gsap) {
    engine.gsap.ticker.lagSmoothing(0)
    on.drive(engine.gsap.ticker)
  }
  const remove = on.add((time) => lenis.raf(time))
  return {
    kind: "lenis",
    lenis,
    disconnect() {
      remove()
      if (engine.gsap) on.drive(null)
      lenis.destroy()
    },
  }
}

/** How far an element has travelled through the viewport: 0 as its top enters the bottom, 1 as its bottom leaves the
 * top. For a pinned stage, `pinned` measures the scroll past its own height instead. */
export function scrollProgress(el: Element, pinned = false): number {
  if (typeof window === "undefined") return 0
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight || 1
  const total = pinned ? Math.max(1, r.height - vh) : r.height + vh
  const travelled = pinned ? -r.top : vh - r.top
  return Math.min(1, Math.max(0, travelled / total))
}

/**
 * Scrubs a value toward the scroll progress of `el`, with GSAP's `scrub: 1` feel (it takes about `scrub` seconds to
 * catch up). Under reduced motion the value jumps to the progress with no smoothing. Reads happen on the clock, once
 * per frame at most, only while scrolling or catching up. Returns the cleanup.
 */
export function scrub(el: Element, onProgress: (p: number) => void, { scrub: seconds = 1, pinned = false, on = clock } = {}): () => void {
  if (typeof window === "undefined") return () => {}
  let value = scrollProgress(el, pinned)
  let remove: (() => void) | null = null
  onProgress(value)
  const step = (_t: number, delta: number) => {
    const target = scrollProgress(el, pinned)
    const reduced = prefersReducedMotion(el) || seconds <= 0
    const alpha = reduced ? 1 : 1 - Math.exp(-delta / (seconds * 250))
    value += (target - value) * alpha
    if (Math.abs(target - value) < 0.0005) value = target
    onProgress(value)
    if (value === target) {
      remove?.()
      remove = null
    }
  }
  const wake = () => {
    if (!remove) remove = on.add(step)
  }
  window.addEventListener("scroll", wake, { passive: true })
  window.addEventListener("resize", wake, { passive: true })
  return () => {
    window.removeEventListener("scroll", wake)
    window.removeEventListener("resize", wake)
    remove?.()
  }
}
