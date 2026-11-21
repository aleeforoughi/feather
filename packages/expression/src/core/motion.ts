// The expression roles (docs/visual-system.md section 14.2), read from the live theme: the brand's signature curve and
// the role durations feather-tokens/3 writes, with the house defaults when no theme is present. Product UI never uses
// these; it keeps --ease-standard.

export type ExpressionRole = "reveal" | "media" | "scene" | "hoverOut"
/** What a role becomes under reduced motion: a short cross-fade, or nothing. */
export type ReducedMapping = "fade" | "none"
export type Bezier = [number, number, number, number]

/** The house defaults (calm, expo-out), the same values foundation.css carries. */
export const HOUSE = {
  ease: [0.19, 1, 0.22, 1] as Bezier,
  duration: { reveal: 700, media: 800, scene: 900, hoverOut: 280 } as Record<ExpressionRole, number>,
  staggerWord: 40,
  staggerBlock: 100,
  revealDistance: 32,
  mediaScale: 1.03,
  springBounce: 0.1,
  sequenceCap: 1200,
  reducedFade: 150,
  reduced: { reveal: "fade", media: "fade", scene: "fade", hoverOut: "none", stagger: "none", spring: "none" } as Record<ExpressionRole | "stagger" | "spring", ReducedMapping>,
}

const VAR: Record<ExpressionRole, string> = { reveal: "--duration-reveal", media: "--duration-media", scene: "--duration-scene", hoverOut: "--duration-hover-out" }
const REDUCED_VAR: Record<ExpressionRole | "stagger" | "spring", string> = {
  reveal: "--reduced-reveal",
  media: "--reduced-media",
  scene: "--reduced-scene",
  hoverOut: "--reduced-hover-out",
  stagger: "--reduced-stagger",
  spring: "--reduced-spring",
}

/** A CSS time ("700ms", "0.7s") in ms, or null. */
export function ms(raw: string | null | undefined): number | null {
  if (!raw) return null
  const v = raw.trim()
  const n = Number.parseFloat(v)
  if (!Number.isFinite(n)) return null
  return v.endsWith("ms") ? n : v.endsWith("s") ? n * 1000 : null
}

/** `cubic-bezier(a, b, c, d)` as its four numbers, or null. */
export function parseBezier(raw: string | null | undefined): Bezier | null {
  const m = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(raw ?? "")
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] : null
}

const styleOf = (el?: Element | null) => (typeof window === "undefined" ? null : getComputedStyle(el ?? document.documentElement))
const read = (name: string, el?: Element | null) => styleOf(el)?.getPropertyValue(name).trim() || null

/** Whether motion should be reduced for this element: the system preference, or a `data-motion="reduced"` ancestor
 * (a Feather plan sets it). */
export function prefersReducedMotion(el?: Element | null): boolean {
  if (typeof window === "undefined") return true
  if (el?.closest?.('[data-motion="reduced"]')) return true
  if (document.documentElement.getAttribute("data-motion") === "reduced") return true
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export interface RoleMotion {
  /** ms; under reduced motion, the 150ms fade or 0. */
  duration: number
  /** The CSS easing string WAAPI takes. */
  easing: string
  /** What plays: the full motion, a cross-fade only, or nothing. */
  mode: "full" | "fade" | "none"
}

/** The motion of an expression role for an element, reduced motion applied. */
export function roleMotion(role: ExpressionRole, el?: Element | null): RoleMotion {
  const ease = parseBezier(read("--ease-signature", el)) ?? HOUSE.ease
  const easing = `cubic-bezier(${ease.join(", ")})`
  if (prefersReducedMotion(el)) {
    const mapping = (read(REDUCED_VAR[role], el) as ReducedMapping | null) ?? HOUSE.reduced[role]
    return mapping === "fade" ? { duration: ms(read("--duration-reduced", el)) ?? HOUSE.reducedFade, easing: "linear", mode: "fade" } : { duration: 0, easing: "linear", mode: "none" }
  }
  return { duration: ms(read(VAR[role], el)) ?? HOUSE.duration[role], easing, mode: "full" }
}

/** The stagger steps of the theme, in ms (0 under reduced motion, where stagger maps to nothing by default). */
export function staggerStep(kind: "word" | "block", el?: Element | null): number {
  if (prefersReducedMotion(el) && ((read(REDUCED_VAR.stagger, el) as ReducedMapping | null) ?? HOUSE.reduced.stagger) === "none") return 0
  return ms(read(kind === "word" ? "--stagger-word" : "--stagger-block", el)) ?? (kind === "word" ? HOUSE.staggerWord : HOUSE.staggerBlock)
}

/** The sequence cap in ms: every sequence, stagger included, ends within it. */
export function sequenceCap(el?: Element | null): number {
  return ms(read("--sequence-cap", el)) ?? HOUSE.sequenceCap
}

/**
 * The delays of a staggered sequence of `count` items, each running `duration` ms, `step` ms apart, compressed so the
 * last one ends within `cap` (file 23: any sequence ends within 1.2s). The step never grows; it only shrinks.
 */
export function staggerDelays(count: number, step: number, duration: number, cap = HOUSE.sequenceCap): number[] {
  if (count <= 0) return []
  const room = Math.max(0, cap - duration)
  const fitted = count > 1 ? Math.min(step, room / (count - 1)) : 0
  return Array.from({ length: count }, (_, i) => Math.round(i * fitted))
}

/** The reveal distance (px) and the media hover scale of the theme. */
export function revealDistance(el?: Element | null): number {
  return Number.parseFloat(read("--distance-reveal", el) ?? "") || HOUSE.revealDistance
}
export function mediaScale(el?: Element | null): number {
  return Number.parseFloat(read("--scale-media", el) ?? "") || HOUSE.mediaScale
}
/** The spring bounce, 0 to 0.25 (0 under reduced motion: no spring at all). */
export function springBounce(el?: Element | null): number {
  if (prefersReducedMotion(el)) return 0
  const v = Number.parseFloat(read("--spring-bounce", el) ?? "")
  return Number.isFinite(v) ? Math.min(0.25, Math.max(0, v)) : HOUSE.springBounce
}

/** Subscribes to changes of the reduced-motion preference; returns the unsubscribe. */
export function onReducedMotionChange(callback: (reduced: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  const listener = (e: MediaQueryListEvent) => callback(e.matches)
  query.addEventListener?.("change", listener)
  return () => query.removeEventListener?.("change", listener)
}
