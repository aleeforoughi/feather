import * as React from "react"
import { cn } from "../cn"
import { useReducedMotion } from "../hooks"

export type UnderlineLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement>

/** UnderlineLink: a link whose underline is drawn in on hover and focus (scaleX from the left) and drawn out toward
 * the right on leave. Static under reduced motion: the underline simply appears. Colour and underline only. */
export const UnderlineLink = React.forwardRef<HTMLAnchorElement, UnderlineLinkProps>(function UnderlineLink({ className, children, ...props }, forwarded) {
  const reduced = useReducedMotion()
  return (
    <a
      ref={forwarded}
      data-slot="underline-link"
      data-reduced={reduced ? "true" : "false"}
      className={cn("group/line relative inline-block pb-1 text-fg-primary focus-ring", className)}
      {...props}
    >
      {children}
      <span
        data-slot="underline-link-line"
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-x-0 bottom-0 block h-indicator origin-right scale-x-0 bg-current group-hover/line:origin-left group-hover/line:scale-x-100 group-focus-visible/line:origin-left group-focus-visible/line:scale-x-100", reduced ? "" : "motion-hover")}
      />
    </a>
  )
})

export interface RollTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: string
}

/** RollText: a label that rolls up as an identical copy rolls in beneath it, on hover and focus of itself or of the
 * `group` it sits in (a button, a link). One accessible name: the second copy is aria-hidden. Under reduced motion
 * nothing rolls and only the colour changes. */
export const RollText = React.forwardRef<HTMLSpanElement, RollTextProps>(function RollText({ className, children, ...props }, forwarded) {
  const reduced = useReducedMotion()
  return (
    <span
      ref={forwarded}
      data-slot="roll-text"
      data-reduced={reduced ? "true" : "false"}
      className={cn("group/roll relative inline-flex overflow-hidden align-bottom", className)}
      {...props}
    >
      <span
        data-slot="roll-text-label"
        className={cn("block motion-hover", reduced ? "group-hover/roll:text-fg-secondary group-hover:text-fg-secondary" : "group-hover/roll:-translate-y-full group-hover:-translate-y-full group-focus-visible:-translate-y-full")}
      >
        {children}
      </span>
      {reduced ? null : (
        <span
          data-slot="roll-text-copy"
          aria-hidden="true"
          className="absolute inset-0 block translate-y-full motion-hover group-hover/roll:translate-y-0 group-hover:translate-y-0 group-focus-visible:translate-y-0"
        >
          {children}
        </span>
      )}
    </span>
  )
})
