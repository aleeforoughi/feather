import * as React from "react"
import { useMergedRef, useReveal } from "../hooks"
import { cn } from "../cn"

export type SectionSpace = "s" | "m" | "l" | "xl"
export type SectionTone = "base" | "subtle" | "raised" | "inverse"

const SPACE: Record<SectionSpace, string> = { s: "section-space-s", m: "section-space-m", l: "section-space-l", xl: "section-space-xl" }
const TONE: Record<SectionTone, string> = {
  base: "bg-surface-base text-fg-primary",
  subtle: "bg-surface-subtle text-fg-primary",
  raised: "bg-surface-raised text-fg-primary",
  inverse: "bg-surface-inverse text-fg-inverse",
}

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** The landmark. A section with a heading needs `aria-labelledby` (or an `aria-label`) to be a region. */
  as?: "section" | "header" | "footer" | "div" | "article"
  /** The vertical rhythm: group gaps from 48 to 160px, fluid with the viewport. */
  space?: SectionSpace
  tone?: SectionTone
  /** Lays the children on the 12-column page grid (4 on mobile, 8 on tablet). */
  grid?: boolean
  /** The section's own scroll trigger: its content rises in as it enters (the reveal role). */
  reveal?: boolean
}

/**
 * Section: a full-width band of a website, with the page grid, the spacing rhythm and its own scroll trigger.
 * Its content is plain HTML first: with no script, or under reduced motion, it is simply there.
 */
export const Section = React.forwardRef<HTMLElement, SectionProps>(function Section({ as: Tag = "section", space = "m", tone = "base", grid = true, reveal = true, className, children, ...props }, forwarded) {
  const inner = React.useRef<HTMLDivElement>(null)
  const outer = React.useRef<HTMLElement>(null)
  const ref = useMergedRef(forwarded, outer)
  useReveal(inner, { enabled: reveal, role: "reveal", from: "rise" })
  return (
    <Tag ref={ref} data-slot="section" data-variant={tone} data-space={space} className={cn("relative w-full", SPACE[space], TONE[tone], className)} {...props}>
      <div ref={inner} data-slot="section-content" className={cn(grid ? "page-grid" : "mx-auto w-full")}>
        {children}
      </div>
    </Tag>
  )
})
