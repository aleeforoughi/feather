// Work spread over frames: one task per frame on the one clock, so heavy set-up (compiling shaders, building
// geometry, decoding images, the modules a new route mounts) never lands in one long task. A World's prewarm runs
// here behind the loader, so its first real frame does not hitch.
import { clock as sharedClock, type Clock } from "./clock"

export type FrameTask = () => unknown

export interface PerFrameOptions {
  clock?: Clock
  /** Called after each task with the share done, 0 to 1. */
  onProgress?(done: number): void
}

export interface PerFrameRun {
  /** Settles when every task has run (or the run was cancelled). */
  done: Promise<void>
  cancel(): void
}

/** Runs the tasks in order, one per frame. A task that returns a promise is awaited before the next frame's task. A
 * task that throws is skipped: one failure never strands the rest. */
export function perFrame(tasks: readonly FrameTask[], { clock = sharedClock, onProgress }: PerFrameOptions = {}): PerFrameRun {
  let cancelled = false
  let stop: (() => void) | null = null
  let finish = () => {}
  const done = new Promise<void>((resolve) => {
    finish = resolve
    let i = 0
    const next = () => {
      if (cancelled || i >= tasks.length) {
        if (!cancelled) onProgress?.(1)
        resolve()
        return
      }
      stop = clock.once(async () => {
        stop = null
        try {
          await tasks[i]()
        } catch {
          // Skipped; the remaining tasks still run.
        }
        i++
        onProgress?.(i / tasks.length)
        next()
      })
    }
    next()
  })
  return {
    done,
    cancel() {
      cancelled = true
      stop?.()
      finish()
    },
  }
}
