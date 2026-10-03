import * as React from "react"
import { SparklesIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "./button"
import { Card } from "./card"
import { ConsequenceStatement, type Consequence } from "./consequence-statement"
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

/**
 * What the caller recommends (IR node Recommendation). One button accepts it. An irreversible recommendation with
 * no consequence of its own never commits: accepting only moves on to the IrreversibleAction that confirms it.
 */
function Recommendation({ intent, summary, label, confidence, consequence, reversible, importance = "normal", expandable, primary, locale = "en", onAct, className }: {
  intent: string
  summary: React.ReactNode
  label?: string
  /** 0 to 1. */
  confidence?: number
  consequence?: Consequence
  reversible?: boolean
  importance?: "low" | "normal" | "high" | "critical"
  expandable?: Expandable
  primary?: boolean
  locale?: string
  onAct: (act: "accept") => void
  className?: string
}) {
  const id = React.useId()
  const [whyOpen, setWhyOpen] = React.useState(false)
  const actText = upperFirst(label ?? intent)
  const hasConsequence = consequence !== undefined
  const describedBy = `${id}-${hasConsequence ? "consequence" : "next"}`
  const accept = () => {
    setWhyOpen(false)
    onAct("accept")
  }
  return (
    <Card
      data-slot="recommendation"
      data-variant={reversible === false ? "irreversible" : "default"}
      data-importance={importance}
      data-primary={primary ? "true" : undefined}
      className={cn("gap-3 px-(--card-spacing)", className)}
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          data-slot="recommendation-accept"
          variant={primary ? "default" : "outline"}
          aria-label={`Accept recommendation: ${actText}`}
          aria-describedby={describedBy}
          onClick={accept}
          className="h-auto min-h-8 py-1 whitespace-normal"
        >
          {actText}
        </Button>
        {expandable && <WhyDisclosure expandable={expandable} open={whyOpen} onOpenChange={setWhyOpen} forceOpen={importance === "critical"} className="basis-full" />}
      </div>
    </Card>
  )
}

export { Recommendation, confidenceLabel, confidenceText, nextStepText }
