import * as React from "react"
import { cn } from "../cn"
import { pointerEffectsAllowed } from "../core/pointer"
import { scrollProgress, scrub, supportsScrollTimeline } from "../core/scroll"
import { useReducedMotion } from "../hooks"
import { useLoudnessAllows } from "./loudness"
import { Reel } from "./marquee"

// Scroll choreography (docs/proposals/2026-11-24-range.md §5 C; Qooler file 27 §2 D17–18, F24, G28–29). One
// component, four moves. Only transform, opacity and clip-path animate. The driver is chosen per move: CSS
// `view()` timelines for parallax where the browser runs them (off the main thread), the one clock for the pins.
// Never wheel or touch hijacking: the page always scrolls natively, and every move rests, complete and in reading
// order, under reduced motion and without script.

export type ScrollLayersVariant = "parallax" | "stack" | "horizontal" | "scale"

export interface ScrollLayersProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  variant: ScrollLayersVariant
  /** Parallax: `ScrollLayers.Layer`s (and still content). Stack and horizontal: the cards or panels, in order.
   * Scale: the media (an image, video or MediaFrame), which fills the frame. */
  children: React.ReactNode
  className?: string
  /** The section's accessible name. Horizontal needs one (its rail is a scrollable region). */
  "aria-label"?: string
  /** Pin length in viewport heights, 1 to 4, for horizontal and scale. Horizontal defaults to its own overflow (one
   * viewport of scroll per viewport of travel); scale defaults to 2. */
  length?: number
  /** Scale only: text shown with the media, on its own surface outside the scaled layer, so its contrast holds at
   * every size. */
  caption?: React.ReactNode
}

/** The most a parallax layer travels either way, as a share of its own height. */
export const PARALLAX_MAX_TRAVEL = 15
/** Stacking cards: the scale an earlier card settles at under the next one (Qooler file 27 §2 G28). */
export const STACK_SCALE = 0.95
/** Scale to fullscreen: the inset the media starts from (percent of the frame), and the share of the pin it grows
 * over before it holds full bleed. */
export const SCALE_INSET = { x: 12, y: 16 } as const
export const SCALE_GROWTH = 0.7

/** Every move rests in its static form under reduced motion, and where the loudness does not allow scroll
 * choreography (below 2): the same content, complete and in reading order. */
function useStill(root: React.RefObject<HTMLElement | null>): boolean {
  const reduced = useReducedMotion(root)
  const allowed = useLoudnessAllows(root, "scroll")
  return reduced || !allowed
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const clampLength = (length: number) => clamp(Number.isFinite(length) ? length : 2, 1, 4)

/** How far a layer of `depth` travels, in percent of its own height: 0.8 moves against the scroll by 15%, 1 stays,
 * 1.2 moves with it by 15%. Depth is clamped to 0.8–1.2 and travel to ±15%. */
export function parallaxTravel(depth: number): number {
  const d = clamp(Number.isFinite(depth) ? depth : 1, 0.8, 1.2)
  return Math.round(clamp((d - 1) * 75, -PARALLAX_MAX_TRAVEL, PARALLAX_MAX_TRAVEL) * 100) / 100
}

/** What a section is doing: resting (reduced motion, no script, the first render), a native rail, or moving on CSS
 * timelines or the one clock. Set as `data-state`. */
type LayersState = "static" | "rail" | "css" | "scrub"

// The parallax keyframes, once per document. A layer drifts from +travel to -travel as the section crosses the
// viewport, on the section's own view timeline. Never under reduced motion; never without the timeline (then the
// one clock writes the same transform).
const PARALLAX_CSS = `@keyframes feather-layers-drift {
  from { transform: translate3d(0, var(--layer-travel, 0%), 0); }
  to { transform: translate3d(0, calc(var(--layer-travel, 0%) * -1), 0); }
}
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    [data-slot="scroll-layers"][data-state="css"] { view-timeline-name: --feather-layers; }
    [data-slot="scroll-layers"][data-state="css"] [data-slot="scroll-layers-layer"] {
      animation: feather-layers-drift linear both;
      animation-duration: auto;
      animation-timeline: --feather-layers;
      animation-range: cover 0% cover 100%;
    }
  }
}`

export interface ScrollLayersLayerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** How fast the layer moves against the page, 0.8 to 1.2 (1 = with the page). Decorative layers only: never put
   * body text in a moving layer. */
  depth?: number
}

