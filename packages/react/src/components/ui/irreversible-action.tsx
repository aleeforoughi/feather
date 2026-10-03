import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { useThemeMotion } from "../../lib/motion"
import { Button } from "./button"
import { Card } from "./card"
import { ConsequenceStatement, consequenceSentences, type Consequence } from "./consequence-statement"
import { WhyDisclosure, type Expandable } from "./why-disclosure"

/** How long a hold must last, in milliseconds. */
const HOLD_MS = 1500
/** With reduced motion the fill steps in this many equal jumps. */
const REDUCED_STEPS = 4

/** Milliseconds on a monotonic clock. */
const now = () => performance.now()

function upperFirst(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s
}
function lowerFirst(s: string): string {
  return s.length > 0 ? s[0]!.toLowerCase() + s.slice(1) : s
}

/** Hold progress from 0 to 1. With reduced motion it steps (a quarter at a time) instead of sliding. */
function holdProgress(elapsedMs: number, holdMs: number, reduced: boolean): number {
  const p = holdMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / holdMs))
  return reduced && p < 1 ? Math.floor(p * REDUCED_STEPS) / REDUCED_STEPS : p
}

/** The outcome after confirming: "Confirmed: spends AED 1,050". */
function outcomeText(consequence: Consequence, locale = "en"): string {
  // The generated sentences start with a verb ("Spends…"), lower-cased after the colon; a statement is the
  // caller's own words and keeps its case (it may start with a name).
  const sentences = consequenceSentences(consequence, locale).map((s) => (s === consequence.statement ? s : lowerFirst(s)))
  return `Confirmed: ${sentences.join("; ")}`
}

/** The words a hold button shows: "Hold to spend AED 1,050". */
function holdLabel(act: string): string {
  return `Hold to ${lowerFirst(act)}`
}

/**
 * An act that cannot be undone (IR node IrreversibleAction). The consequence always shows first. It never takes
 * the default focus and never confirms on render or on a single click.
 *
 * Confirm mode: the first button arms, then focus moves to "Yes, ..." beside "Cancel". Hold mode: one button, held
 * for 1.5 s by pointer or with Space or Enter held down.
 */
