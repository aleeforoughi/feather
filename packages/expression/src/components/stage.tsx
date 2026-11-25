import * as React from "react"
import { scrub } from "../core/scroll"
import { useMergedRef, useReducedMotion } from "../hooks"
import { useLoudnessAllows } from "./loudness"
import { cn } from "../cn"

/** The longest pin, in viewport heights (Qooler file 27 §2 C12: pins of 100 to 300%; Feather caps them at 4). */
export const STAGE_MAX_LENGTH = 4

export interface StageProps extends Omit<React.HTMLAttributes<HTMLElement>, "title" | "children"> {
  /** How tall the scroll track is, in viewport heights, 1 to 4 (2 = one screen of pinned scrubbing). With `steps`
   * the track is as tall as the steps instead: one viewport each, never more than 4 in all. */
  length?: number
  /** The heading of the stage: normal flow HTML above the pinned frame, never inside the scrubbed layer. */
  title?: React.ReactNode
  /** Supporting text, rendered in normal flow with the title. */
  caption?: React.ReactNode
  /**
   * Pinned storytelling: each step is a text panel that scrolls past while the visual stays pinned. The step crossing
   * the middle of the viewport is the active one: it is passed to a function child and set as `data-step` on the root.
   * Under reduced motion or without script the steps stack in normal flow, each with its visual, and nothing pins.
   */
  steps?: React.ReactNode[]
  /** Settles on the steps as scrolling ends (`scroll-snap-type: y proximity`, never mandatory, so tall content is never
   * trapped). Only while pinned. Not for pages smoothed by Lenis, which ignores CSS snap. */
  snap?: boolean
  /** The scrubbed layer. A function receives the progress, 0 to 1, and the active step (0 without steps); a node
   * reads `--stage-progress` and the root's `data-step` from CSS. */
  children?: React.ReactNode | ((progress: number, step: number) => React.ReactNode)
}

// Proximity snap belongs to the page's scroller, so it is held while any snapping stage is pinned and given back after.
let snapHolders = 0
let snapBefore = ""
function holdSnap(): () => void {
  const html = document.documentElement
  if (snapHolders++ === 0) {
    snapBefore = html.style.scrollSnapType
    html.style.scrollSnapType = "y proximity"
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (--snapHolders === 0) html.style.scrollSnapType = snapBefore
  }
}

const clampLength = (length: number) => Math.min(STAGE_MAX_LENGTH, Math.max(1, Number.isFinite(length) ? length : 2))

/**
 * Stage: a sticky stage with scrubbed children. A tall track scrolls while the frame stays pinned; the progress
 * (smoothed, scrub: 1) is passed to the children and written to `--stage-progress` on the frame. Only the trigger is
 * pinned, and the title and caption are ordinary HTML outside the scrubbed layer. With `steps`, text panels scroll
 * past the pinned visual and the active step drives it. Under reduced motion nothing is pinned: it is a normal
 * section whose progress is 1, and its steps are stacked in reading order, each with its visual.
 */
