import * as React from "react"
import { roleMotion } from "@aleeforoughi/feather-expression/core"
import { cn } from "../cn"
import { useReducedMotion } from "../hooks"

export type PresenceKind = "film" | "mark" | "object"
export type PresenceState = "idle" | "listening" | "thinking" | "speaking"

export interface PresenceProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** What the brand shows as itself: a film, a mark, or an object. Never a stock avatar. */
  kind: PresenceKind
  /** The brand's media (a video, an image, an svg). */
  children: React.ReactNode
  state?: PresenceState
}

// Leaning in while it thinks: toward the reader, never past 1.03 and never from 0.
const LEAN = "translateY(-4px) scale(1.02)"

/**
 * Presence: the brand's slot in the conversation. It leans in while the agent thinks and breathes while it speaks;
 * no dots, no spinner. Decorative: the byline of each turn names the speaker.
 */
export function Presence({ kind, state = "idle", children, className, style, ...props }: PresenceProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion(ref)

  React.useEffect(() => {
    const el = ref.current
    if (!el || reduced || state !== "speaking" || typeof el.animate !== "function") return
    const { duration, easing } = roleMotion("scene", el)
    const breath = el.animate([{ transform: "scale(1)" }, { transform: "scale(1.012)" }], { duration, easing, direction: "alternate", iterations: Number.POSITIVE_INFINITY })
    return () => breath.cancel()
  }, [state, reduced])

  return (
    <div ref={ref} aria-hidden="true" data-slot="presence" data-variant={kind} data-state={state} className={cn("motion-scene motion-reduce:transform-none", className)} style={{ transform: !reduced && state === "thinking" ? LEAN : undefined, ...style }} {...props}>
      {children}
    </div>
  )
}
