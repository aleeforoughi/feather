import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "../../lib/cn"

import { Icon } from "./icon"

/** Detail on demand, as the IR states it: at least one entry. */
export type Expandable = { why?: React.ReactNode; detail?: React.ReactNode }

/** The entries that have content, in reading order (why, then detail). */
function disclosureEntries(expandable: Expandable): Array<{ kind: "why" | "detail"; content: React.ReactNode }> {
  const out: Array<{ kind: "why" | "detail"; content: React.ReactNode }> = []
  const has = (v: React.ReactNode) => v !== undefined && v !== null && v !== false && v !== ""
  if (has(expandable.why)) out.push({ kind: "why", content: expandable.why })
  if (has(expandable.detail)) out.push({ kind: "detail", content: expandable.detail })
  return out
}

/**
 * The "Why?" control: a real button with `aria-expanded` and `aria-controls`, closed by default. Controlled with
 * `open` and `onOpenChange`, or uncontrolled. With `forceOpen` (a critical node) the detail shows with no control.
 */
function WhyDisclosure({ expandable, open, onOpenChange, forceOpen = false, className }: {
  expandable: Expandable
  open?: boolean
  onOpenChange?: (open: boolean) => void
  forceOpen?: boolean
  className?: string
}) {
  const panelId = React.useId()
  const [inner, setInner] = React.useState(false)
  const entries = disclosureEntries(expandable)
  if (entries.length === 0) return null
  const isOpen = forceOpen || (open ?? inner)
  const toggle = () => {
    const next = !isOpen
    if (open === undefined) setInner(next)
    onOpenChange?.(next)
  }
  const panel = (
    <div id={panelId} hidden={!isOpen} data-slot="why-disclosure-panel" data-variant={isOpen ? "open" : "closed"} className="space-y-1 type-body-sm text-fg-secondary">
      {entries.map((e) => (
        <div key={e.kind} data-slot="why-disclosure-entry" data-variant={e.kind}>{e.content}</div>
      ))}
    </div>
  )
  if (forceOpen) {
    return (
      <div data-slot="why-disclosure" data-variant="forced" className={cn("space-y-1", className)}>
        {panel}
      </div>
    )
  }
  return (
    <div data-slot="why-disclosure" data-variant={isOpen ? "open" : "closed"} className={cn("space-y-1", className)}>
      <button
        type="button"
        data-slot="why-disclosure-trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Escape" && isOpen) {
            e.stopPropagation()
            toggle()
          }
        }}
        className="group/why hit-area inline-flex min-h-10 items-center gap-2 rounded-xs px-1 type-label text-fg-primary underline-offset-4 motion-hover hover:underline"
      >
        Why?
        <Icon icon={ChevronDownIcon} size={16} aria-hidden className="motion-state group-aria-expanded/why:rotate-180" />
      </button>
      {panel}
    </div>
  )
}

export { WhyDisclosure, disclosureEntries }
