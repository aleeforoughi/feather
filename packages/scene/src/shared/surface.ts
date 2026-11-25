// The canvas side of a scene: which canvas it draws on, its context, the backing-store size, and context loss. The
// World may hand a renderer a new canvas (a remount, React's strict mode, a route back), so a surface re-attaches to
// whatever canvas the frame names. On `webglcontextlost` it stops and reports, so the page can fall back to its still;
// on `webglcontextrestored` it reports again and the renderer rebuilds everything it had.

import { getContext, SCENE_CONTEXT, type GL } from "./gl"

export interface SurfaceOptions {
  attributes?: WebGLContextAttributes
  /** The context was lost: every GL object is gone, so draw nothing until restored. */
  onLost?(): void
  /** The context is back: rebuild programs, buffers and textures. */
  onRestored?(): void
}

export interface Surface {
  readonly canvas: HTMLCanvasElement | null
  readonly gl: GL | null
  readonly webgl2: boolean
  /** The context is lost (until restored). */
  readonly lost: boolean
  /** Binds to `canvas` (a different canvas detaches the old one first); the context, or null without WebGL. */
  attach(canvas: HTMLCanvasElement): GL | null
  /** Sets the backing store; true when it changed (and so was cleared). */
  fit(width: number, height: number): boolean
  /** Stops listening and forgets the canvas. Free the GL objects first. */
  detach(): void
}

/** Handles context loss on a canvas: the browser restores a lost context only when `webglcontextlost` is cancelled.
 * Returns the unsubscribe. */
export function watchContextLoss(canvas: HTMLCanvasElement, on: { lost?(): void; restored?(): void }): () => void {
  const lost = (event: Event) => {
    event.preventDefault()
    on.lost?.()
  }
  const restored = () => on.restored?.()
  canvas.addEventListener("webglcontextlost", lost, false)
  canvas.addEventListener("webglcontextrestored", restored, false)
  return () => {
    canvas.removeEventListener("webglcontextlost", lost, false)
    canvas.removeEventListener("webglcontextrestored", restored, false)
  }
}

export function createSurface(options: SurfaceOptions = {}): Surface {
  let canvas: HTMLCanvasElement | null = null
  let gl: GL | null = null
  let webgl2 = false
  let lost = false
  let unwatch: (() => void) | null = null

  const detach = () => {
    unwatch?.()
    unwatch = null
    canvas = null
    gl = null
    lost = false
  }
  return {
    get canvas() {
      return canvas
    },
    get gl() {
      return gl
    },
    get webgl2() {
      return webgl2
    },
    get lost() {
      return lost
    },
    attach(next) {
      if (next === canvas) return lost ? null : gl
      detach()
      canvas = next
      const context = getContext(next, options.attributes ?? SCENE_CONTEXT)
      gl = context?.gl ?? null
      webgl2 = context?.webgl2 ?? false
      lost = gl?.isContextLost() ?? false
      unwatch = watchContextLoss(next, {
        lost() {
          lost = true
          options.onLost?.()
        },
        restored() {
          lost = false
          options.onRestored?.()
        },
      })
      return lost ? null : gl
    },
    fit(width, height) {
      if (!canvas) return false
      const w = Math.max(1, Math.round(width))
      const h = Math.max(1, Math.round(height))
      if (canvas.width === w && canvas.height === h) return false
      canvas.width = w
      canvas.height = h
      return true
    },
    detach,
  }
}