/** One parallax layer. Every child of a parallax section shares one grid cell, so layers stack like a diorama. */
function Layer({ depth = 1, className, style, children, ...props }: ScrollLayersLayerProps) {
  return (
    <div data-slot="scroll-layers-layer" data-depth={depth} className={cn("relative", className)} style={{ ["--layer-travel" as string]: `${parallaxTravel(depth)}%`, ...style }} {...props}>
      {children}
    </div>
  )
}

type SectionAttributes = Omit<React.HTMLAttributes<HTMLElement>, "children">
interface VariantProps {
  children: React.ReactNode
  className?: string
  length?: number
  caption?: React.ReactNode
  props: SectionAttributes
}

function Parallax({ children, className, props }: VariantProps) {
  const root = React.useRef<HTMLElement>(null)
  const reduced = useStill(root)
  // Reduced is true on the server and the first client render, so the server's "static" always hydrates.
  const state: LayersState = reduced ? "static" : supportsScrollTimeline() ? "css" : "scrub"
  React.useEffect(() => {
    const el = root.current
    if (!el || state !== "scrub") return
    const layers = [...el.querySelectorAll<HTMLElement>('[data-slot="scroll-layers-layer"]')]
    const travel = layers.map((layer) => parallaxTravel(Number(layer.dataset.depth ?? 1)))
    const stop = scrub(
      el,
      (p) => {
        layers.forEach((layer, i) => {
          layer.style.transform = travel[i] === 0 ? "" : `translate3d(0, ${(travel[i] * (1 - 2 * p)).toFixed(3)}%, 0)`
        })
      },
      { scrub: 0.5 }
    )
    return () => {
      stop()
      for (const layer of layers) layer.style.transform = ""
    }
  }, [state])
  return (
    <section ref={root} data-slot="scroll-layers" data-variant="parallax" data-state={state} className={cn("relative grid overflow-clip *:col-start-1 *:row-start-1", className)} {...props}>
      <style href="feather-scroll-layers" precedence="feather">
        {PARALLAX_CSS}
      </style>
      {children}
    </section>
  )
}

function Stack({ children, className, props }: VariantProps) {
  const root = React.useRef<HTMLElement>(null)
  const reduced = useStill(root)
  const items = React.Children.toArray(children)
  const live = !reduced
  React.useEffect(() => {
    const el = root.current
    if (!el || reduced) return
    const cards = [...el.querySelectorAll<HTMLElement>(':scope > [data-slot="scroll-layers-stack"] > [data-slot="scroll-layers-card"]')]
    const dims = cards.map((card) => card.querySelector<HTMLElement>(':scope > [data-slot="scroll-layers-card-dim"]'))
    // Each card's sticky offset, read again only when the viewport changes.
    let height = 0
    let offsets: number[] = []
    const update = () => {
      const vh = window.innerHeight || 1
      if (vh !== height) {
        height = vh
        offsets = cards.map((card) => Number.parseFloat(getComputedStyle(card).top) || 0)
      }
      const rects = cards.map((card) => card.getBoundingClientRect())
      cards.forEach((card, i) => {
        // A card taller than the room under its offset is not stuck: its whole text must stay readable.
        const tall = card.offsetHeight > vh - offsets[i]
        card.dataset.state = tall ? "tall" : "stuck"
        const next = rects[i + 1]
        const amount = next && !tall ? clamp(1 - (next.top - rects[i].top) / Math.max(1, card.offsetHeight), 0, 1) : 0
        card.style.transform = amount > 0 ? `scale(${(1 - (1 - STACK_SCALE) * amount).toFixed(4)})` : ""
        const dim = dims[i]
        if (dim) dim.style.opacity = amount > 0 ? amount.toFixed(3) : "0"
      })
    }
    const stop = scrub(el, update, { scrub: 0 })
    return () => {
      stop()
      for (const card of cards) {
        card.style.transform = ""
        delete card.dataset.state
      }
      for (const dim of dims) if (dim) dim.style.opacity = "0"
    }
  }, [reduced, items.length])
  return (
    <section ref={root} data-slot="scroll-layers" data-variant="stack" data-state={live ? "scrub" : "static"} className={cn("relative page-grid", className)} {...props}>
      <div data-slot="scroll-layers-stack" className="col-span-full flex flex-col gap-8 pb-16">
        {items.map((child, i) => (
          <div
            key={i}
            data-slot="scroll-layers-card"
            className={cn("relative origin-top", live && "sticky data-[state=tall]:relative")}
            // Each card sticks a spacing step (16px) below the one before it, under the page margin.
            style={live ? { top: `calc(var(--layout-margin) + var(--spacing) * ${i * 4})` } : undefined}
          >
            {child}
            <div data-slot="scroll-layers-card-dim" aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-card bg-scrim opacity-0" />
          </div>
        ))}
      </div>
    </section>
  )
}

