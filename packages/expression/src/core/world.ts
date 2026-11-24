// The World: one GPU canvas slot for the whole visit, owned by the brand (three.js, OGL or plain WebGL), never one per
// scene. Feather owns its lifecycle so the brand's renderer cannot break the floor: the device pixel ratio is capped
// per quality tier, frames render on demand on the one clock, it pauses off screen and in a hidden tab, it is
// decorative to assistive technology, and under reduced motion (or without WebGL) it is a still.

import { clock, type Clock } from "./clock"
import { perFrame, type FrameTask } from "./frames"
import { createQualityLadder, type QualityLadder } from "./ladder"
import { prefersReducedMotion } from "./motion"

export type Quality = "high" | "medium" | "low" | "static"

/** The pixel ratio cap per tier (file 23: 2, or 1.5 for heavy scenes and phones; Messenger caps at 1.15). */
export const DPR_CAP: Record<Exclude<Quality, "static">, number> = { high: 2, medium: 1.5, low: 1 }

/** The most pixels a canvas draws, whatever the screen: a 5K display renders no more than QHD (Qooler file 27
 * section 7: the winners cap drawn pixels, not only the ratio). */
export const PIXEL_BUDGET = 2560 * 1440
/** The lowest pixel ratio the budget or the quality ladder may reach. */
export const MIN_PIXEL_RATIO = 0.5

/** The pixel ratio a canvas renders at: the device's, never above the tier's cap, and, given the canvas size in CSS
 * pixels, never drawing more than PIXEL_BUDGET pixels. */
export function cappedPixelRatio(quality: Exclude<Quality, "static">, devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio, width?: number, height?: number): number {
  const capped = Math.min(devicePixelRatio || 1, DPR_CAP[quality])
  const area = (width ?? 0) * (height ?? 0)
  const budget = area > 0 ? Math.sqrt(PIXEL_BUDGET / area) : Infinity
  return Math.max(MIN_PIXEL_RATIO, Math.min(capped, budget))
}

/** The pixel-ratio share each step of the World's own quality ladder keeps, when the renderer has no levels. */
export const LADDER_RATIO = [1, 0.75, 0.5] as const

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
  /** How many quality levels the renderer has (0 the richest). Without it, the World's ladder lowers the pixel ratio
   * in three steps instead. */
  levels?: number
  /** Called when the quality ladder moves: turn off the most expensive things first. */
  setLevel?(level: number): void
  /** Work to do before the first frame (compile each material, build geometry), one task per frame behind the
   * loader: pass `world.prewarm()` to the loader's tasks. */
  prewarm?(): FrameTask[]
}

export interface WorldController {
  quality: Quality
  /** The quality ladder's level right now (0 the richest). */
  readonly level: number
  /** Asks for one frame (render on demand). */
  invalidate(): void
  /** Runs the renderer's prewarm, one task per frame; settles when done (at once if it has none). */
  prewarm(): Promise<void>
  dispose(): void
}

export interface WorldOptions {
  /** Called when the ladder is at its last level and the scene still cannot hold its frame rate: retire the effect
   * (gate.ts) so this device starts on the light tier next time. */
  onStruggle?(): void
}

/**
 * Runs a brand renderer in a canvas. `quality` "static" never starts it: the slot shows its still instead.
 */
export function createWorld(canvas: HTMLCanvasElement, renderer: WorldRenderer, quality: Quality, on: Clock = clock, options: WorldOptions = {}): WorldController {
  if (quality === "static") return { quality, level: 0, invalidate: () => {}, prewarm: () => Promise.resolve(), dispose: () => renderer.dispose?.() }
  let visible = true
  let disposed = false
  let pending: (() => void) | null = null
  let size = { width: 0, height: 0, pixelRatio: cappedPixelRatio(quality) }
  const ownLevels = !renderer.setLevel
  const levels = ownLevels ? LADDER_RATIO.length : Math.max(1, renderer.levels ?? 1)
  let struggled = false
  const ladder: QualityLadder = createQualityLadder({
    levels,
    onChange(level) {
      if (ownLevels) measure()
      else renderer.setLevel?.(level)
    },
    onStruggle() {
      if (struggled) return
      struggled = true
      options.onStruggle?.()
    },
  })
  let continuous = false

  const measure = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const share = ownLevels ? LADDER_RATIO[Math.min(ladder.level, LADDER_RATIO.length - 1)] : 1
    const pixelRatio = Math.max(MIN_PIXEL_RATIO, cappedPixelRatio(quality, undefined, width, height) * share)
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
      // Only a running animation measures the device: an idle on-demand frame says nothing about it.
      if (more && continuous) ladder.frame(time, delta)
      continuous = more
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
    get level() {
      return ladder.level
    },
    invalidate: schedule,
    prewarm() {
      const tasks = renderer.prewarm?.() ?? []
      return perFrame(tasks, { clock: on }).done
    },
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
