// The one clock (docs/visual-system.md section 14.4: one rAF loop). Every frame-driven thing in Feather's website
// layer (scroll smoothing, counters, the magnetic pull, the cursor follower, the World canvas) subscribes here. The
// loop runs only while something is subscribed, so a page at rest does no work. A site that uses GSAP hands the clock
// its ticker (`clock.drive(gsap.ticker)`) and then there is still exactly one loop: GSAP's.
//
// This is the only file in the expression packages allowed to call requestAnimationFrame (the hygiene gate checks).

/** A frame callback: the time in ms (the clock's own, monotonic) and the ms since the last frame. */
export type Tick = (time: number, delta: number) => void

/** An external ticker the clock can ride on instead of its own loop. GSAP's ticker has exactly this shape: it calls
 * back with the time in seconds. */
export interface Ticker {
  add(callback: (time: number, deltaTime: number, frame: number) => void): unknown
  remove(callback: (time: number, deltaTime: number, frame: number) => void): unknown
}

export interface Clock {
  /** Subscribes to every frame; returns the unsubscribe. The loop starts on the first subscriber. */
  add(tick: Tick): () => void
  /** Runs once on the next frame (render on demand). */
  once(tick: Tick): () => void
  /** Rides on an external ticker (GSAP's), stopping the clock's own loop. `null` goes back to the own loop. */
  drive(ticker: Ticker | null): void
  /** Subscribers right now (for tests and the performance trace). */
  readonly size: number
  /** Whether a frame loop is running (own or external). */
  readonly running: boolean
}

interface Frames {
  request(cb: (t: number) => void): number
  cancel(id: number): void
}

const browserFrames = (): Frames | null =>
  typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
    ? { request: (cb) => window.requestAnimationFrame(cb), cancel: (id) => window.cancelAnimationFrame(id) }
    : null

/** A new clock. Products use the shared `clock`; tests make their own with a fake frame source. */
export function createClock(frames: Frames | null = browserFrames()): Clock {
  const ticks = new Set<Tick>()
  let frameId: number | null = null
  let last: number | null = null
  let external: Ticker | null = null

  const run = (time: number) => {
    const delta = last === null ? 0 : Math.max(0, time - last)
    last = time
    for (const tick of [...ticks]) tick(time, delta)
  }
  const ownFrame = (time: number) => {
    frameId = null
    run(time)
    if (ticks.size > 0 && !external) frameId = frames?.request(ownFrame) ?? null
  }
  const externalFrame = (time: number) => run(time * 1000)

  const start = () => {
    if (external) return
    if (frameId === null && frames) frameId = frames.request(ownFrame)
  }
  const stop = () => {
    if (frameId !== null) frames?.cancel(frameId)
    frameId = null
    last = null
  }

  const clock: Clock = {
    add(tick) {
      ticks.add(tick)
      start()
      return () => {
        ticks.delete(tick)
        if (ticks.size === 0) stop()
      }
    },
    once(tick) {
      const wrapped: Tick = (t, d) => {
        remove()
        tick(t, d)
      }
      const remove = clock.add(wrapped)
      return remove
    },
    drive(ticker) {
      if (external) external.remove(externalFrame)
      stop()
      external = ticker
      if (external) external.add(externalFrame)
      else if (ticks.size > 0) start()
    },
    get size() {
      return ticks.size
    },
    get running() {
      return external !== null || frameId !== null
    },
  }
  return clock
}

/** The page's one clock. */
export const clock: Clock = createClock()
