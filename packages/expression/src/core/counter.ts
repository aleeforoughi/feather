// Counter: an animated number (file 23: tabular figures, 600 to 1200ms, ease-out). Tweens on the one clock and stops
// when it lands. Under reduced motion it shows the final value at once. The final value is always what assistive
// technology reads; the tween is presentation.
import { clock, type Clock } from "./clock"
import { bezierEasing } from "./easing"
import { HOUSE, parseBezier, prefersReducedMotion, type Bezier } from "./motion"

/** Counter durations stay in this range. */
export const COUNTER_MS = { min: 600, max: 1200 } as const

export interface CountOptions {
  from?: number
  to: number
  duration?: number
  ease?: Bezier
  /** Called every frame with the current value, and once with `to` at the end. */
  onUpdate(value: number): void
  onDone?(): void
  element?: Element | null
  clock?: Clock
}

export function countTo({ from = 0, to, duration = 900, ease, onUpdate, onDone, element, clock: on = clock }: CountOptions): () => void {
  const length = Math.min(COUNTER_MS.max, Math.max(COUNTER_MS.min, duration))
  if (prefersReducedMotion(element) || from === to) {
    onUpdate(to)
    onDone?.()
    return () => {}
  }
  const css = typeof window === "undefined" ? null : getComputedStyle(element ?? document.documentElement).getPropertyValue("--ease-signature")
  const curve = bezierEasing(ease ?? parseBezier(css) ?? HOUSE.ease)
  let start: number | null = null
  const remove = on.add((time) => {
    start ??= time
    const p = Math.min(1, (time - start) / length)
    onUpdate(p >= 1 ? to : from + (to - from) * curve(p))
    if (p >= 1) {
      remove()
      onDone?.()
    }
  })
  return remove
}

/** Formats a counter value with the target's decimals, so the width does not jump. */
export function formatCount(value: number, to: number, locale?: string): string {
  const decimals = (String(to).split(".")[1] ?? "").length
  return value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
