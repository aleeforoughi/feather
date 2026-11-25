// Magnetic and Cursor (both optional): only for a fine pointer, never under reduced motion, and the native cursor
// always stays visible. The magnetic pull is about 0.15 (Carter Ogunsola) and meant for one or two primary controls,
// never body links. Both lerp on the one clock and stop it at rest.
import { clock, type Clock } from "./clock"
import { loudnessOf, type Loudness } from "./loudness"
import { prefersReducedMotion } from "./motion"

export const MAGNETIC_STRENGTH = 0.15
const LERP = 0.18
const REST = 0.05

/** Whether pointer effects may run here: a fine pointer, with motion allowed. */
export function pointerEffectsAllowed(el?: Element | null): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(pointer: fine)").matches && !prefersReducedMotion(el)
}

/** Pulls an element toward the pointer while it is over it. Returns the cleanup. */
export function magnetic(el: HTMLElement, { strength = MAGNETIC_STRENGTH, on = clock }: { strength?: number; on?: Clock } = {}): () => void {
  if (!pointerEffectsAllowed(el)) return () => {}
  const k = Math.min(0.3, Math.max(0, strength))
  let target = { x: 0, y: 0 }
  let current = { x: 0, y: 0 }
  let remove: (() => void) | null = null
  const apply = () => {
    el.style.translate = current.x === 0 && current.y === 0 ? "" : `${current.x.toFixed(2)}px ${current.y.toFixed(2)}px`
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
    const r = el.getBoundingClientRect()
    target = { x: (e.clientX - (r.left + r.width / 2)) * k, y: (e.clientY - (r.top + r.height / 2)) * k }
    wake()
  }
  const leave = () => {
    target = { x: 0, y: 0 }
    wake()
  }
  el.addEventListener("pointermove", move)
  el.addEventListener("pointerleave", leave)
  return () => {
    el.removeEventListener("pointermove", move)
    el.removeEventListener("pointerleave", leave)
    remove?.()
    current = { x: 0, y: 0 }
    apply()
  }
}

/** A follower that trails the pointer (lerped). It is decoration: the native cursor stays. Returns the cleanup. */
export function follow(follower: HTMLElement, { on = clock }: { on?: Clock } = {}): () => void {
  if (!pointerEffectsAllowed(follower)) return () => {}
  let target: { x: number; y: number } | null = null
  let current: { x: number; y: number } | null = null
  let remove: (() => void) | null = null
  const step = () => {
    if (!target) return
    current = current ? { x: current.x + (target.x - current.x) * LERP, y: current.y + (target.y - current.y) * LERP } : { ...target }
    follower.style.translate = `${current.x.toFixed(1)}px ${current.y.toFixed(1)}px`
    if (Math.abs(target.x - current.x) < REST && Math.abs(target.y - current.y) < REST) {
      remove?.()
      remove = null
    }
  }
  const move = (e: PointerEvent) => {
    target = { x: e.clientX, y: e.clientY }
    follower.dataset.state = "active"
    if (!remove) remove = on.add(step)
  }
  const out = () => {
    follower.dataset.state = "idle"
  }
  window.addEventListener("pointermove", move, { passive: true })
  document.addEventListener("pointerleave", out)
  return () => {
    window.removeEventListener("pointermove", move)
    document.removeEventListener("pointerleave", out)
    remove?.()
  }
}

/** Whether the richer pointer patterns (cursor states, tilt, field, trail) may run at `el`: a hovering fine pointer,
 * motion allowed, and the loudness at least `min`. A touch screen, reduced motion or a quieter page leaves it all off. */
export function pointerAllowedAt(el: Element | null | undefined, min: Loudness): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return false
  return !prefersReducedMotion(el) && loudnessOf(el) >= min
}

/** Fields: the pointer never drives these. */
export const POINTER_FIELDS = "input, textarea, select, [contenteditable]"

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
