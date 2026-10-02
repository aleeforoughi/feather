import * as React from "react"
import { motion } from "motion/react"
import { cn } from "cn"

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
  const m = useThemeMotion()
  const marker = {
    pending: "border border-border text-muted-foreground",
    active: "border-2 border-primary text-primary",
    done: "bg-primary text-primary-foreground",
    blocked: "bg-destructive text-primary-foreground",
  }[status]
  return (
    <motion.li
      data-slot="step-item"
      data-variant={status}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: m.duration * 2, ease: m.ease, delay: m.reduced ? 0 : index * 0.04 }}
      className={cn("flex gap-3", className)}
    >
      <span data-slot="step-marker" className={cn("relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium", marker)} aria-hidden>
        {status === "active" && !m.reduced && <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary opacity-40" />}
        {index}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{title}</span>
          {tags}
          <span className="sr-only">{status}</span>
        </div>
        {detail && <p data-slot="step-item-detail" className="text-xs text-muted-foreground">{detail}</p>}
      </div>
    </motion.li>
  )
}

export { StepItem, StepList }
