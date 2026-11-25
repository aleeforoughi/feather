// Trail: images spawn along the pointer path every `spacing` px from a small pooled set, then fade and lift away.
// The pool is fixed (8 to 12 nodes) so a fast pointer never makes more. Decorative: the nodes are alt="" images.
import { clock, type Clock } from "./clock"
import { clamp, pointerAllowedAt } from "./pointer"
import { isHidden } from "./visibility"

export const TRAIL_POOL_MIN = 8
export const TRAIL_POOL_MAX = 12
export const TRAIL_SPACING = 96
export const TRAIL_LIFETIME = 900
/** How far a spawned image lifts while it fades, in px. */
const LIFT = 56

/** How many pooled nodes a trail of `count` images uses: at least 8, never more than 12. */
export const trailPoolSize = (count: number): number => clamp(count, TRAIL_POOL_MIN, TRAIL_POOL_MAX)

interface Slot {
  el: HTMLImageElement
  age: number
  at: { x: number; y: number }
}

/** Spawns pooled images from `pool` as the pointer moves over `root`. Needs loudness 3 and a mouse: a tap does
 * nothing. Returns the cleanup. */
export function pointerTrail(
  root: HTMLElement,
  pool: HTMLImageElement[],
  { images, spacing = TRAIL_SPACING, lifetime = TRAIL_LIFETIME, on = clock }: { images: string[]; spacing?: number; lifetime?: number; on?: Clock },
): () => void {
  if (!pointerAllowedAt(root, 3) || images.length === 0 || pool.length === 0) return () => {}
  const slots: Slot[] = pool.slice(0, TRAIL_POOL_MAX).map((el) => ({ el, age: lifetime, at: { x: 0, y: 0 } }))
  let next = 0
  let shown = 0
  let last: { x: number; y: number } | null = null
  let remove: (() => void) | null = null
  const paint = (s: Slot) => {
    const t = clamp(s.age / lifetime, 0, 1)
    const fade = Math.min(1, t / 0.15) * (1 - t) ** 2
    s.el.style.opacity = t >= 1 ? "0" : fade.toFixed(3)
    s.el.style.translate = `${s.at.x.toFixed(1)}px ${(s.at.y - LIFT * t).toFixed(1)}px`
    s.el.style.scale = String((0.9 + 0.1 * (1 - t)).toFixed(3))
  }
  const step = (_time: number, delta: number) => {
    let live = false
    for (const s of slots) {
      if (s.age >= lifetime) continue
      s.age += delta
      paint(s)
      if (s.age < lifetime) live = true
    }
    if (!live) {
      remove?.()
      remove = null
    }
  }
  const spawn = (x: number, y: number) => {
    const s = slots[next % slots.length]
    next += 1
    s.age = 0
    s.at = { x, y }
    s.el.src = images[shown % images.length]
    shown += 1
    paint(s)
    if (!remove) remove = on.add(step)
  }
  const move = (e: PointerEvent) => {
    if ((e.pointerType && e.pointerType !== "mouse") || isHidden()) return
    const r = root.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    if (last && Math.hypot(x - last.x, y - last.y) < spacing) return
    last = { x, y }
    spawn(x, y)
  }
  const leave = () => {
    last = null
  }
  root.addEventListener("pointermove", move)
  root.addEventListener("pointerleave", leave)
  return () => {
    root.removeEventListener("pointermove", move)
    root.removeEventListener("pointerleave", leave)
    remove?.()
    for (const s of slots) {
      s.el.style.opacity = "0"
      s.el.style.translate = ""
      s.el.style.scale = ""
    }
  }
}
