import * as React from "react"
import { cn } from "../cn"
import { useMergedRef } from "../hooks"
import { pointerTrail, TRAIL_LIFETIME, TRAIL_SPACING, trailPoolSize } from "../core/pointer-trail"

export interface PointerTrailProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The pictures the trail draws from (decorative). */
  images: string[]
  /** Distance the pointer travels between two spawns, in px. */
  spacing?: number
  /** How long one picture lives, in ms. */
  lifetime?: number
}

/** PointerTrail: pictures appear along the pointer path over its children and fade away. A pool of 8 to 12 decorative
 * images is reused, so it never grows. Desktop mouse only; off for touch (a tap does nothing), reduced motion and a
 * loudness below 3. */
export const PointerTrail = React.forwardRef<HTMLDivElement, PointerTrailProps>(function PointerTrail(
  { images, spacing = TRAIL_SPACING, lifetime = TRAIL_LIFETIME, className, children, ...props },
  forwarded,
) {
  const root = React.useRef<HTMLDivElement | null>(null)
  const layer = React.useRef<HTMLDivElement | null>(null)
  const ref = useMergedRef(forwarded, root)
  const size = images.length === 0 ? 0 : trailPoolSize(images.length)
  const key = images.join("\n")
  React.useEffect(() => {
    const el = root.current
    const nodes = layer.current ? Array.from(layer.current.querySelectorAll<HTMLImageElement>("img")) : []
    if (!el || nodes.length === 0) return
    return pointerTrail(el, nodes, { images: key.split("\n"), spacing, lifetime })
  }, [key, spacing, lifetime, size])
  return (
    <div ref={ref} data-slot="pointer-trail" className={cn("relative overflow-hidden", className)} {...props}>
      {children}
      {size > 0 ? (
        <div ref={layer} data-slot="pointer-trail-layer" aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: size }, (_, i) => (
            <img key={i} data-slot="pointer-trail-image" alt="" draggable={false} className="absolute left-0 top-0 -ml-16 -mt-16 w-32 rounded-card object-cover opacity-0" />
          ))}
        </div>
      ) : null}
    </div>
  )
})
