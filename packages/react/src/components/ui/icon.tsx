import type { LucideIcon, LucideProps } from "lucide-react"
import { cn } from "cn"
import { iconName, opticalFor, opticalViewBox } from "../../lib/optical"

/** The icon sizes (docs/visual-system.md section 2). "slot" follows the density: --icon-slot (16, 20 or 24px). */
export type IconSize = 16 | 20 | 24 | 32 | "slot"

export interface IconProps extends Omit<LucideProps, "size" | "width" | "height" | "viewBox" | "ref"> {
  /** The lucide icon to draw, for example `PlayIcon`. */
  icon: LucideIcon
  /** A fixed slot, or "slot" (the default) for the density's icon slot. */
  size?: IconSize
}

/**
 * Draws a lucide icon in a square slot and applies the optical registry (src/lib/optical.ts). The outer box is exactly the
 * slot, so it stays on whole pixels; the calibration moves the glyph inside it. Icons in components render through this,
 * never as a bare lucide component with size classes.
 */
function Icon({ icon: Glyph, size = "slot", className, ...props }: IconProps) {
  const optical = opticalFor(iconName(Glyph.displayName), size === "slot" ? 24 : size)
  const corrected = optical.scale !== 1 || optical.dx !== 0 || optical.dy !== 0
  return (
    <Glyph
      data-slot="icon"
      data-variant={String(size)}
      {...props}
      {...(size === "slot" ? {} : { width: size, height: size })}
      {...(corrected ? { viewBox: opticalViewBox(optical) } : {})}
      className={cn("shrink-0", size === "slot" && "size-icon-slot", className)}
    />
  )
}

export { Icon }
