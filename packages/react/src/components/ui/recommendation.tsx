import * as React from "react"
import { SparklesIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "./button"
import { Card } from "./card"
import { ConsequenceStatement, type Consequence } from "./consequence-statement"
import { outcomeText } from "./irreversible-action"
import { WhyDisclosure, type Expandable } from "./why-disclosure"

/** "low" below 0.5, "medium" below 0.8, otherwise "high". Out-of-range values are clamped. */
function confidenceLabel(confidence: number): "low" | "medium" | "high" {
  const c = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0
  return c < 0.5 ? "low" : c < 0.8 ? "medium" : "high"
}

/** "Confidence: high (78%)": words first, never a bare number or a color. */
function confidenceText(confidence: number): string {
  const c = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0
  return `Confidence: ${confidenceLabel(c)} (${Math.round(c * 100)}%)`
}

/** What accepting leads to when the recommendation states no consequence of its own. */
function nextStepText(reversible: boolean | undefined): string {
  return reversible === false ? "Next, you confirm. Nothing is done until you do." : "Accepting applies it. You can undo it."
}

function upperFirst(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s
}
function lowerFirst(s: string): string {
  return s.length > 0 ? s[0]!.toLowerCase() + s.slice(1) : s
}

/** The outcome once accepted with arming: "Confirmed: spends AED 1,050", or "Accepted." with no consequence. */
function acceptOutcome(consequence: Consequence | undefined, locale: string): string {
  return consequence ? outcomeText(consequence, locale) : "Accepted."
}

/**
 * What the caller recommends (IR node Recommendation). One button accepts it. An irreversible recommendation with
 * no consequence of its own never commits: accepting only moves on to the IrreversibleAction that confirms it. One
 * that states a consequence and commits by itself arms first (`arm`): two deliberate acts, like IrreversibleAction.
 */
function Recommendation({ intent, summary, label, confidence, consequence, reversible, arm, importance = "normal", expandable, primary, locale = "en", defaultExpanded = false, onAct, className }: {
  intent: string
  summary: React.ReactNode
  label?: string
  /** 0 to 1. */
  confidence?: number
  consequence?: Consequence
  reversible?: boolean
  /**
   * Whether accepting arms first (two deliberate acts). Default: when it states a consequence. A layout plan passes
   * its `confirm`; a Recommendation that an IrreversibleAction commits does not arm.
   */
  arm?: boolean
  importance?: "low" | "normal" | "high" | "critical"
  expandable?: Expandable
  primary?: boolean
  locale?: string
  /** Whether "Why?" starts open (a layout plan's `expanded`). Acting on the recommendation still closes it. */
  defaultExpanded?: boolean
  onAct: (act: "accept") => void
  className?: string
}) {
  const id = React.useId()
  const [whyOpen, setWhyOpen] = React.useState(defaultExpanded)
  const actText = upperFirst(label ?? intent)
  const hasConsequence = consequence !== undefined
  const describedBy = `${id}-${hasConsequence ? "consequence" : "next"}`
  const needsConfirm = arm ?? hasConsequence
  const [mode, setMode] = React.useState<"idle" | "armed" | "done">("idle")
  const [status, setStatus] = React.useState("")
  const doneRef = React.useRef(false)
  const outcomeRef = React.useRef<HTMLParagraphElement>(null)
  const firstRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)
  const focusOn = React.useRef<"confirm" | "first" | "outcome" | null>(null)

  React.useEffect(() => {
    const target = focusOn.current
    if (!target) return
    focusOn.current = null
    ;(target === "confirm" ? confirmRef.current : target === "outcome" ? outcomeRef.current : firstRef.current)?.focus()
  })

  const accept = () => {
    setWhyOpen(false)
    onAct("accept")
  }
  const startAccept = () => {
    if (!needsConfirm) return accept()
    setMode("armed")
    setStatus(`Armed: press again to ${lowerFirst(actText)}. Press Escape to cancel.`)
    focusOn.current = "confirm"
  }
  const disarm = () => {
    setMode("idle")
    setStatus("Cancelled. Nothing was done.")
    focusOn.current = "first"
  }
  // The act happens once: after this the organism offers nothing that could accept again.
  const confirm = () => {
    if (doneRef.current) return
    doneRef.current = true
    setMode("done")
    setStatus("")
    focusOn.current = "outcome"
    accept()
  }
  const armed = mode === "armed"
  const done = mode === "done"
  return (
    <Card
      data-slot="recommendation"
      data-variant={done ? "done" : armed ? "armed" : reversible === false ? "irreversible" : "default"}
      data-importance={importance}
      data-primary={primary ? "true" : undefined}
      className={cn("gap-3 px-(--card-spacing)", className)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && armed) {
          e.preventDefault()
          disarm()
        }
      }}
    >
      <div className="flex items-start gap-2">
        <SparklesIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 space-y-1">
          <p data-slot="recommendation-eyebrow" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Recommended</p>
          <p data-slot="recommendation-summary" className="font-heading text-base leading-snug font-medium break-words">{summary}</p>
          {confidence !== undefined && (
            <p data-slot="recommendation-confidence" data-variant={confidenceLabel(confidence)} className="text-sm text-muted-foreground">{confidenceText(confidence)}</p>
          )}
        </div>
      </div>
      {consequence && <ConsequenceStatement id={`${id}-consequence`} consequence={consequence} locale={locale} />}
      {!hasConsequence && <p id={`${id}-next`} data-slot="recommendation-next" className="text-sm text-muted-foreground">{nextStepText(reversible)}</p>}
      {done && (
        <p ref={outcomeRef} tabIndex={-1} role="status" data-slot="recommendation-outcome" className="rounded-md text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {acceptOutcome(consequence, locale)}
        </p>
      )}
      {!done && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            ref={firstRef}
            data-slot="recommendation-accept"
            data-variant={armed ? "armed" : "default"}
            variant={primary ? "default" : "outline"}
            disabled={armed}
            aria-label={`Accept recommendation: ${actText}`}
            aria-describedby={describedBy}
            onClick={startAccept}
            className="h-auto min-h-8 py-1 whitespace-normal"
          >
            {actText}{needsConfirm ? "…" : ""}
          </Button>
          {armed && (
            <>
              <Button
                ref={confirmRef}
                type="button"
                data-slot="recommendation-confirm"
                data-variant="confirm"
                aria-label={`Yes, ${lowerFirst(actText)}`}
                aria-describedby={describedBy}
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
                Yes, {lowerFirst(actText)}
              </Button>
              <Button type="button" data-slot="recommendation-cancel" data-variant="cancel" variant="outline" onClick={disarm}>Cancel</Button>
            </>
          )}
          {expandable && <WhyDisclosure expandable={expandable} open={whyOpen} onOpenChange={setWhyOpen} forceOpen={importance === "critical"} className="basis-full" />}
        </div>
      )}
      {needsConfirm && (
        <p role="status" data-slot="recommendation-status" data-variant={armed ? "armed" : "idle"} className={cn("text-sm font-medium", armed ? "text-foreground" : "sr-only")}>{status}</p>
      )}
    </Card>
  )
}

export { Recommendation, confidenceLabel, confidenceText, nextStepText }
