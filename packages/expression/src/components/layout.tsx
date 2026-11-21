import * as React from "react"
import { cn } from "../cn"

export type SplitRatio = "1:1" | "5:7" | "7:5" | "4:8" | "8:4"
export type GridColumns = 2 | 3 | 4

// Literal class names so Tailwind finds them. The first column's span, then the second's, on the 12-column grid.
const SPLIT: Record<SplitRatio, [string, string]> = {
  "1:1": ["md:col-span-6", "md:col-span-6"],
  "5:7": ["md:col-span-5", "md:col-span-7"],
  "7:5": ["md:col-span-7", "md:col-span-5"],
  "4:8": ["md:col-span-4", "md:col-span-8"],
  "8:4": ["md:col-span-8", "md:col-span-4"],
}
const COLUMNS: Record<GridColumns, string> = {
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
}
const SPAN: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  10: "md:col-span-10",
  11: "md:col-span-11",
  12: "md:col-span-12",
}
const ROW_SPAN: Record<number, string> = { 1: "md:row-span-1", 2: "md:row-span-2", 3: "md:row-span-3", 4: "md:row-span-4" }

export interface SplitProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  ratio?: SplitRatio
  /** Swaps the columns on wide screens (the DOM order, and so the reading order, stays the same). */
  reverse?: boolean
  /** Exactly the two columns' contents. */
  children: [React.ReactNode, React.ReactNode]
}

/** Split: two columns on the 12-column grid in a chosen ratio; one column on mobile. */
export const Split = React.forwardRef<HTMLDivElement, SplitProps>(function Split({ ratio = "1:1", reverse = false, className, children, ...props }, ref) {
  const [a, b] = SPLIT[ratio]
  return (
    <div ref={ref} data-slot="split" data-variant={ratio} data-reverse={reverse ? "true" : undefined} className={cn("col-span-full grid w-full grid-cols-1 items-center gap-8 md:grid-cols-12 md:gap-12", className)} {...props}>
      <div data-slot="split-start" className={cn("min-w-0", a, reverse && "md:order-2")}>
        {children[0]}
      </div>
      <div data-slot="split-end" className={cn("min-w-0", b, reverse && "md:order-1")}>
        {children[1]}
      </div>
    </div>
  )
})

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Columns on wide screens; two on tablet (for 3 and 4), one on mobile. */
  columns?: GridColumns
}

/** Grid: equal columns that step down with the viewport. */
export const Grid = React.forwardRef<HTMLDivElement, GridProps>(function Grid({ columns = 3, className, children, ...props }, ref) {
  return (
    <div ref={ref} data-slot="grid" data-variant={String(columns)} className={cn("col-span-full grid w-full gap-6 md:gap-8", COLUMNS[columns], className)} {...props}>
      {children}
    </div>
  )
})

export type BentoProps = React.HTMLAttributes<HTMLDivElement>

/**
 * Bento: a 12-column mosaic. The container's padding is one spacing step (p-2) and its radius is concentric with the
 * cells' (outer = inner + padding), so the corners stay parallel.
 */
export const Bento = React.forwardRef<HTMLDivElement, BentoProps>(function Bento({ className, style, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="bento"
      className={cn("col-span-full grid w-full grid-cols-1 gap-2 bg-surface-subtle p-2 rounded-concentric md:grid-cols-12", className)}
      style={{ ["--concentric-pad" as string]: "calc(var(--spacing, 0.25rem) * 2)", ...style }}
      {...props}
    >
      {children}
    </div>
  )
})

export interface BentoCellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Columns of the 12 this cell spans on tablet and up (1 to 12). */
  span?: number
  /** Rows this cell spans on tablet and up (1 to 4). */
  rowSpan?: number
}

/** BentoCell: one tile of a Bento, a card-radius surface. */
export const BentoCell = React.forwardRef<HTMLDivElement, BentoCellProps>(function BentoCell({ span = 4, rowSpan = 1, className, children, ...props }, ref) {
  return (
    <div ref={ref} data-slot="bento-cell" data-variant={`${span}x${rowSpan}`} className={cn("min-w-0 overflow-hidden bg-surface-raised p-6 text-fg-primary rounded-card", SPAN[span] ?? SPAN[4], ROW_SPAN[rowSpan] ?? ROW_SPAN[1], className)} {...props}>
      {children}
    </div>
  )
})
