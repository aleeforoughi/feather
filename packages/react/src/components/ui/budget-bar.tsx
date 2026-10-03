import { cn } from "../../lib/cn"

/** Where a budget stands: below target (ok), approaching the cap (warm), close to it (hot), past it (over). */
export type BudgetZone = "ok" | "warm" | "hot" | "over"

export type BudgetInput = { spent: number; target?: number | null; cap: number }

/** Without a target, the ok zone covers this share of the cap. */
export const DEFAULT_TARGET_SHARE = 0.75

/** Zone of a budget: ok up to the target; between target and cap it warms, then heats; past the cap it is over. */
function budgetZone({ spent, target, cap }: BudgetInput): { zone: BudgetZone; heat: number } {
  const t = target ?? cap * DEFAULT_TARGET_SHARE
  if (spent > cap) return { zone: "over", heat: 1 }
  if (spent <= t) return { zone: "ok", heat: 0 }
  const span = cap - t
  const heat = span > 0 ? Math.min(1, Math.max(0, (spent - t) / span)) : 1
  return { zone: heat < 0.5 ? "warm" : "hot", heat }
}

export type BudgetGeometry = {
  /** Percent positions (0-100) on the bar's scale. */
  fill: number
  reserved: number
  target: number | null
  cap: number
  overshoot: number
}

/** The scale shows the cap plus headroom, and grows when the amount goes past it. */
function budgetGeometry({ spent, target, cap, reserved = 0 }: BudgetInput & { reserved?: number }): BudgetGeometry {
  const used = spent + Math.max(0, reserved)
  const scale = Math.max(cap * 1.15, used * 1.05, 1)
  const pct = (n: number) => Math.min(100, Math.max(0, (n / scale) * 100))
  const fill = pct(Math.min(spent, scale))
  return {
    fill,
    reserved: Math.max(0, pct(used) - fill),
    target: target == null ? null : pct(target),
    cap: pct(cap),
    overshoot: spent > cap ? pct(spent) - pct(cap) : 0,
  }
}

const ZONE_FILL: Record<BudgetZone, string> = {
  ok: "bg-success",
  warm: "bg-warning",
  hot: "bg-warning",
  over: "bg-destructive",
}

const ZONE_LABEL: Record<BudgetZone, string> = {
  ok: "within target",
  warm: "approaching the cap",
  hot: "close to the cap",
  over: "over the cap",
}

const STRIPES = (gap: number) => `repeating-linear-gradient(135deg, transparent 0 3px, var(--background) 3px ${gap}px)`

const plain = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 })

type BudgetBarProps = {
  /** Amount used so far (fills the bar). */
  spent: number
  /** The hard limit; the bar shows it with headroom. */
  cap: number
  /** A softer goal below the cap; optional. */
  target?: number | null
  /** Committed but not yet used, drawn as a striped segment after the fill. */
  reserved?: number
  /** "mini" is just the fill against the cap, with no markers or caption. */
  size?: "default" | "mini"
  /** Formats an amount (currency, bytes, counts…); defaults to a plain number. */
  format?: (amount: number) => string
  /** Accessible name of the meter. */
  label?: string
  className?: string
}

/** A budget meter: fill = used, markers for target and cap, colored by zone (ok, warm, hot, over). Budgets, quotas, storage. */
function BudgetBar({ spent, cap, target = null, reserved = 0, size = "default", format = plain, label = "Budget", className }: BudgetBarProps) {
  const { zone } = budgetZone({ spent, target, cap })
  const g = budgetGeometry({ spent, target, cap, reserved })
  const mini = size === "mini"
  const caption =
    target != null ? `${format(spent)} of ${format(target)} target · cap ${format(cap)}` : `${format(spent)} of ${format(cap)}`
  const crowded = target != null && target < cap * 0.2
  return (
    <div data-slot="budget-bar" data-variant={zone} data-size={size} className={cn("w-full", className)}>
      <div
        data-slot="budget-bar-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={spent}
        aria-valuetext={`${caption}, ${ZONE_LABEL[zone]}`}
        className={cn("relative w-full rounded-full bg-surface-pressed", mini ? "h-1" : "h-2")}
      >
        <div data-slot="budget-bar-clip" className="absolute inset-0 overflow-hidden rounded-full">
          <div data-slot="budget-bar-fill" className={cn("motion-state absolute inset-y-0 left-0 w-full origin-left", ZONE_FILL[zone])} style={{ transform: `scaleX(${g.fill / 100})` }} />
          {zone === "over" && g.overshoot > 0 && (
            <div data-slot="budget-bar-overshoot" className="absolute inset-y-0 bg-destructive" style={{ left: `${g.cap}%`, width: `${g.overshoot}%`, backgroundImage: STRIPES(4) }} />
          )}
          {g.reserved > 0 && (
            <div data-slot="budget-bar-reserved" className={cn("absolute inset-y-0", ZONE_FILL[zone])} style={{ left: `${g.fill}%`, width: `${g.reserved}%`, backgroundImage: STRIPES(6) }} />
          )}
        </div>
        {!mini && g.target != null && <Marker at={g.target} />}
        {!mini && <Marker at={g.cap} strong />}
      </div>
      {!mini && (
        <div data-slot="budget-bar-scale" className="relative mt-1 h-4 type-caption text-fg-tertiary" aria-hidden>
          {g.target != null && !crowded && <MarkerLabel at={g.target} text={`target ${format(target!)}`} align="end" />}
          <MarkerLabel at={g.cap} text={`cap ${format(cap)}`} align={g.target != null && g.cap - g.target < 24 ? "start" : "end"} />
        </div>
      )}
      {!mini && <p data-slot="budget-bar-caption" className="mt-1 type-caption text-fg-secondary">{caption}</p>}
    </div>
  )
}

function Marker({ at, strong }: { at: number; strong?: boolean }) {
  return <span data-slot="budget-bar-marker" aria-hidden className={cn("absolute w-px -translate-x-1/2", strong ? "-top-2 -bottom-2 bg-fg-primary" : "-top-1 -bottom-1 bg-fg-tertiary")} style={{ left: `${at}%` }} />
}

function MarkerLabel({ at, text, align }: { at: number; text: string; align: "start" | "end" }) {
  return <span data-slot="budget-bar-marker-label" className={cn("absolute whitespace-nowrap", align === "end" ? "-translate-x-full pr-1" : "pl-1")} style={{ left: `${at}%` }}>{text}</span>
}

export { BudgetBar, budgetGeometry, budgetZone }
export type { BudgetBarProps }