function IrreversibleAction({ intent, label, consequence, importance = "critical", expandable, locale = "en", mode = "confirm", holdMs = HOLD_MS, defaultExpanded = false, onAct, className }: {
  intent: string
  label?: string
  consequence: Consequence
  importance?: "high" | "critical"
  expandable?: Expandable
  locale?: string
  mode?: "confirm" | "hold"
  /** How long a hold lasts, in milliseconds (default 1500). */
  holdMs?: number
  /** Whether "Why?" starts open (a layout plan's `expanded`). Confirming closes it. */
  defaultExpanded?: boolean
  onAct: (act: "confirm" | "cancel") => void
  className?: string
}) {
  const id = React.useId()
  const m = useThemeMotion()
  const act = upperFirst(label ?? intent)
  const [armed, setArmed] = React.useState(false)
  const [whyOpen, setWhyOpen] = React.useState(defaultExpanded)
  const [status, setStatus] = React.useState("")
  const [progress, setProgress] = React.useState(0)
  const [holding, setHolding] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const doneRef = React.useRef(false)
  const outcomeRef = React.useRef<HTMLParagraphElement>(null)
  const firstRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)
  const focusOn = React.useRef<"confirm" | "first" | "outcome" | null>(null)
  const hold = React.useRef<{ start: number; frame: number; done: boolean } | null>(null)
  const consequenceId = `${id}-consequence`
  const hintId = `${id}-hint`

  React.useEffect(() => {
    const target = focusOn.current
    if (!target) return
    focusOn.current = null
    ;(target === "confirm" ? confirmRef.current : target === "outcome" ? outcomeRef.current : firstRef.current)?.focus()
  })

  const stopHold = React.useCallback((announce: boolean) => {
    const h = hold.current
    if (!h) return
    cancelAnimationFrame(h.frame)
    const finished = h.done
    hold.current = null
    setHolding(false)
    setProgress(0)
    if (announce && !finished) setStatus("Hold released. Nothing was done.")
  }, [])
  React.useEffect(() => () => { if (hold.current) cancelAnimationFrame(hold.current.frame) }, [])

  const arm = () => {
    setArmed(true)
    setStatus(`Armed: press again to ${lowerFirst(act)}. Press Escape to cancel.`)
    focusOn.current = "confirm"
  }
  const disarm = (cancelled: boolean) => {
    setArmed(false)
    focusOn.current = "first"
    if (cancelled) {
      setStatus("Cancelled. Nothing was done.")
      onAct("cancel")
    }
  }
  // The act happens once: after this the organism offers nothing that could act again.
  const finish = () => {
    if (doneRef.current) return false
    doneRef.current = true
    setDone(true)
    setArmed(false)
    setWhyOpen(false)
    setHolding(false)
    setProgress(0)
    setStatus("")
    focusOn.current = "outcome"
    return true
  }
  const confirm = () => {
    if (finish()) onAct("confirm")
  }

  const startHold = () => {
    if (hold.current) return
    const h = { start: now(), frame: 0, done: false }
    hold.current = h
    setHolding(true)
    setStatus(`Holding: keep holding for ${(holdMs / 1000).toFixed(holdMs % 1000 === 0 ? 0 : 1)} seconds to ${lowerFirst(act)}.`)
    const tick = () => {
      const elapsed = now() - h.start
      const p = holdProgress(elapsed, holdMs, m.reduced)
      setProgress(p)
      if (elapsed >= holdMs) {
        h.done = true
        hold.current = null
        confirm()
        return
      }
      h.frame = requestAnimationFrame(tick)
    }
    h.frame = requestAnimationFrame(tick)
  }
  // A finished hold stays "done" until the person lets go, so one long press confirms once.
  const releaseHold = (announce: boolean) => {
    const h = hold.current
    if (h?.done) {
      hold.current = null
      setHolding(false)
      setProgress(0)
      return
    }
    stopHold(announce)
  }

  const variant = done ? "done" : mode === "hold" ? (holding ? "holding" : "idle") : armed ? "armed" : "idle"
  const showArmed = mode === "confirm" && armed

  return (
    <Card
      data-slot="irreversible-action"
      data-variant={variant}
      data-mode={mode}
      data-importance={importance}
      className={cn("gap-3 px-(--card-spacing) ring-2 ring-destructive", className)}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || done) return
        if (mode === "confirm" && armed) {
          e.preventDefault()
          disarm(true)
        } else if (mode === "hold" && hold.current) {
          e.preventDefault()
          releaseHold(true)
        }
      }}
    >
      <div className="flex items-start gap-2">
        <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-1">
          <p data-slot="irreversible-action-warning" className="text-xs font-semibold tracking-wide text-foreground uppercase">Cannot be undone</p>
          <ConsequenceStatement id={consequenceId} consequence={consequence} locale={locale} />
        </div>
      </div>

      {done && (
        <p ref={outcomeRef} tabIndex={-1} role="status" data-slot="irreversible-action-outcome" className="rounded-md text-sm font-semibold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {outcomeText(consequence, locale)}
        </p>
      )}
      {!done && <div className="flex flex-wrap items-center gap-2">
        {mode === "confirm" ? (
          <>
            <Button
              ref={firstRef}
              type="button"
              data-slot="irreversible-action-arm"
              data-variant={armed ? "armed" : "default"}
              variant="outline"
              disabled={armed}
              aria-describedby={consequenceId}
              onClick={arm}
              className="h-auto min-h-8 border-destructive py-1 whitespace-normal"
            >
              {act}…
            </Button>
            {showArmed && (
              <>
                <Button
                  ref={confirmRef}
                  type="button"
                  data-slot="irreversible-action-confirm"
                  data-variant="confirm"
                  aria-label={`Yes, ${lowerFirst(act)}`}
                  aria-describedby={consequenceId}
                  onKeyDown={(e) => {
                    // Holding Enter on the arming button must not repeat into the confirming one.
                    if (e.repeat && (e.key === "Enter" || e.key === " ")) e.preventDefault()
                  }}
                  onClick={(e) => {
                    if (e.detail > 1) return
                    confirm()
                  }}
                  className="h-auto min-h-8 py-1 whitespace-normal"
                >
                  Yes, {lowerFirst(act)}
                </Button>
                <Button type="button" data-slot="irreversible-action-cancel" data-variant="cancel" variant="outline" onClick={() => disarm(true)}>Cancel</Button>
              </>
            )}
          </>
        ) : (
          <Button
            ref={firstRef}
            type="button"
            data-slot="irreversible-action-hold"
            data-variant={holding ? "holding" : "default"}
            data-progress={progress.toFixed(2)}
            variant="outline"
            aria-describedby={`${consequenceId} ${hintId}`}
            onClick={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              if (e.button === 0) startHold()
            }}
            onPointerUp={() => releaseHold(true)}
            onPointerLeave={() => releaseHold(true)}
            onPointerCancel={() => releaseHold(true)}
            onBlur={() => releaseHold(true)}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                if (!e.repeat) startHold()
              }
            }}
            onKeyUp={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                releaseHold(true)
              }
            }}
            className="relative h-auto min-h-8 touch-none border-destructive overflow-hidden py-1 whitespace-normal"
          >
            <span aria-hidden data-slot="irreversible-action-fill" style={{ width: `${progress * 100}%` }} className="pointer-events-none absolute inset-y-0 left-0 bg-destructive/30" />
            <span className="relative">{holdLabel(act)}</span>
          </Button>
        )}
      </div>}
      {!done && mode === "hold" && (
        <p id={hintId} data-slot="irreversible-action-hint" className="text-sm text-muted-foreground">
          Press and hold for {(holdMs / 1000).toFixed(holdMs % 1000 === 0 ? 0 : 1)} seconds, with the pointer or by holding Space or Enter. Letting go early does nothing.
        </p>
      )}

      <p role="status" data-slot="irreversible-action-status" data-variant={showArmed ? "armed" : "idle"} className={cn("text-sm font-medium", status ? "text-foreground" : "sr-only")}>
        {status}
      </p>

      {expandable && !done && <WhyDisclosure expandable={expandable} open={whyOpen} onOpenChange={setWhyOpen} forceOpen={importance === "critical"} />}
    </Card>
  )
}

export { IrreversibleAction, holdLabel, outcomeText, holdProgress, HOLD_MS }
