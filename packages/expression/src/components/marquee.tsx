import * as React from "react"
import { cn } from "../cn"
import { useReducedMotion } from "../hooks"
import { onReducedMotionChange } from "../core/motion"

/** The duration (s) used before the content has been measured, and where it cannot be (no layout). */
const FALLBACK_SECONDS = 40

const BUTTON =
  "inline-flex min-h-12 min-w-12 items-center justify-center rounded-control border border-line-primary bg-surface-base px-3 type-label text-fg-primary focus-ring not-disabled:hover:bg-surface-hover motion-hover-out"

export interface MarqueeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  children: React.ReactNode
  /** Speed in px per second. */
  speed?: number
  direction?: "left" | "right"
  /** The accessible names of the pause control. */
  pauseLabel?: string
  playLabel?: string
}

/**
 * Marquee: content that loops across the page. It can always be paused (a button, hover and focus), and under
 * reduced motion it does not move at all: one static row, no copy.
 */
export const Marquee = React.forwardRef<HTMLDivElement, MarqueeProps>(function Marquee(
  { children, speed = 60, direction = "left", pauseLabel = "Pause", playLabel = "Play", className, ...props },
  ref,
) {
  const reduced = useReducedMotion()
  const content = React.useRef<HTMLDivElement>(null)
  const [seconds, setSeconds] = React.useState(FALLBACK_SECONDS)
  const [userPaused, setUserPaused] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)

  React.useEffect(() => {
    const el = content.current
    if (!el || reduced) return
    const measure = () => {
      const width = el.scrollWidth
      if (width > 0 && speed > 0) setSeconds(width / speed)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [reduced, speed])

  const paused = userPaused || hovered || focused
  const state = reduced ? "static" : paused ? "paused" : "playing"

  return (
    <div
      ref={ref}
      data-slot="marquee"
      data-variant={direction}
      data-state={state}
      className={cn("flex w-full items-center gap-4", className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      {...props}
    >
      <div data-slot="marquee-viewport" className="min-w-0 flex-1 overflow-hidden">
        {reduced ? (
          <div data-slot="marquee-content" className="flex flex-wrap items-center gap-8">
            {children}
          </div>
        ) : (
          <div
            data-slot="marquee-track"
            className="flex w-max motion-marquee"
            style={{ animationDuration: `${seconds}s`, animationDirection: direction === "right" ? "reverse" : "normal", animationPlayState: paused ? "paused" : "running" }}
          >
            <div ref={content} data-slot="marquee-content" className="flex shrink-0 items-center gap-8 pr-8">
              {children}
            </div>
            <div data-slot="marquee-copy" aria-hidden="true" inert className="flex shrink-0 items-center gap-8 pr-8">
              {children}
            </div>
          </div>
        )}
      </div>
      {reduced ? null : (
        <button type="button" data-slot="marquee-toggle" data-state={userPaused ? "paused" : "playing"} className={BUTTON} onClick={() => setUserPaused((p) => !p)}>
          {userPaused ? playLabel : pauseLabel}
        </button>
      )}
    </div>
  )
})

export interface ReelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  children: React.ReactNode
  /** The region's accessible name (required: a scrollable region needs one). */
  "aria-label": string
  previousLabel?: string
  nextLabel?: string
}

/** Reel: a horizontal scroll reel with snap points. Keyboard scrollable, with previous and next buttons. It never
 * moves on its own, so it needs no pause. */
export const Reel = React.forwardRef<HTMLDivElement, ReelProps>(function Reel({ children, previousLabel = "Previous", nextLabel = "Next", className, "aria-label": label, ...props }, ref) {
  const scroller = React.useRef<HTMLDivElement>(null)
  const [reduced, setReduced] = React.useState(true)
  React.useEffect(() => {
    const read = () => setReduced(typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches || !!scroller.current?.closest('[data-motion="reduced"]'))
    read()
    return onReducedMotionChange(read)
  }, [])
  const by = (direction: 1 | -1) => {
    const el = scroller.current
    if (!el) return
    el.scrollBy?.({ left: direction * el.clientWidth * 0.8, behavior: reduced ? "auto" : "smooth" })
  }
  return (
    <div ref={ref} data-slot="reel" className={cn("flex flex-col gap-4", className)} {...props}>
      <div
        ref={scroller}
        data-slot="reel-track"
        role="region"
        aria-label={label}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto focus-ring"
      >
        {React.Children.map(children, (child) => (
          <div data-slot="reel-item" className="shrink-0 snap-start">
            {child}
          </div>
        ))}
      </div>
      <div data-slot="reel-controls" className="flex gap-2">
        <button type="button" data-slot="reel-previous" className={BUTTON} onClick={() => by(-1)}>
          {previousLabel}
        </button>
        <button type="button" data-slot="reel-next" className={BUTTON} onClick={() => by(1)}>
          {nextLabel}
        </button>
      </div>
    </div>
  )
})
