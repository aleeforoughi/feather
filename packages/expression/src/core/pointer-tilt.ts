// Tilt: an element leans toward a fine pointer (6 to 12 degrees is the range winners use; 8 is the default) and
// springs back on leave. Keyboard focus gives a small lift instead. Per-frame work rides the one clock.
import { clock, type Clock } from "./clock"
import { clamp, pointerAllowedAt } from "./pointer"

export const TILT_MAX = 8
export const TILT_LIMIT = 12
const LERP = 0.16
const REST = 0.02
/** Perspective is a spacing token: 200 steps of the spacing unit (50rem). */
export const TILT_PERSPECTIVE = "calc(var(--spacing, 0.25rem) * 200)"

/** The rotation for a pointer at (x, y) over a rect: the edge nearest the pointer comes toward it. Degrees. */
export function tiltAngles(x: number, y: number, rect: { left: number; top: number; width: number; height: number }, max = TILT_MAX): { x: number; y: number } {
  const m = clamp(max, 0, TILT_LIMIT)
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  const nx = clamp(((x - rect.left) / rect.width) * 2 - 1, -1, 1)
  const ny = clamp(((y - rect.top) / rect.height) * 2 - 1, -1, 1)
  return { x: -ny * m, y: nx * m }
}

/** Tilts `el` toward the pointer while it is over it. Needs loudness 2. Returns the cleanup. */
export function pointerTilt(el: HTMLElement, { max = TILT_MAX, on = clock }: { max?: number; on?: Clock } = {}): () => void {
  if (!pointerAllowedAt(el, 2)) return () => {}
  let target = { x: 0, y: 0 }
  let current = { x: 0, y: 0 }
  let remove: (() => void) | null = null
  const apply = () => {
    if (current.x === 0 && current.y === 0) {
      el.style.removeProperty("--tilt-x")
      el.style.removeProperty("--tilt-y")
      el.style.transform = ""
      return
    }
    el.style.setProperty("--tilt-x", `${current.x.toFixed(2)}deg`)
    el.style.setProperty("--tilt-y", `${current.y.toFixed(2)}deg`)
    el.style.transform = `perspective(${TILT_PERSPECTIVE}) rotateX(var(--tilt-x)) rotateY(var(--tilt-y))`
  }
  const step = () => {
    current = { x: current.x + (target.x - current.x) * LERP, y: current.y + (target.y - current.y) * LERP }
    if (Math.abs(target.x - current.x) < REST && Math.abs(target.y - current.y) < REST) {
      current = { ...target }
      remove?.()
      remove = null
    }
    apply()
  }
  const wake = () => {
    if (!remove) remove = on.add(step)
  }
  const move = (e: PointerEvent) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return
    target = tiltAngles(e.clientX, e.clientY, el.getBoundingClientRect(), max)
    wake()
  }
  const leave = () => {
    target = { x: 0, y: 0 }
    wake()
  }
  const focusIn = (e: FocusEvent) => {
    let visible = true
    try {
      visible = (e.target as Element).matches(":focus-visible")
    } catch {
      /* older engines: any focus lifts */
    }
    if (visible) el.dataset.lift = "true"
  }
  const focusOut = () => {
    delete el.dataset.lift
  }
  el.addEventListener("pointermove", move)
  el.addEventListener("pointerleave", leave)
  el.addEventListener("focusin", focusIn)
  el.addEventListener("focusout", focusOut)
  return () => {
    el.removeEventListener("pointermove", move)
    el.removeEventListener("pointerleave", leave)
    el.removeEventListener("focusin", focusIn)
    el.removeEventListener("focusout", focusOut)
    remove?.()
    current = { x: 0, y: 0 }
    apply()
    delete el.dataset.lift
  }
}
