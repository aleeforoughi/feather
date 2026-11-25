// The pointer a scene reads: one passive listener on the window, added when the scene attaches and removed when it is
// disposed. It never captures, never prevents anything and never runs layout on its own: the scene reads the canvas
// rectangle once per frame and asks where the pointer is relative to it.

export interface PointerTrack {
  /** A fine pointer (mouse, pen) moved since the track started. */
  readonly active: boolean
  /** The device has a fine pointer at all (a phone or tablet drifts instead). */
  readonly fine: boolean
  /** The pointer in the rectangle's uv: 0 to 1 across, 0 to 1 bottom to top (GL's way up); outside may exceed. */
  uv(rect: { left: number; top: number; width: number; height: number }): [number, number]
  dispose(): void
}

/** Tracks a fine pointer on the window; `onMove` runs on each move (the scene asks its World for a frame). */
export function trackPointer(onMove?: () => void): PointerTrack {
  let x = 0
  let y = 0
  let active = false
  const fine = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches
  const move = (event: PointerEvent) => {
    if (event.pointerType === "touch") return
    x = event.clientX
    y = event.clientY
    active = true
    onMove?.()
  }
  const leave = (event: PointerEvent) => {
    if (event.relatedTarget !== null) return
    active = false
    onMove?.()
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pointermove", move, { passive: true })
    window.addEventListener("pointerout", leave, { passive: true })
  }
  return {
    get active() {
      return active
    },
    fine,
    uv(rect) {
      return [(x - rect.left) / Math.max(1, rect.width), 1 - (y - rect.top) / Math.max(1, rect.height)]
    },
    dispose() {
      if (typeof window === "undefined") return
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerout", leave)
    },
  }
}

/** A frame-rate independent ease toward a target: `rate` is the share covered in one 60 Hz frame. */
export function damp(current: number, target: number, rate: number, deltaMs: number): number {
  return current + (target - current) * (1 - Math.pow(1 - rate, Math.max(0, deltaMs) / (1000 / 60)))
}
