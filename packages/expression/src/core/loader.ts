// Honest loading progress. What a loader shows is the lesser of how much is really ready and how much of a minimum
// time has passed, so it never races to 100 and then waits, and never lingers once everything is in. A first visit
// has a longer minimum than a return in the same session, and a cap ends the wait whatever happens (the page is
// there underneath; the loader only ever hides it). Time is the clock's, so it stops in a hidden tab. Values from the
// 2026 winners' code (Qooler file 27 section 7): 2.4s first, 1.4s on return, 8s cap.
import { clock as sharedClock, type Clock } from "./clock"

export const LOADER_MS = { first: 2400, returning: 1400, cap: 8000 } as const

export interface HonestProgressOptions {
  /** What must be ready: fonts, the first images' decode(), a World's prewarm. Each settled one counts, failed or not. */
  tasks?: ReadonlyArray<PromiseLike<unknown>>
  /** Minimum ms on a first visit and on a return in this session. */
  minimum?: { first: number; returning: number }
  /** The most ms it may take. */
  cap?: number
  /** Called every frame with the progress to show, 0 to 1. */
  onProgress(progress: number): void
  /** Called once, when it reaches 1 or the cap. */
  onDone(): void
  clock?: Clock
  /** Session storage for the return flag (default sessionStorage when it is there). */
  storage?: Pick<Storage, "getItem" | "setItem"> | null
  /** The session flag's key (default "feather-visited"). */
  key?: string
}

export interface HonestProgress {
  readonly progress: number
  /** Whether this is a return visit in this session (the shorter minimum). */
  readonly returning: boolean
  cancel(): void
}

export function honestProgress(opts: HonestProgressOptions): HonestProgress {
  const { tasks = [], minimum = LOADER_MS, cap = LOADER_MS.cap, onProgress, onDone, clock = sharedClock, key = "feather-visited" } = opts
  let store: Pick<Storage, "getItem" | "setItem"> | null = null
  try {
    store = opts.storage !== undefined ? opts.storage : typeof sessionStorage === "undefined" ? null : sessionStorage
  } catch {
    store = null
  }
  const returning = (() => {
    try {
      return store?.getItem(key) === "1"
    } catch {
      return false
    }
  })()
  const min = Math.max(1, returning ? minimum.returning : minimum.first)
  let settled = 0
  for (const t of tasks)
    Promise.resolve(t).then(
      () => settled++,
      () => settled++
    )
  let elapsed = 0
  let progress = 0
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    stop()
    try {
      store?.setItem(key, "1")
    } catch {
      // The next visit counts as a first one.
    }
    onDone()
  }
  const stop = clock.add((_time, delta) => {
    elapsed += delta
    const ready = tasks.length === 0 ? 1 : settled / tasks.length
    progress = Math.min(ready, elapsed / min, 1)
    if (elapsed >= cap) progress = 1
    onProgress(progress)
    if (progress >= 1) finish()
  })
  return {
    get progress() {
      return progress
    },
    returning,
    cancel() {
      finished = true
      stop()
    },
  }
}