export const Stage = React.forwardRef<HTMLElement, StageProps>(function Stage({ length = 2, title, caption, steps, snap = false, children, className, ...props }, forwarded) {
  const root = React.useRef<HTMLElement>(null)
  const track = React.useRef<HTMLDivElement>(null)
  const frame = React.useRef<HTMLDivElement>(null)
  const list = React.useRef<HTMLOListElement>(null)
  const ref = useMergedRef(forwarded, root)
  // Nothing pins under reduced motion, nor where the loudness does not allow scroll choreography (below 2).
  const motionReduced = useReducedMotion(root)
  const scrollAllowed = useLoudnessAllows(root, "scroll")
  const reduced = motionReduced || !scrollAllowed
  const [progress, setProgress] = React.useState(1)
  const [step, setStep] = React.useState(0)
  const render = typeof children === "function"
  const count = steps?.length ?? 0

  React.useEffect(() => {
    const el = track.current
    if (reduced || !el) {
      setProgress(1)
      frame.current?.style.setProperty("--stage-progress", "1")
      return
    }
    return scrub(
      el,
      (p) => {
        frame.current?.style.setProperty("--stage-progress", String(p))
        if (render) setProgress(p)
      },
      { scrub: 1, pinned: true }
    )
  }, [reduced, render])

  // The active step is the one crossing the middle of the viewport: one observer, no layout reads on scroll.
  React.useEffect(() => {
    const items = list.current ? [...list.current.querySelectorAll<HTMLElement>(':scope > [data-slot="stage-step"]')] : []
    if (reduced || items.length === 0 || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = items.indexOf(entry.target as HTMLElement)
          if (entry.isIntersecting && index >= 0) setStep(index)
        }
      },
      { rootMargin: "-50% 0px -50% 0px" }
    )
    for (const item of items) observer.observe(item)
    return () => observer.disconnect()
  }, [reduced, count])

  React.useEffect(() => {
    if (!snap || reduced || count === 0) return
    return holdSnap()
  }, [snap, reduced, count])

  const visual = (p: number, s: number) => (typeof children === "function" ? children(p, s) : children)
  const hasText = title != null || caption != null
  const text = hasText && (
    <div data-slot="stage-text" className="page-grid pb-8">
      {title != null && (
        <div data-slot="stage-title" className="col-span-full type-heading-2 text-fg-primary">
          {title}
        </div>
      )}
      {caption != null && (
        <div data-slot="stage-caption" className="col-span-full type-body text-fg-secondary">
          {caption}
        </div>
      )}
    </div>
  )

  if (count > 0 && steps) {
    const last = count - 1
    const at = (i: number) => (last > 0 ? i / last : 1)
    const active = reduced ? last : Math.min(step, last)
    // One viewport per step, and never a pin longer than STAGE_MAX_LENGTH viewports in all.
    const slot = `${Math.min(100, (STAGE_MAX_LENGTH * 100) / count)}dvh`
    return (
      <section ref={ref} data-slot="stage" data-variant={reduced ? "static" : "pinned"} data-step={active} className={cn("relative w-full", className)} {...props}>
        {text}
        {reduced ? (
          <div ref={track} data-slot="stage-track">
            {!render && (
              <div ref={frame} data-slot="stage-frame" className="relative w-full overflow-hidden" style={{ ["--stage-progress" as string]: 1 }}>
                {children as React.ReactNode}
              </div>
            )}
            <ol ref={list} data-slot="stage-steps" className="page-grid gap-y-12 pt-8">
              {steps.map((content, i) => (
                <li key={i} data-slot="stage-step" data-state="static" className="col-span-full grid items-center gap-6 sm:grid-cols-2">
                  {render && (
                    <div data-slot="stage-step-visual" className="relative aspect-video w-full overflow-hidden rounded-card" style={{ ["--stage-progress" as string]: at(i) }}>
                      {visual(at(i), i)}
                    </div>
                  )}
                  <div data-slot="stage-step-panel" className="text-fg-primary">
                    {content}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div ref={track} data-slot="stage-track" className="relative grid">
            <div ref={frame} data-slot="stage-frame" className="sticky top-0 col-start-1 row-start-1 h-dvh w-full self-start overflow-hidden" style={{ ["--stage-progress" as string]: 1 }}>
              {visual(progress, active)}
            </div>
            {/* One step per row (each starts at the first column), so the steps pass one at a time. */}
            <ol ref={list} data-slot="stage-steps" className="pointer-events-none relative col-start-1 row-start-1 page-grid">
              {steps.map((content, i) => (
                <li
                  key={i}
                  data-slot="stage-step"
                  data-state={i === active ? "active" : "inactive"}
                  className={cn("col-span-full flex items-end pb-12 sm:col-span-6 sm:col-start-1 sm:items-center sm:pb-0 lg:col-span-5", snap && "snap-center")}
                  style={{ minHeight: slot }}
                >
                  <div data-slot="stage-step-panel" className="pointer-events-auto w-full rounded-card bg-surface-raised p-6 text-fg-primary shadow-2">
                    {content}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    )
  }

  const body = visual(reduced ? 1 : progress, 0)
  return (
    <section ref={ref} data-slot="stage" data-variant={reduced ? "static" : "pinned"} className={cn("relative w-full", className)} {...props}>
      {text}
      <div ref={track} data-slot="stage-track" style={reduced ? undefined : { height: `${clampLength(length) * 100}vh` }}>
        <div ref={frame} data-slot="stage-frame" className={cn("relative w-full overflow-hidden", !reduced && "sticky top-0 h-dvh")} style={{ ["--stage-progress" as string]: 1 }}>
          {body}
        </div>
      </div>
    </section>
  )
})
