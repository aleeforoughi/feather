import * as React from "react"
import { scrub } from "../core/scroll"
import { useMergedRef, useReducedMotion } from "../hooks"
import { cn } from "../cn"

export interface StageProps extends Omit<React.HTMLAttributes<HTMLElement>, "title" | "children"> {
  /** How tall the scroll track is, in viewport heights (2 = one screen of pinned scrubbing). */
  length?: number
  /** The heading of the stage: normal flow HTML above the pinned frame, never inside the scrubbed layer. */
  title?: React.ReactNode
  /** Supporting text, rendered in normal flow with the title. */
  caption?: React.ReactNode
  /** The scrubbed layer. A function receives the progress, 0 to 1; a node reads `--stage-progress` from CSS. */
  children?: React.ReactNode | ((progress: number) => React.ReactNode)
}

/**
 * Stage: a sticky stage with scrubbed children. A tall track scrolls while the frame stays pinned; the progress
 * (smoothed, scrub: 1) is passed to the children and written to `--stage-progress` on the frame. Only the trigger is
 * pinned, and the title and caption are ordinary HTML outside the scrubbed layer. Under reduced motion nothing is
 * pinned: it is a normal section whose progress is 1.
 */
export const Stage = React.forwardRef<HTMLElement, StageProps>(function Stage({ length = 2, title, caption, children, className, ...props }, forwarded) {
  const root = React.useRef<HTMLElement>(null)
  const track = React.useRef<HTMLDivElement>(null)
  const frame = React.useRef<HTMLDivElement>(null)
  const ref = useMergedRef(forwarded, root)
  const reduced = useReducedMotion(root)
  const [progress, setProgress] = React.useState(1)
  const render = typeof children === "function"

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

  const body = typeof children === "function" ? children(reduced ? 1 : progress) : children
  const hasText = title != null || caption != null
  return (
    <section ref={ref} data-slot="stage" data-variant={reduced ? "static" : "pinned"} className={cn("relative w-full", className)} {...props}>
      {hasText && (
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
      )}
      <div ref={track} data-slot="stage-track" style={reduced ? undefined : { height: `${length * 100}vh` }}>
        <div ref={frame} data-slot="stage-frame" className={cn("relative w-full overflow-hidden", !reduced && "sticky top-0 h-dvh")} style={{ ["--stage-progress" as string]: 1 }}>
          {body}
        </div>
      </div>
    </section>
  )
})
