// The pure parts every Three.js scene shares: quality tiers, damping, fitting a camera to an object, a seeded random.
import type { Quality } from "@aleeforoughi/feather-expression/core"

/** The scene tiers (Qooler file 27 §4): high (DPR 2, post on), mid (DPR 1.5, half-resolution bloom), low (DPR 1, no
 * post). "off" is the World's still, so a renderer never sees it. */
export type Tier = "high" | "mid" | "low"
export const TIERS: readonly Tier[] = ["high", "mid", "low"]

/** The tier a renderer draws at: the World's quality, lowered one step per quality-ladder level. */
export function tierOf(quality: Exclude<Quality, "static">, level = 0): Tier {
  const start = quality === "high" ? 0 : quality === "medium" ? 1 : 2
  return TIERS[Math.min(TIERS.length - 1, start + Math.max(0, Math.floor(level)))]
}

/** Below this a damped value counts as settled, and the scene rests. */
export const REST = 1e-4

export interface Spring {
  value: number
  velocity: number
}

/**
 * Moves a value toward its target as a critically damped spring: no overshoot, eased out of rest, settled in about
 * `smoothTime` seconds (0.2 is the camera rail's damping, as drei's ScrollControls use). It is the exact solution of the
 * spring, so two half steps land where one whole step does: frame-rate independent.
 */
export function smoothDamp(spring: Spring, target: number, smoothTime: number, delta: number): Spring {
  if (delta <= 0) return spring
  if (smoothTime <= 0) return { value: target, velocity: 0 }
  const omega = 2 / smoothTime
  const x0 = spring.value - target
  const k = spring.velocity + omega * x0
  const decay = Math.exp(-omega * delta)
  return { value: target + (x0 + k * delta) * decay, velocity: (spring.velocity - omega * k * delta) * decay }
}

/** Whether a spring has reached its target (both the gap and the speed below REST, scaled to the value's range). */
export function settled(spring: Spring, target: number, scale = 1): boolean {
  return Math.abs(spring.value - target) < REST * scale && Math.abs(spring.velocity) < REST * scale
}

/**
 * The camera distance that fits a bounding sphere of `radius` in a perspective view: the narrower of the vertical and
 * horizontal fields of view decides, and `margin` leaves air around it (1.15 is 15%).
 */
export function fitDistance(radius: number, fovDegrees: number, aspect: number, margin = 1.15): number {
  const half = (fovDegrees * Math.PI) / 360
  const horizontal = Math.atan(Math.tan(half) * Math.max(aspect, 1e-6))
  return (radius * margin) / Math.sin(Math.min(half, horizontal))
}

/** The pointer field's falloff (the same law as the DOM PointerField): 1 at the pointer, 0 at the radius. */
export function falloff(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) return 0
  return 1 - (distance / radius) ** 2
}

/** A small seeded random (mulberry32): scenes sample the same points on every visit, and tests are deterministic. */
export function seeded(seed = 1): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const toRadians = (degrees: number) => (degrees * Math.PI) / 180
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
