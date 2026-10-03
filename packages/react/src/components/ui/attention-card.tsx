import * as React from "react"
import { motion } from "motion/react"
import { cn } from "../../lib/cn"

import { useThemeMotion } from "../../lib/motion"

/**
 * A rare, important question for the user — it pulses until answered, with the choice on the card.
 * Variant "default" asks; "danger" asks about something risky.
 */
function AttentionCard({
  eyebrow,
  title,
  description,
  icon,
  actions,
  variant = "default",
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  actions?: React.ReactNode
  variant?: "default" | "danger"
  className?: string
}) {
  // It enters like a popover (medium, 8px, scale 0.99 to 1). The attention pulse loops on the same curve.
  const m = useThemeMotion("popover")
  const ring = variant === "danger" ? "ring-destructive" : "ring-primary"
  return (
    <motion.section
      role="alertdialog"
      aria-label={typeof title === "string" ? title : undefined}
      data-slot="attention-card"
      data-region="content"
      data-variant={variant}
      initial={{ opacity: 0, scale: 0.99, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: m.duration, ease: m.ease }}
      className={cn("relative overflow-hidden rounded-card border inset-content", variant === "danger" ? "border-destructive bg-destructive-muted" : "border-primary bg-card", className)}
    >
      {!m.reduced && <motion.span data-slot="attention-card-pulse" aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-card ring-4", ring)} animate={{ opacity: [0, 0.55, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: m.ease }} />}
      <div data-slot="attention-card-body" className="relative flex flex-wrap items-start gap-group">
        {icon && (
          <span
            data-slot="attention-card-icon"
            className={cn("flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5", !m.reduced && "motion-wiggle", variant === "danger" ? "bg-destructive text-primary-foreground" : "bg-primary text-primary-foreground")}
            aria-hidden
          >
            {icon}
          </span>
        )}
        <div data-slot="attention-card-content" className="min-w-0 flex-1 space-y-1">
          {eyebrow && <p data-slot="attention-card-eyebrow" className="type-caps text-fg-secondary">{eyebrow}</p>}
          <h2 data-slot="attention-card-title" className="font-heading type-title text-fg-primary">{title}</h2>
          {description && <div data-slot="attention-card-description" className="type-body-sm text-fg-secondary">{description}</div>}
        </div>
        {actions && <div data-slot="attention-card-actions" className="flex gap-action">{actions}</div>}
      </div>
    </motion.section>
  )
}

export { AttentionCard }
