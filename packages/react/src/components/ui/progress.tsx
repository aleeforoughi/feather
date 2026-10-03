import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "../../lib/cn"

/** The share (0 to 1) the bar is filled. Progress provides it, so the indicator can scale instead of resizing. */
const FillContext = React.createContext<number | null>(null)

function Progress({
  className,
  children,
  value,
  min = 0,
  max = 100,
  ...props
}: ProgressPrimitive.Root.Props) {
  const fill = value == null || max <= min ? null : Math.min(1, Math.max(0, (value - min) / (max - min)))
  return (
    <ProgressPrimitive.Root
      value={value}
      min={min}
      max={max}
      data-slot="progress"
      className={cn("flex flex-wrap gap-element", className)}
      {...props}
    >
      <FillContext.Provider value={fill}>
        {children}
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </FillContext.Provider>
    </ProgressPrimitive.Root>
  )
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "relative flex h-2 w-full items-center overflow-x-hidden rounded-full bg-surface-pressed",
        className
      )}
      data-slot="progress-track"
      {...props}
    />
  )
}

/**
 * The fill. It always spans the track and is scaled from the left edge, so the `state` role animates a transform,
 * never the width (docs/visual-system.md section 10). Without a value (indeterminate) it draws nothing.
 */
function ProgressIndicator({
  className,
  style,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  const fill = React.useContext(FillContext)
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn("motion-state h-full origin-left bg-primary", className)}
      style={fill === null || typeof style === "function" ? style : { ...style, width: "100%", transform: `scaleX(${fill})` }}
      {...props}
    />
  )
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      className={cn("type-label text-fg-primary", className)}
      data-slot="progress-label"
      {...props}
    />
  )
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn(
        "ml-auto type-body-sm text-fg-secondary tabular-nums",
        className
      )}
      data-slot="progress-value"
      {...props}
    />
  )
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
}
