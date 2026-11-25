// Field: the items in a container are pushed away from the pointer within a radius. The push falls off with
// 1 - (d / r)^2 and its longest travel is a spacing step count, so it scales with the theme's spacing.
import { clock, type Clock } from "./clock"
import { clamp, pointerAllowedAt } from "./pointer"
import { isHidden, onVisibilityChange } from "./visibility"

export const FIELD_RADIUS = 300
/** The longest travel, in spacing steps (8 steps is 32px at the default unit). */
export const FIELD_STEPS = 8
const LERP = 0.14
const REST = 0.01

/** How strongly an item at distance `d` is pushed: 1 at the pointer, 0 at the radius. */
export function fieldFalloff(d: number, radius = FIELD_RADIUS): number {
  if (radius <= 0 || d >= radius) return 0
  return 1 - (d / radius) ** 2
}

/** The push on an item centred at `center`, away from `pointer`, in spacing steps. */
export function fieldOffset(center: { x: number; y: number }, pointer: { x: number; y: number }, radius = FIELD_RADIUS, strength = 0.5): { x: number; y: number } {
  const dx = center.x - pointer.x
  const dy = center.y - pointer.y
  const d = Math.hypot(dx, dy)
  if (d === 0 || d >= radius) return { x: 0, y: 0 }
  const f = fieldFalloff(d, radius) * clamp(strength, 0, 1) * FIELD_STEPS
  return { x: (dx / d) * f, y: (dy / d) * f }
}

function spacingPx(el: Element): number {
  const raw = getComputedStyle(el).getPropertyValue("--spacing").trim()
  const n = parseFloat(raw)
  if (!Number.isFinite(n)) return 4
  return raw.endsWith("rem") ? n * 16 : n
}

interface Item {
  el: HTMLElement
  cur: { x: number; y: number }
  tgt: { x: number; y: number }
}

/** Pushes every `[data-pointer-item]` inside `root` away from the pointer. Needs loudness 2. Transform only (the
 * `translate` property). Pauses while off screen and while the tab is hidden. Returns the cleanup. */
export function pointerField(root: HTMLElement, { radius = FIELD_RADIUS, strength = 0.5, on = clock }: { radius?: number; strength?: number; on?: Clock } = {}): () => void {
  if (!pointerAllowedAt(root, 2)) return () => {}
  const items = new Map<HTMLElement, Item>()
  let remove: (() => void) | null = null
  let onScreen = true
  const paused = () => !onScreen || isHidden()
  const sync = () => {
    const found = new Set(root.querySelectorAll<HTMLElement>("[data-pointer-item]"))
    for (const el of found)
      if (!items.has(el)) {
        items.set(el, { el, cur: { x: 0, y: 0 }, tgt: { x: 0, y: 0 } })
        el.style.translate = "calc(var(--spacing, 0.25rem) * var(--field-x, 0)) calc(var(--spacing, 0.25rem) * var(--field-y, 0))"
      }
    for (const [el] of items)
      if (!found.has(el)) {
        el.style.translate = ""
        items.delete(el)
      }
  }
  const apply = (it: Item) => {
    it.el.style.setProperty("--field-x", it.cur.x.toFixed(3))
    it.el.style.setProperty("--field-y", it.cur.y.toFixed(3))
  }
  const step = () => {
    let moving = false
    for (const it of items.values()) {
      it.cur = { x: it.cur.x + (it.tgt.x - it.cur.x) * LERP, y: it.cur.y + (it.tgt.y - it.cur.y) * LERP }
      if (Math.abs(it.tgt.x - it.cur.x) < REST && Math.abs(it.tgt.y - it.cur.y) < REST) it.cur = { ...it.tgt }
      else moving = true
      apply(it)
    }
    if (!moving || paused()) {
      remove?.()
      remove = null
    }
  }
  const wake = () => {
    if (!remove && !paused()) remove = on.add(step)
  }
  const move = (e: PointerEvent) => {
    if (e.pointerType === "touch" || e.pointerType === "pen" || paused()) return
    sync()
    const unit = spacingPx(root)
    for (const it of items.values()) {
      const r = it.el.getBoundingClientRect()
      // The rest centre: where the item sits without its own push.
      const center = { x: r.left + r.width / 2 - it.cur.x * unit, y: r.top + r.height / 2 - it.cur.y * unit }
      it.tgt = fieldOffset(center, { x: e.clientX, y: e.clientY }, radius, strength)
    }
    wake()
  }
  const leave = () => {
    for (const it of items.values()) it.tgt = { x: 0, y: 0 }
    wake()
  }
  root.addEventListener("pointermove", move)
  root.addEventListener("pointerleave", leave)
  const stopVisibility = onVisibilityChange((hidden) => {
    if (hidden) {
      remove?.()
      remove = null
    }
  })
  let observer: IntersectionObserver | null = null
  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) onScreen = entry.isIntersecting
      if (!onScreen) {
        remove?.()
        remove = null
      }
    })
    observer.observe(root)
  }
  return () => {
    root.removeEventListener("pointermove", move)
    root.removeEventListener("pointerleave", leave)
    stopVisibility()
    observer?.disconnect()
    remove?.()
    for (const it of items.values()) {
      it.el.style.translate = ""
      it.el.style.removeProperty("--field-x")
      it.el.style.removeProperty("--field-y")
    }
    items.clear()
  }
}
