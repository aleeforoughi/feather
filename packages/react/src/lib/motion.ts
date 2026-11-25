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

/**
 * Whether the theme lets a toggle overshoot, and how much: a brand with `overshoot: true` (the playful personality) writes
 * an --ease-overshoot whose y leaves [0, 1], and its --spring-bounce (0 to 0.25). Product UI reads this for one thing only,
 * the switch thumb (docs/visual-system.md section 10, "Micro-motion"); every other role keeps --ease-standard.
 */
export function themeSpring(): { overshoot: boolean; bounce: number } {
  if (typeof window === "undefined") return { overshoot: false, bounce: 0 }
  const css = getComputedStyle(document.documentElement)
  const points = /cubic-bezier\(([^)]+)\)/.exec(css.getPropertyValue("--ease-overshoot"))?.[1]?.split(",").map((n) => Number.parseFloat(n))
  return springFrom(points, Number.parseFloat(css.getPropertyValue("--spring-bounce")))
}

/** The overshoot and bounce a curve's control points and a bounce value allow (pure, so it can be tested). */
export function springFrom(points: number[] | undefined, bounce: number): { overshoot: boolean; bounce: number } {
  const overshoot = !!points && points.length === 4 && points.every(Number.isFinite) && [points[1], points[3]].some((y) => y < 0 || y > 1)
  return { overshoot, bounce: overshoot && Number.isFinite(bounce) ? Math.min(Math.max(bounce, 0), 0.25) : 0 }
}

/** A toggle's travel: a spring with the brand's bounce where it overshoots, else the role's duration on the one curve. */
export type ToggleTransition = { duration: number; ease?: Ease } | { type: "spring"; visualDuration: number; bounce: number }

export function toggleTransition(m: { duration: number; ease: Ease; reduced: boolean }, spring: { overshoot: boolean; bounce: number }): ToggleTransition {
  if (m.reduced) return { duration: 0 }
  if (spring.overshoot && spring.bounce > 0) return { type: "spring", visualDuration: m.duration, bounce: spring.bounce }
  return { duration: m.duration, ease: m.ease }
}

