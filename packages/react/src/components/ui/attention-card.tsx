import * as React from "react"
import { motion } from "motion/react"
import { cn } from "cn"

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
  const m = useThemeMotion()
  const ring = variant === "danger" ? "ring-destructive" : "ring-primary"
  return (
    <motion.section
      role="alertdialog"
      aria-label={typeof title === "string" ? title : undefined}
      data-slot="attention-card"
      data-variant={variant}
      initial={{ opacity: 0, scale: 0.97, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: m.duration * 2, ease: m.ease }}
      className={cn("relative overflow-hidden rounded-lg border-2 bg-card p-5", variant === "danger" ? "border-destructive" : "border-primary", className)}
    >
      {!m.reduced && <motion.span aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-lg ring-4", ring)} animate={{ opacity: [0, 0.55, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />}
      <div className="relative flex flex-wrap items-start gap-4">
        {icon && (
          <motion.span
            data-slot="attention-card-icon"
            animate={m.reduced ? {} : { rotate: [0, -12, 12, -6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.4 }}
            className={cn("flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5", variant === "danger" ? "bg-destructive text-primary-foreground" : "bg-primary text-primary-foreground")}
            aria-hidden
          >
            {icon}
          </motion.span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {eyebrow && <p className={cn("text-xs font-medium tracking-wide uppercase", variant === "danger" ? "text-destructive" : "text-primary")}>{eyebrow}</p>}
          <h2 data-slot="attention-card-title" className="font-heading text-lg font-semibold">{title}</h2>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div data-slot="attention-card-actions" className="flex gap-2">{actions}</div>}
      </div>
    </motion.section>
  )
}

export { AttentionCard }
