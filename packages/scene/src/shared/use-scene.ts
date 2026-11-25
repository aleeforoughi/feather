// The React side of a scene's floor: the props that wire a scene into a World so a lost GPU context or a shader that
// will not compile puts the still back (the World shows its still whenever its quality is static), and so pointer
// input can ask the World for a frame.

import * as React from "react"
import type { Quality, WorldController } from "@aleeforoughi/feather-expression/core"
import type { SceneRenderer } from "./scene"

export interface SceneProps<R extends SceneRenderer> {
  renderer: R
  /** The quality to pass on: the caller's (undefined lets the capability gate decide), or "static" once the scene has
   * stopped. */
  quality?: Quality
  onWorld(world: WorldController | null): void
}

/**
 * Spread the result on a World: `<World still={poster} {...useScene(scene)} />`. Create the scene once (useMemo):
 * a new renderer object restarts the World.
 */
export function useScene<R extends SceneRenderer>(renderer: R, quality?: Quality): SceneProps<R> {
  const state = React.useSyncExternalStore(renderer.subscribe, () => renderer.state, () => "idle" as const)
  const stopped = state === "lost" || state === "failed"
  const onWorld = React.useCallback((world: WorldController | null) => renderer.connect(world), [renderer])
  return { renderer, quality: stopped ? "static" : quality, onWorld }
}
