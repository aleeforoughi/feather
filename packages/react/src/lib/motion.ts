import * as React from "react"
import { useReducedMotion } from "motion/react"

/** Cubic-bezier control points, as motion takes them. */
export type Ease = [number, number, number, number]

const FALLBACK = { duration: 0.15, ease: [0.4, 0, 0.2, 1] as Ease }

/**
 * The theme's motion — "--motion-duration" and "--motion-ease", which the brand's motion axis (calm / snappy)
 * sets — so animated components move at the brand's pace. Reads the live CSS variables on <html>.
 */
export function themeMotion(): { duration: number; ease: Ease } {
  if (typeof window === "undefined") return FALLBACK
  const css = getComputedStyle(document.documentElement)
  const raw = css.getPropertyValue("--motion-duration").trim()
  const ms = raw.endsWith("ms") ? Number.parseFloat(raw) : raw.endsWith("s") ? Number.parseFloat(raw) * 1000 : Number.NaN
  const ease = /cubic-bezier\(([^)]+)\)/.exec(css.getPropertyValue("--motion-ease"))?.[1]?.split(",").map((n) => Number.parseFloat(n))
  return {
    duration: Number.isFinite(ms) ? ms / 1000 : FALLBACK.duration,
    ease: ease && ease.length === 4 && ease.every(Number.isFinite) ? (ease as Ease) : FALLBACK.ease,
  }
}

/**
 * Motion a host asks for on behalf of the experience it renders (a layout plan's `motion`). "reduced" makes every
 * component below it move as if the system asked for reduced motion. "full" never overrides the system's own request.
 */
export const MotionPreference = React.createContext<"full" | "reduced" | undefined>(undefined)

/** The theme's motion, or none at all when the system or the surrounding `MotionPreference` asks for reduced motion. */
export function useThemeMotion(): { duration: number; ease: Ease; reduced: boolean } {
  const system = useReducedMotion() ?? false
  const asked = React.useContext(MotionPreference)
  const reduced = system || asked === "reduced"
  const m = themeMotion()
  return reduced ? { duration: 0, ease: m.ease, reduced } : { ...m, reduced }
}
