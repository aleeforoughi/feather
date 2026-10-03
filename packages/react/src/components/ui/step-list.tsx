import * as React from "react"
import { motion } from "motion/react"
import { cn } from "../../lib/cn"

import { useThemeMotion } from "../../lib/motion"

/** Where a step stands. */
export type StepStatus = "pending" | "active" | "done" | "blocked"

/** An ordered plan: numbered steps, each with its status, title, tags and a detail line. */
function StepList({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol data-slot="step-list" className={cn("space-y-3", className)} {...props} />
}

function StepItem({
  index,
  status = "pending",
  title,
  tags,
  detail,
  className,
}: {
  /** 1-based number shown in the marker. */
  index: number
  status?: StepStatus
  title: React.ReactNode
  tags?: React.ReactNode
  detail?: React.ReactNode
  className?: string
}) {
  // Steps enter with the `state` role: a short fade and a 4px rise, one after another.
  const m = useThemeMotion("state")
  const marker = {
    pending: "border border-line-secondary text-fg-secondary",
    active: "border border-primary bg-surface-selected text-fg-primary",
    done: "bg-primary text-primary-foreground",
    blocked: "bg-destructive text-primary-foreground",
  }[status]
  return (
    <motion.li
      data-slot="step-item"
      data-variant={status}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: m.duration, ease: m.ease, delay: m.reduced ? 0 : index * 0.04 }}
      className={cn("flex gap-element", className)}
    >
      <span data-slot="step-marker" className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full type-label", marker)} aria-hidden>
        {status === "active" && !m.reduced && <span data-slot="step-marker-pulse" className="motion-ping absolute inset-0 rounded-full border border-primary" />}
        <span data-slot="step-marker-index">{index}</span>
      </span>
      <div data-slot="step-item-body" className="min-w-0 flex-1 space-y-1">
        <div data-slot="step-item-heading" className="flex flex-wrap items-center gap-2">
          <span data-slot="step-item-title" className="type-label text-fg-primary">{title}</span>
          {tags}
          <span data-slot="step-item-status" className="sr-only">{status}</span>
        </div>
        {detail && <p data-slot="step-item-detail" className="type-caption text-fg-secondary">{detail}</p>}
      </div>
    </motion.li>
  )
}

export { StepItem, StepList }
