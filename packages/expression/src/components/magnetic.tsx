import * as React from "react"
import { cn } from "../cn"
import { follow, magnetic, MAGNETIC_STRENGTH, pointerAllowedAt } from "../core/pointer"
import { cursorStates } from "../core/pointer-cursor"

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

/** Cursor: a ring that trails a fine pointer. Decoration only: the native cursor stays, and under reduced motion, a
 * coarse pointer or a loudness below 2 nothing renders. Elements opt in to a state with `data-cursor="view | drag |
 * play | link"` and an optional `data-cursor-label`: the ring grows and shows the label (aria-hidden text; the
 * element keeps its own accessible name). Fields never take a state. */
export const Cursor = React.forwardRef<HTMLDivElement, CursorProps>(function Cursor({ className, ...props }, forwarded) {
  const root = React.useRef<HTMLDivElement | null>(null)
  const label = React.useRef<HTMLSpanElement | null>(null)
  const [enabled, setEnabled] = React.useState(false)
  React.useEffect(() => setEnabled(pointerAllowedAt(document.body, 2)), [])
  React.useEffect(() => {
    const el = root.current
    const text = label.current
    if (!enabled || !el || !text) return
    const stopFollow = follow(el)
    const stopStates = cursorStates(el, text)
    return () => {
      stopFollow()
      stopStates()
    }
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
      className={cn("group/cursor pointer-events-none fixed left-0 top-0 -ml-3 -mt-3 size-6 opacity-0 motion-hover-out data-[state=active]:opacity-100", className)}
      {...props}
    >
      <span
        data-slot="cursor-ring"
        className="absolute inset-0 rounded-full border border-line-primary motion-hover-out group-data-[cursor=link]/cursor:scale-200 group-data-[cursor=link]/cursor:bg-surface-inverse group-data-[cursor=drag]/cursor:scale-300 group-data-[cursor=drag]/cursor:bg-surface-inverse group-data-[cursor=play]/cursor:scale-300 group-data-[cursor=play]/cursor:bg-surface-inverse group-data-[cursor=view]/cursor:scale-300 group-data-[cursor=view]/cursor:bg-surface-inverse"
      />
      <span data-slot="cursor-label" ref={label} className="absolute inset-0 grid place-items-center whitespace-nowrap type-label text-fg-inverse" />
    </div>
  )
})
