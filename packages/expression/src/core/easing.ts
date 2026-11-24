// A cubic-bezier as a function of progress, for the few things the clock tweens itself (counters, scrub). Everything
// else is a CSS transition or a WAAPI animation, which take the curve as a string.
import type { Bezier } from "./motion"

/** y(x) for a CSS cubic-bezier: Newton's method on x(t), then bisection where the slope is flat. */
export function bezierEasing([x1, y1, x2, y2]: Bezier): (x: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  const solve = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x
      if (Math.abs(err) < 1e-6) return t
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let [lo, hi] = [0, 1]
    t = x
    for (let i = 0; i < 30 && hi - lo > 1e-6; i++) {
      if (sx(t) < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return t
  }
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)))
}
