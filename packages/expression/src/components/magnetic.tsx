import * as React from "react"
import { cn } from "../cn"
import { follow, magnetic, MAGNETIC_STRENGTH, pointerEffectsAllowed } from "../core/pointer"

export interface MagneticProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  children: React.ReactElement
  /** How far the child follows the pointer, 0 to 0.3. */
  strength?: number
}

/** Magnetic: the child leans toward a fine pointer. One or two primary controls per page, never body links. A
 * coarse pointer or reduced motion leaves the child alone. */
export const Magnetic = React.forwardRef<HTMLSpanElement, MagneticProps>(function Magnetic({ children, strength = MAGNETIC_STRENGTH, className, ...props }, forwarded) {
  const root = React.useRef<HTMLSpanElement | null>(null)
  React.useEffect(() => {
    const el = root.current
    if (!el) return
    return magnetic(el, { strength })
  }, [strength])
  const set = (node: HTMLSpanElement | null) => {
    root.current = node
    if (typeof forwarded === "function") forwarded(node)
    else if (forwarded) forwarded.current = node
  }
  return (
    <span ref={set} data-slot="magnetic" className={cn("inline-block", className)} {...props}>
      {children}
    </span>
  )
})

export type CursorProps = Omit<React.HTMLAttributes<HTMLDivElement>, "children">

/** Cursor: a ring that trails a fine pointer. Decoration only: the native cursor stays, and under reduced motion or a
 * coarse pointer nothing renders. */
export const Cursor = React.forwardRef<HTMLDivElement, CursorProps>(function Cursor({ className, ...props }, forwarded) {
  const root = React.useRef<HTMLDivElement | null>(null)
  const [enabled, setEnabled] = React.useState(false)
  React.useEffect(() => setEnabled(pointerEffectsAllowed()), [])
  React.useEffect(() => {
    const el = root.current
    if (!enabled || !el) return
    return follow(el)
  }, [enabled])
  if (!enabled) return null
  const set = (node: HTMLDivElement | null) => {
    root.current = node
    if (typeof forwarded === "function") forwarded(node)
    else if (forwarded) forwarded.current = node
  }
  return (
    <div
      ref={set}
      data-slot="cursor"
      data-state="idle"
      aria-hidden="true"
      className={cn("pointer-events-none fixed left-0 top-0 -ml-3 -mt-3 size-6 rounded-full border border-line-primary opacity-0 motion-hover-out data-[state=active]:opacity-100", className)}
      {...props}
    />
  )
})