function Horizontal({ children, className, length, props }: VariantProps) {
  const root = React.useRef<HTMLElement>(null)
  const track = React.useRef<HTMLDivElement>(null)
  const frame = React.useRef<HTMLDivElement>(null)
  const row = React.useRef<HTMLDivElement>(null)
  const reduced = useStill(root)
  const [fine, setFine] = React.useState(false)
  const [auto, setAuto] = React.useState(3)
  const items = React.Children.toArray(children)
  const { "aria-label": label, ...attributes } = props
  const pinned = fine && !reduced

  React.useEffect(() => {
    const read = () => setFine(pointerEffectsAllowed(root.current))
    read()
    if (typeof window.matchMedia !== "function") return
    const query = window.matchMedia("(pointer: fine)")
    query.addEventListener?.("change", read)
    return () => query.removeEventListener?.("change", read)
  }, [reduced])

  // The travel is the row's overflow; without a `length` the pin is one viewport of scroll per viewport of travel.
  const travel = React.useCallback(() => Math.max(0, (row.current?.scrollWidth ?? 0) - (frame.current?.clientWidth ?? 0)), [])
  React.useEffect(() => {
    if (!pinned || length !== undefined) return
    const measure = () => setAuto(clampLength(1 + travel() / (window.innerHeight || 1)))
    measure()
    window.addEventListener("resize", measure, { passive: true })
    return () => window.removeEventListener("resize", measure)
  }, [pinned, length, travel, items.length])

  React.useEffect(() => {
    const el = track.current
    const strip = row.current
    if (!pinned || !el || !strip) return
    const stop = scrub(
      el,
      (p) => {
        strip.style.transform = `translate3d(${(-travel() * p).toFixed(2)}px, 0, 0)`
      },
      { scrub: 1, pinned: true }
    )
    return () => {
      stop()
      strip.style.transform = ""
    }
  }, [pinned, travel])

  // Keyboard: focus inside a panel scrolls the page to where that panel is in view. Nothing is reachable only by scroll.
  const onFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const el = track.current
    const strip = row.current
    const panel = (event.target as HTMLElement).closest<HTMLElement>('[data-slot="scroll-layers-panel"]')
    if (!el || !strip || !panel) return
    const distance = travel()
    const p = distance > 0 ? clamp(panel.offsetLeft / distance, 0, 1) : 0
    if (Math.abs(scrollProgress(el, true) - p) < 0.02) return
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + p * Math.max(0, el.offsetHeight - window.innerHeight), behavior: "auto" })
  }

  if (!pinned) {
    return (
      <section ref={root} data-slot="scroll-layers" data-variant="horizontal" data-state="rail" className={cn("relative page-grid", className)} {...attributes}>
        <Reel aria-label={label ?? "Gallery"} className="col-span-full">
          {items}
        </Reel>
      </section>
    )
  }
  return (
    <section ref={root} data-slot="scroll-layers" data-variant="horizontal" data-state="scrub" aria-label={label} className={cn("relative", className)} {...attributes}>
      <div ref={track} data-slot="scroll-layers-track" style={{ height: `${(length === undefined ? auto : clampLength(length)) * 100}vh` }}>
        <div ref={frame} data-slot="scroll-layers-frame" className="sticky top-0 flex h-dvh items-center overflow-clip">
          <div ref={row} data-slot="scroll-layers-row" className="flex w-max gap-6" style={{ paddingInline: "var(--layout-margin)" }} onFocus={onFocus}>
            {items.map((child, i) => (
              <div key={i} data-slot="scroll-layers-panel" className="shrink-0">
                {child}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Scale({ children, className, length = 2, caption, props }: VariantProps) {
  const root = React.useRef<HTMLElement>(null)
  const track = React.useRef<HTMLDivElement>(null)
  const media = React.useRef<HTMLDivElement>(null)
  const reduced = useStill(root)
  React.useEffect(() => {
    const el = track.current
    const layer = media.current
    if (reduced || !el || !layer) return
    const stop = scrub(
      el,
      (p) => {
        const left = 1 - clamp(p / SCALE_GROWTH, 0, 1)
        layer.style.clipPath = `inset(${(SCALE_INSET.y * left).toFixed(3)}% ${(SCALE_INSET.x * left).toFixed(3)}% round calc(var(--radius-card) * ${left.toFixed(3)}))`
      },
      { scrub: 1, pinned: true }
    )
    return () => {
      stop()
      layer.style.clipPath = ""
    }
  }, [reduced])
  const panel = caption != null && (
    <div data-slot="scroll-layers-caption-panel" className="col-span-full rounded-card bg-surface-raised p-6 text-fg-primary shadow-2 sm:col-span-6 lg:col-span-5">
      {caption}
    </div>
  )
  if (reduced) {
    return (
      <section ref={root} data-slot="scroll-layers" data-variant="scale" data-state="static" className={cn("relative", className)} {...props}>
        <div ref={track} data-slot="scroll-layers-track">
          <div ref={media} data-slot="scroll-layers-media" className="relative aspect-video w-full overflow-hidden *:size-full *:object-cover">
            {children}
          </div>
          {panel && (
            <div data-slot="scroll-layers-caption" className="page-grid pt-6">
              {panel}
            </div>
          )}
        </div>
      </section>
    )
  }
  return (
    <section ref={root} data-slot="scroll-layers" data-variant="scale" data-state="scrub" className={cn("relative", className)} {...props}>
      <div ref={track} data-slot="scroll-layers-track" style={{ height: `${clampLength(length) * 100}vh` }}>
        <div data-slot="scroll-layers-frame" className="sticky top-0 h-dvh overflow-clip">
          <div
            ref={media}
            data-slot="scroll-layers-media"
            className="absolute inset-0 *:size-full *:object-cover"
            style={{ clipPath: `inset(${SCALE_INSET.y}% ${SCALE_INSET.x}% round var(--radius-card))` }}
          >
            {children}
          </div>
          {panel && (
            <div data-slot="scroll-layers-caption" className="absolute inset-x-0 bottom-0 page-grid pb-8">
              {panel}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * ScrollLayers: scroll choreography in one component.
 * - `parallax`: `ScrollLayers.Layer`s at depths 0.8 to 1.2 drift up to ±15% as the section crosses the viewport, on a
 *   CSS view timeline where supported, else on the one clock. Decorative layers only: body text never moves.
 * - `stack`: each card sticks a spacing step below the last; an earlier card settles to 0.95 and dims as the next
 *   arrives. A card taller than the viewport does not stick.
 * - `horizontal`: on a fine pointer, a pinned row driven by vertical scroll (focus brings a panel into view); on touch,
 *   under reduced motion and without script, a native snap rail with previous and next buttons.
 * - `scale`: the media grows from an inset, rounded frame to full bleed as the section pins; the caption sits on its own
 *   surface outside the scaled layer.
 * Under reduced motion every variant rests at its complete state, in reading order.
 */
export function ScrollLayers({ variant, children, className, length, caption, ...props }: ScrollLayersProps) {
  const Variant = variant === "stack" ? Stack : variant === "horizontal" ? Horizontal : variant === "scale" ? Scale : Parallax
  return (
    <Variant className={className} length={length} caption={caption} props={props}>
      {children}
    </Variant>
  )
}
ScrollLayers.Layer = Layer
