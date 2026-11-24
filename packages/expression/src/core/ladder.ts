// The quality ladder: a heavy scene measures how it is actually running and steps its own quality down when frames
// run long, then, after a quiet spell, tries one step back up. Level 0 is the richest; each level up is cheaper (the
// renderer decides what a level turns off: post effects, samples, the pixel ratio). It is fed the frames the scene
// really renders, so it adds no loop of its own, and it never measures while the tab is hidden.
// Values from the 2026 winners' code (Qooler file 27 section 7): test about once a second, step down below 50fps,
// re-test upward after 10s.
import { isHidden } from "./visibility"

export interface LadderOptions {
  /** How many levels the renderer has (at least 1). */
  levels: number
  /** The level to start at (default 0, the richest). */
  start?: number
  /** Frames per second the scene must hold; below it the ladder steps down (default 50). */
  floor?: number
  /** How long one measurement lasts, in ms of rendered time (default 1000). */
  window?: number
  /** How long the scene must hold comfortably before one step up is tried, in ms (default 10000). Doubles after a
   * step up fails, so a device that cannot hold a level stops being asked. */
  recheck?: number
  /** Called when the level changes. */
  onChange(level: number): void
  /** Called when a measurement fails at the last level: the device cannot run the scene well even at its cheapest. */
  onStruggle?(): void
}

export interface QualityLadder {
  readonly level: number
  /** Feeds one rendered frame: its time and the ms since the last one (the clock's, already clamped). */
  frame(time: number, delta: number): void
  /** Starts the measurement over (after a resize or a route change). */
  reset(): void
}

export function createQualityLadder({ levels, start = 0, floor = 50, window = 1000, recheck = 10000, onChange, onStruggle }: LadderOptions): QualityLadder {
  const top = Math.max(0, levels - 1)
  let level = Math.min(top, Math.max(0, start))
  let frames = 0
  let elapsed = 0
  let comfortable = 0
  let wait = recheck
  let probing = false

  const set = (next: number) => {
    if (next === level) return
    level = next
    onChange(level)
  }
  const reset = () => {
    frames = 0
    elapsed = 0
  }

  return {
    get level() {
      return level
    },
    reset() {
      reset()
      comfortable = 0
    },
    frame(_time, delta) {
      if (isHidden() || delta <= 0) return
      frames++
      elapsed += delta
      if (elapsed < window) return
      const fps = (frames * 1000) / elapsed
      reset()
      if (fps < floor) {
        // A step up that could not hold: go back, and wait twice as long before asking again.
        if (probing) wait *= 2
        probing = false
        comfortable = 0
        if (level === top) onStruggle?.()
        set(Math.min(top, level + 1))
        return
      }
      probing = false
      comfortable += window
      if (level > 0 && comfortable >= wait) {
        comfortable = 0
        probing = true
        set(level - 1)
      }
    },
  }
}
