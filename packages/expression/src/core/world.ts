// The World: one GPU canvas slot for the whole visit, owned by the brand (three.js, OGL or plain WebGL), never one per
// scene. Feather owns its lifecycle so the brand's renderer cannot break the floor: the device pixel ratio is capped
// per quality tier, frames render on demand on the one clock, it pauses off screen and in a hidden tab, it is
// decorative to assistive technology, and under reduced motion (or without WebGL) it is a still.

import { clock, type Clock } from "./clock"
import { prefersReducedMotion } from "./motion"

export type Quality = "high" | "medium" | "low" | "static"

/** The pixel ratio cap per tier (file 23: 2, or 1.5 for heavy scenes and phones; Messenger caps at 1.15). */
export const DPR_CAP: Record<Exclude<Quality, "static">, number> = { high: 2, medium: 1.5, low: 1 }

/** The pixel ratio a canvas renders at: the device's, never above the tier's cap. */
export function cappedPixelRatio(quality: Exclude<Quality, "static">, devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio): number {
  return Math.min(devicePixelRatio || 1, DPR_CAP[quality])
}

export interface DeviceHints {
  reducedMotion?: boolean
  saveData?: boolean
  webgl?: boolean
  cores?: number
  memory?: number
  coarsePointer?: boolean
}

/** The quality tier for a device: static under reduced motion, data saving or no WebGL; low on small devices; medium
 * on phones; high otherwise. Deterministic from its hints. */
export function pickQuality(h: DeviceHints): Quality {
  if (h.reducedMotion || h.saveData || h.webgl === false) return "static"
  if ((h.cores ?? 8) <= 2 || (h.memory ?? 8) <= 2) return "low"
  if (h.coarsePointer || (h.cores ?? 8) <= 4 || (h.memory ?? 8) <= 4) return "medium"
  return "high"
}

/** The hints of this browser. */
export function deviceHints(): DeviceHints {
  if (typeof window === "undefined") return { reducedMotion: true }
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
  let webgl: boolean
  try {
    const probe = document.createElement("canvas")
    webgl = !!(probe.getContext("webgl2") ?? probe.getContext("webgl"))
  } catch {
    webgl = false
  }
  return {
    reducedMotion: prefersReducedMotion(),
    saveData: nav.connection?.saveData === true,
    webgl,
    cores: nav.hardwareConcurrency,
    memory: nav.deviceMemory,
    coarsePointer: typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
  }
}

export interface WorldFrame {
  canvas: HTMLCanvasElement
  /** CSS pixels. */
  width: number
  height: number
  /** The capped pixel ratio the backing store uses. */
  pixelRatio: number
  quality: Exclude<Quality, "static">
  time: number
  delta: number
}

export interface WorldRenderer {
  /** Draws one frame. Return true to ask for another (an animation), false to rest until invalidated. */
  frame(frame: WorldFrame): boolean
  resize?(frame: Omit<WorldFrame, "time" | "delta">): void
  /** Frees every GPU resource. Called on unmount and on every route change. */
  dispose?(): void
}

export interface WorldController {
  quality: Quality
  /** Asks for one frame (render on demand). */
  invalidate(): void
  dispose(): void
}

/**
 * Runs a brand renderer in a canvas. `quality` "static" never starts it: the slot shows its still instead.
 */
export function createWorld(canvas: HTMLCanvasElement, renderer: WorldRenderer, quality: Quality, on: Clock = clock): WorldController {
  if (quality === "static") return { quality, invalidate: () => {}, dispose: () => renderer.dispose?.() }
  let visible = true
  let disposed = false
  let pending: (() => void) | null = null
  let size = { width: 0, height: 0, pixelRatio: cappedPixelRatio(quality) }

  const measure = () => {
    const pixelRatio = cappedPixelRatio(quality)
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    size = { width, height, pixelRatio }
    canvas.width = Math.max(1, Math.round(width * pixelRatio))
    canvas.height = Math.max(1, Math.round(height * pixelRatio))
    renderer.resize?.({ canvas, quality, ...size })
  }
  const schedule = () => {
    if (disposed || pending || !visible || (typeof document !== "undefined" && document.hidden)) return
    pending = on.once((time, delta) => {
      pending = null
      const more = renderer.frame({ canvas, quality, time, delta, ...size })
      if (more) schedule()
    })
  }
  measure()
  const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => (measure(), schedule())) : null
  resizeObserver?.observe(canvas)
  const io =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
          visible = entries.some((e) => e.isIntersecting)
          if (visible) schedule()
          else {
            pending?.()
            pending = null
          }
        })
      : null
  io?.observe(canvas)
  const onVisibility = () => (document.hidden ? (pending?.(), (pending = null)) : schedule())
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility)
  schedule()
  return {
    quality,
    invalidate: schedule,
    dispose() {
      disposed = true
      pending?.()
      resizeObserver?.disconnect()
      io?.disconnect()
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility)
      renderer.dispose?.()
    },
  }
}
