import * as React from "react"
import { MinusIcon, PlusIcon } from "lucide-react"
import { cn } from "../../lib/cn"

import { Icon } from "./icon"

/** How much a node matters, as the Experience IR names it. */
type TradeoffImportance = "low" | "normal" | "high" | "critical"

type TradeoffProps = {
  /** The tradeoff in one line. */
  summary?: React.ReactNode
  /** What the option gains. */
  gains?: string[]
  /** What the option costs. */
  costs?: string[]
  importance?: TradeoffImportance
  className?: string
} & Omit<React.ComponentProps<"div">, "className" | "children">

/**
 * What one option gains and costs, as two titled lists. Each item carries an icon with a screen-reader word
 * ("Gain:" or "Cost:"), so meaning never rests on color. It takes no acts.
 */
function Tradeoff({ summary, gains, costs, importance, className, ...props }: TradeoffProps) {
  const uid = React.useId()
  const hasGains = (gains?.length ?? 0) > 0
  const hasCosts = (costs?.length ?? 0) > 0
  const variant = hasGains && hasCosts ? "gains-and-costs" : hasGains ? "gains" : hasCosts ? "costs" : "summary"
  return (
    <div
      data-slot="tradeoff"
      data-variant={variant}
      data-importance={importance}
      className={cn("flex flex-col gap-2 type-body-sm", className)}
      {...props}
    >
      {summary && <p data-slot="tradeoff-summary" className="text-fg-primary">{summary}</p>}
      {(hasGains || hasCosts) && (
        <div data-slot="tradeoff-columns" className="grid gap-3 sm:grid-cols-2">
          {hasGains && <TradeoffList kind="gain" title="Gains" items={gains!} titleId={`${uid}-gains`} />}
          {hasCosts && <TradeoffList kind="cost" title="Costs" items={costs!} titleId={`${uid}-costs`} />}
        </div>
      )}
    </div>
  )
}

function TradeoffList({ kind, title, items, titleId }: { kind: "gain" | "cost"; title: string; items: string[]; titleId: string }) {
  const glyph = kind === "gain" ? PlusIcon : MinusIcon
  return (
    <div data-slot={kind === "gain" ? "tradeoff-gains" : "tradeoff-costs"} data-variant={kind} className="flex flex-col gap-1">
      <p id={titleId} data-slot="tradeoff-title" className="type-caps text-fg-secondary">
        {title}
      </p>
      <ul aria-labelledby={titleId} data-slot="tradeoff-items" className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={`${i}-${item}`} data-slot="tradeoff-item" data-variant={kind} className="flex items-start gap-2">
            <span data-slot="tradeoff-item-icon" className="flex h-5 shrink-0 items-center">
              <Icon icon={glyph} size={16} aria-hidden="true" className="text-fg-primary" />
            </span>
            <span data-slot="tradeoff-item-prefix" className="sr-only">{kind === "gain" ? "Gain:" : "Cost:"}</span>
            <span data-slot="tradeoff-item-text" className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { Tradeoff }
export type { TradeoffProps, TradeoffImportance }
