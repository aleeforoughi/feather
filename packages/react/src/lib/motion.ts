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

/** The theme's motion, or none at all when the user asked their system for reduced motion. */
export function useThemeMotion(): { duration: number; ease: Ease; reduced: boolean } {
  const reduced = useReducedMotion() ?? false
  const m = themeMotion()
  return reduced ? { duration: 0, ease: m.ease, reduced } : { ...m, reduced }
}
