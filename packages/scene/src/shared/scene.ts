// What every Feather scene adds to the World's renderer contract: a state the page can watch (so a lost context or a
// shader that will not compile puts the still back), and a way to reach the World so pointer input can ask for a frame
// while the scene otherwise rests (render on demand).

import type { FrameTask, WorldController, WorldRenderer } from "@aleeforoughi/feather-expression/core"

/** idle: not drawing yet (or disposed). ready: drawing. lost: the GPU context was lost. failed: no WebGL, a shader
 * that did not compile, or an image that did not load. failed is final; lost lasts until the context is restored on
 * the same canvas, and a disposed scene keeps either (so a page that put its still back does not try again). */
export type SceneState = "idle" | "ready" | "lost" | "failed"

/** Why a scene stopped: reported through `onStop` each time it stops. */
export interface SceneStop {
  reason: "context-lost" | "no-webgl" | "shader" | "asset"
  error?: Error
}

export interface SceneRenderer extends WorldRenderer {
  readonly levels: number
  setLevel(level: number): void
  prewarm(): FrameTask[]
  dispose(): void
  readonly state: SceneState
  /** Listens to state changes; returns the unsubscribe. */
  subscribe(listener: (state: SceneState) => void): () => void
  /** Pass as the World's `onWorld`: pointer input then asks the World for a frame instead of keeping a loop running. */
  connect(world: WorldController | null): void
}

export interface SceneHooks {
  /** Called when the scene stops drawing: the context was lost (it may come back), there is no WebGL, a shader did
   * not compile or an image did not load (for good). */
  onStop?(stop: SceneStop): void
}

/** The state and the World link a renderer keeps. failed is final; lost comes back to ready only when the context is
 * restored on the same canvas. */
export function sceneLink(hooks: SceneHooks = {}) {
  let state: SceneState = "idle"
  let world: WorldController | null = null
  const listeners = new Set<(state: SceneState) => void>()
  const set = (next: SceneState) => {
    if (next === state) return
    // Failed is final. Lost leaves only when a restored context rebuilds (idle, then ready).
    if (state === "failed") return
    state = next
    for (const l of [...listeners]) l(state)
  }
  return {
    get state() {
      return state
    },
    get world() {
      return world
    },
    set,
    stop(stop: SceneStop) {
      const before = state
      set(stop.reason === "context-lost" ? "lost" : "failed")
      if (state !== before) hooks.onStop?.(stop)
    },
    subscribe(listener: (state: SceneState) => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    connect(next: WorldController | null) {
      world = next
    },
    invalidate() {
      world?.invalidate()
    },
  }
}

export type SceneLink = ReturnType<typeof sceneLink>

/** The clamp every option goes through: a number in range, else the default. */
export function clampOption(value: number | undefined, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}
