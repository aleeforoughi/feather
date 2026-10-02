import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDownIcon } from "lucide-react"
import { cn } from "cn"

import { useThemeMotion } from "@/lib/motion"

/** How an activity line reads: routine, good news, a warning, a failure, or a question for the user. */
export type ActivityTone = "info" | "good" | "warn" | "bad" | "ask"

const toneClass: Record<ActivityTone, string> = {
  info: "text-muted-foreground",
  good: "text-primary",
  warn: "text-foreground",
  bad: "text-destructive",
  ask: "font-medium text-primary",
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
        role="log"
        aria-live="polite"
        onScroll={() => {
          const el = scroller.current
          if (el) setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 48)
        }}
        className="max-h-104 overflow-y-auto px-6 pt-8 pb-6 mask-[linear-gradient(to_bottom,transparent,black_4.5rem)]"
      >
        {empty ? <p className="text-sm text-muted-foreground">{emptyText}</p> : <ol className="space-y-3">
          <AnimatePresence initial={false}>{children}</AnimatePresence>
        </ol>}
      </div>
      {!pinned && (
        <button type="button" data-slot="activity-feed-latest" onClick={() => setPinned(true)} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
          <ArrowDownIcon className="size-3" /> Latest
        </button>
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
  const m = useThemeMotion()
  return (
    <motion.li
      layout={!m.reduced}
      data-slot="activity-item"
      data-variant={tone}
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: m.duration * 2, ease: m.ease }}
      className={cn("flex gap-3 text-sm", className)}
    >
      {icon && <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", toneClass[tone])}>{icon}</span>}
      <div className="min-w-0 flex-1 space-y-1">
        {(time || actor || meta) && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            {time && <span data-slot="activity-item-time" className="font-mono text-xs text-muted-foreground">{time}</span>}
            {actor}
            {meta && <span className="font-mono text-[11px] text-muted-foreground">{meta}</span>}
          </div>
        )}
        <p className={cn("leading-snug", toneClass[tone])}>{typed && !m.reduced ? <TypedText key={text} text={text} /> : text}</p>
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
      {shown < text.length && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-primary align-middle" aria-hidden />}
    </>
  )
}

/** A status dot: pulsing while something is live, the tone's color otherwise. */
function LiveDot({ live = false, tone = "good", className }: { live?: boolean; tone?: Exclude<ActivityTone, "warn" | "ask"> | "ask"; className?: string }) {
  const color = tone === "bad" ? "bg-destructive" : tone === "info" ? "bg-muted-foreground" : "bg-primary"
  return (
    <span data-slot="live-dot" data-variant={tone} className={cn("relative flex size-2.5", className)} aria-hidden>
      {live && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", color)} />}
      <span className={cn("relative inline-flex size-2.5 rounded-full", color)} />
    </span>
  )
}

/** Three dots that breathe in turn: someone is working. */
function WorkingDots({ className }: { className?: string }) {
  const m = useThemeMotion()
  return (
    <span data-slot="working-dots" className={cn("flex gap-0.5", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="size-1.5 rounded-full bg-primary" animate={m.reduced ? {} : { opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
      ))}
    </span>
  )
}

export { ActivityFeed, ActivityItem, LiveDot, TypedText, WorkingDots }
