import { clock } from "./clock"

// Whether the page can be seen. Everything that runs on its own (a render loop, a quality test, a sound bed, a
// loader's clock) stops while the tab is hidden and resumes when it returns.

/** True while the document is hidden (always false outside a browser). */
export function isHidden(): boolean {
  return typeof document !== "undefined" && document.hidden === true
}

/** Calls back with `hidden` whenever the page is hidden or shown; returns the unsubscribe. */
export function onVisibilityChange(callback: (hidden: boolean) => void): () => void {
  if (typeof document === "undefined") return () => {}
  const listener = () => callback(document.hidden)
  document.addEventListener("visibilitychange", listener)
  return () => document.removeEventListener("visibilitychange", listener)
}

/** How long an entrance waits for the page to draw a frame before it shows its end state (ms). */
export const ENTRANCE_STALL_MS = 1000

/**
 * Content never depends on a frame running. An entrance (a reveal, a title's rise) holds its content hidden only
 * while the page draws: `stall` is called at once when the document is hidden, or after ENTRANCE_STALL_MS when no
 * frame has been drawn since the guard began (a background tab, a throttled or headless capture, an embedded view
 * that renders no frames). `stall` must show the end state. Returns the disposer.
 */
export function guardEntrance(stall: () => void, ms: number = ENTRANCE_STALL_MS): () => void {
  if (typeof window === "undefined") return () => {}
  if (isHidden()) {
    stall()
    return () => {}
  }
  let framed = false
  // A frame drawn is the one clock ticking (the only caller of requestAnimationFrame).
  const unframe = clock.once(() => (framed = true))
  const timer = setTimeout(() => {
    unframe()
    if (!framed) stall()
  }, ms)
  return () => {
    unframe()
    clearTimeout(timer)
  }
}
