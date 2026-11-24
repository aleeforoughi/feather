// Shared test helpers: a fake frame source and a controllable matchMedia.
import { vi } from "vitest"

export function fakeFrames() {
  let next = 1
  const pending = new Map<number, (t: number) => void>()
  return {
    request: (cb: (t: number) => void) => {
      const id = next++
      pending.set(id, cb)
      return id
    },
    cancel: (id: number) => void pending.delete(id),
    /** Runs the pending frame callbacks at time `t`. */
    flush(t: number) {
      const cbs = [...pending.values()]
      pending.clear()
      for (const cb of cbs) cb(t)
    },
    get pending() {
      return pending.size
    },
  }
}

/** Makes matchMedia answer true for the given queries (substring match), false for the rest. */
export function mockMedia(matching: string[] = []) {
  const impl = (query: string) => ({
    matches: matching.some((m) => query.includes(m)),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
  Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: vi.fn(impl) })
}
export const REDUCED = "prefers-reduced-motion"
