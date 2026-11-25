import * as React from "react"
import { cn } from "../cn"
import { useMergedRef, useReducedMotion } from "../hooks"
import { pointerTilt, TILT_LIMIT, TILT_MAX } from "../core/pointer-tilt"

export interface PointerTiltProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The largest lean in degrees, 0 to 12. */
  max?: number
}

/** PointerTilt: the content leans toward a fine pointer (8 degrees at most by default) and springs back on leave.
 * Keyboard focus lifts it a little instead. A touch screen, reduced motion or a loudness below 2 leaves it still. */
export const PointerTilt = React.forwardRef<HTMLDivElement, PointerTiltProps>(function PointerTilt({ max = TILT_MAX, className, children, ...props }, forwarded) {
  const root = React.useRef<HTMLDivElement | null>(null)
  const ref = useMergedRef(forwarded, root)
  const reduced = useReducedMotion(root)
  const limit = Math.min(TILT_LIMIT, Math.max(0, max))
  React.useEffect(() => {
    const el = root.current
    if (!el) return
    return pointerTilt(el, { max: limit })
  }, [limit])
  return (
    <div ref={ref} data-slot="pointer-tilt" className={cn(reduced ? "" : "motion-hover data-[lift=true]:-translate-y-1", className)} {...props}>
      {children}
    </div>
  )
})
