import * as React from "react"
import { cn } from "../cn"
import { useMergedRef } from "../hooks"
import { FIELD_RADIUS, pointerField } from "../core/pointer-field"

export interface PointerFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** How far from the pointer an item still feels it, in px. */
  radius?: number
  /** How hard items are pushed, 0 to 1. */
  strength?: number
}

/** PointerField: mark children with `data-pointer-item` and they drift away from a fine pointer inside `radius`
 * (the push falls off with 1 - (d/r)^2 and never travels more than 8 spacing steps). Transform only; pauses off
 * screen and while the tab is hidden; off for touch, reduced motion and a loudness below 2. */
export const PointerField = React.forwardRef<HTMLDivElement, PointerFieldProps>(function PointerField({ radius = FIELD_RADIUS, strength = 0.5, className, children, ...props }, forwarded) {
  const root = React.useRef<HTMLDivElement | null>(null)
  const ref = useMergedRef(forwarded, root)
  React.useEffect(() => {
    const el = root.current
    if (!el) return
    return pointerField(el, { radius, strength })
  }, [radius, strength])
  return (
    <div ref={ref} data-slot="pointer-field" className={cn("relative", className)} {...props}>
      {children}
    </div>
  )
})
