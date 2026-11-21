// Page and section transitions (the scene role) with View Transitions, and Taxi-style cleanup: everything a route
// registered is disposed before the next one renders. A persistent slot (the World canvas) carries a fixed
// view-transition-name so it is never torn down. Without View Transitions, or under reduced motion, the update runs at
// once: the content always arrives, only the motion is optional.
import { prefersReducedMotion } from "./motion"

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void>; updateCallbackDone: Promise<void> } }

/** The view-transition-name the persistent World slot keeps across routes. */
export const PERSISTENT_SLOT = "feather-world"

export interface Transitions {
  /** Registers something to dispose on the next route change (a listener, a timeline, a GPU resource). */
  onLeave(dispose: () => void): () => void
  /** Disposes what the current route registered, then runs the update inside a view transition. */
  go(update: () => void | Promise<void>): Promise<void>
  /** How many disposers wait for the next route change. */
  readonly pending: number
}

export function createTransitions(doc: ViewTransitionDocument | undefined = typeof document === "undefined" ? undefined : (document as ViewTransitionDocument)): Transitions {
  const disposers = new Set<() => void>()
  const leave = () => {
    for (const d of [...disposers]) {
      disposers.delete(d)
      try {
        d()
      } catch {
        // A disposer that throws must not keep the next route from rendering.
      }
    }
  }
  return {
    onLeave(dispose) {
      disposers.add(dispose)
      return () => disposers.delete(dispose)
    },
    async go(update) {
      leave()
      if (!doc?.startViewTransition || prefersReducedMotion()) {
        await update()
        return
      }
      const transition = doc.startViewTransition(update)
      await transition.updateCallbackDone
    },
    get pending() {
      return disposers.size
    },
  }
}
