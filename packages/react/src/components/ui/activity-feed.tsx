import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDownIcon } from "lucide-react"
import { cn } from "../../lib/cn"

import { useThemeMotion } from "../../lib/motion"
import { Button } from "./button"
import { Icon } from "./icon"

/** How an activity line reads: routine, good news, a warning, a failure, or a question for the user. */
export type ActivityTone = "info" | "good" | "warn" | "bad" | "ask"

/** The line's text. The destructive color stays off text (docs/organisms.md), so a failure reads in the primary emphasis. */
const toneText: Record<ActivityTone, string> = {
  info: "text-fg-secondary",
  good: "text-primary",
  warn: "text-fg-primary",
  bad: "font-medium text-fg-primary",
  ask: "font-medium text-primary",
}

/** The line's icon carries the tone. */
const toneIcon: Record<ActivityTone, string> = {
  info: "text-fg-secondary",
  good: "text-primary",
  warn: "text-fg-primary",
  bad: "text-destructive",
  ask: "text-primary",
}

/** Older lines fade out at the top: transparent at the edge, opaque 64px in. A mask, so it needs no extra surface. */
const FADE: React.CSSProperties = {
  maskImage: "linear-gradient(to bottom, transparent, black calc(var(--spacing) * 16))",
  WebkitMaskImage: "linear-gradient(to bottom, transparent, black calc(var(--spacing) * 16))",
}

/**
 * A live log: newest at the bottom, older lines fading out above, auto-following new lines until the user
 * scrolls up (then a "Latest" button brings them back). Children are ActivityItems.
 */
function ActivityFeed({ className, children, followKey, emptyText = "Nothing yet.", ...props }: React.ComponentProps<"div"> & { followKey?: string | number; emptyText?: React.ReactNode }) {
  const scroller = React.useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = React.useState(true)
  React.useEffect(() => {
    const el = scroller.current
    if (el && pinned) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [followKey, pinned])
  const empty = React.Children.count(children) === 0
  return (
    <div data-slot="activity-feed" className={cn("relative", className)} {...props}>
      <div
        ref={scroller}
        data-slot="activity-feed-scroller"
        role="log"
        aria-live="polite"
        onScroll={() => {
          const el = scroller.current
          if (el) setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 48)
        }}
        className="max-h-[60vh] overflow-y-auto px-container pt-8 pb-6"
        style={FADE}
      >
        {empty ? <p data-slot="activity-feed-empty" className="type-body-sm text-fg-secondary">{emptyText}</p> : <ol data-slot="activity-feed-list" className="space-y-3">
          <AnimatePresence initial={false}>{children}</AnimatePresence>
        </ol>}
      </div>
      {!pinned && (
        <div data-slot="activity-feed-latest-anchor" className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <Button type="button" size="sm" data-slot="activity-feed-latest" onClick={() => setPinned(true)} className="rounded-full">
            <Icon icon={ArrowDownIcon} size={16} /> Latest
          </Button>
        </div>
      )}
    </div>
  )
}

/** One line of the feed: an icon, a time, an optional actor badge, the text (typed out when newest), details. */
function ActivityItem({
  tone = "info",
  icon,
  time,
  actor,
  meta,
  text,
  typed = false,
  children,
  className,
}: {
  tone?: ActivityTone
  icon?: React.ReactNode
  time?: React.ReactNode
  actor?: React.ReactNode
  meta?: React.ReactNode
  text: string
  /** Type the text out (the newest line), once. */
  typed?: boolean
  /** Details below the text: action lines, thumbnails… */
  children?: React.ReactNode
  className?: string
}) {
  // A new line enters like a toast: medium, 8px.
  const m = useThemeMotion("toast")
  return (
    <motion.li
      layout={!m.reduced}
      data-slot="activity-item"
      data-variant={tone}
      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: m.duration, ease: m.ease }}
      className={cn("flex gap-element type-body-sm", className)}
    >
      {icon && <span data-slot="activity-item-icon" className={cn("flex h-5 shrink-0 items-center [&_svg]:size-icon-slot", toneIcon[tone])}>{icon}</span>}
      <div data-slot="activity-item-body" className="min-w-0 flex-1 space-y-1">
        {(time || actor || meta) && (
          <div data-slot="activity-item-meta-row" className="flex flex-wrap items-baseline gap-x-2">
            {time && <span data-slot="activity-item-time" className="font-mono type-caption text-fg-tertiary">{time}</span>}
            {actor}
            {meta && <span data-slot="activity-item-meta" className="font-mono type-caption text-fg-tertiary">{meta}</span>}
          </div>
        )}
        <p data-slot="activity-item-text" className={toneText[tone]}>{typed && !m.reduced ? <TypedText key={text} text={text} /> : text}</p>
        {children && <div data-slot="activity-item-detail">{children}</div>}
      </div>
    </motion.li>
  )
}

/** Text that types itself out once, with a blinking caret while it does. */
function TypedText({ text }: { text: string }) {
  const [shown, setShown] = React.useState(0)
  React.useEffect(() => {
    const step = Math.max(1, Math.round(text.length / 90))
    const timer = setInterval(() => setShown((n) => (n >= text.length ? (clearInterval(timer), n) : n + step)), 16)
    return () => clearInterval(timer)
  }, [text])
  return (
    <>
      {text.slice(0, shown)}
      {shown < text.length && <span data-slot="typed-text-caret" className="motion-loading ml-1 inline-block h-4 w-1 bg-primary align-middle" aria-hidden />}
    </>
  )
}

/** A status dot: pulsing while something is live, the tone's color otherwise. */
function LiveDot({ live = false, tone = "good", className }: { live?: boolean; tone?: Exclude<ActivityTone, "warn" | "ask"> | "ask"; className?: string }) {
  const color = tone === "bad" ? "bg-destructive" : tone === "info" ? "bg-fg-secondary" : "bg-primary"
  return (
    <span data-slot="live-dot" data-variant={tone} className={cn("relative flex size-2", className)} aria-hidden>
      {live && <span data-slot="live-dot-ping" className={cn("motion-ping absolute inline-flex size-full rounded-full", color)} />}
      <span data-slot="live-dot-core" className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  )
}

/** Three dots that breathe in turn: someone is working. */
function WorkingDots({ className }: { className?: string }) {
  const m = useThemeMotion()
  return (
    <span data-slot="working-dots" className={cn("flex gap-1", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} data-slot="working-dot" className="size-2 rounded-full bg-primary" animate={m.reduced ? {} : { opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.6, ease: m.ease, repeat: Infinity, delay: i * 0.2 }} />
      ))}
    </span>
  )
}

export { ActivityFeed, ActivityItem, LiveDot, TypedText, WorkingDots }
