import * as React from "react"
import { useReducedMotion } from "motion/react"

/** Cubic-bezier control points, as motion takes them. */
export type Ease = [number, number, number, number]

/** The six duration primitives (docs/visual-system.md section 10). */
export type Duration = "micro" | "fast" | "base" | "medium" | "slow" | "large"

/** The motion roles, each rounded onto one primitive. A component chooses a role, never milliseconds. */
export type MotionRole = "press" | "focus" | "hover" | "state" | "switch" | "tooltip" | "popover" | "panel" | "dialog" | "toast" | "page"

export const ROLE_DURATION: Record<MotionRole, Duration> = {
  press: "micro",
  focus: "fast",
  hover: "base",
  state: "base",
  switch: "medium",
  tooltip: "base",
  popover: "medium",
  panel: "medium",
  dialog: "slow",
  toast: "medium",
  page: "large",
}

/** The calm axis, the fallback when no theme is present (server render, a test without the foundation CSS). */
const FALLBACK_MS: Record<Duration, number> = { micro: 100, fast: 140, base: 180, medium: 240, slow: 320, large: 420 }
const FALLBACK_EASE: Ease = [0.4, 0, 0.2, 1]

function seconds(raw: string): number {
  const ms = raw.endsWith("ms") ? Number.parseFloat(raw) : raw.endsWith("s") ? Number.parseFloat(raw) * 1000 : Number.NaN
  return ms / 1000
}

/**
 * The theme's motion: the duration of a role (or of "base", the default) and the one curve. It reads the live variables
 * --duration-<name> and --ease-standard on <html>, which the brand's motion axis (calm / snappy) sets.
 */
export function themeMotion(role?: MotionRole): { duration: number; ease: Ease } {
  const primitive = role ? ROLE_DURATION[role] : "base"
  const fallback = FALLBACK_MS[primitive] / 1000
  if (typeof window === "undefined") return { duration: fallback, ease: FALLBACK_EASE }
  const css = getComputedStyle(document.documentElement)
  const duration = seconds(css.getPropertyValue(`--duration-${primitive}`).trim())
  const ease = /cubic-bezier\(([^)]+)\)/.exec(css.getPropertyValue("--ease-standard"))?.[1]?.split(",").map((n) => Number.parseFloat(n))
  return {
    duration: Number.isFinite(duration) ? duration : fallback,
    ease: ease && ease.length === 4 && ease.every(Number.isFinite) ? (ease as Ease) : FALLBACK_EASE,
  }
}

/**
 * Motion a host asks for on behalf of the experience it renders (a layout plan's `motion`). "reduced" makes every
 * component below it move as if the system asked for reduced motion. "full" never overrides the system's own request.
 */
export const MotionPreference = React.createContext<"full" | "reduced" | undefined>(undefined)

/**
 * The theme's motion for a role (base when none), or none at all when the system or the surrounding `MotionPreference`
 * asks for reduced motion.
 */
export function useThemeMotion(role?: MotionRole): { duration: number; ease: Ease; reduced: boolean } {
  const system = useReducedMotion() ?? false
  const asked = React.useContext(MotionPreference)
  const reduced = system || asked === "reduced"
  const m = themeMotion(role)
  return reduced ? { duration: 0, ease: m.ease, reduced } : { ...m, reduced }
}
