// Small React hooks the Living Page shares: the reduced-motion preference, and a one-shot entrance for streamed parts.
import * as React from "react"
import { onReducedMotionChange, prefersReducedMotion, revealDistance } from "@aleeforoughi/feather-expression/core"

/** Whether motion is reduced right now. The first render assumes reduced, so nothing starts hidden before it is known. */
export function useReducedMotion(ref?: React.RefObject<Element | null>): boolean {
  const [reduced, setReduced] = React.useState(true)
  React.useEffect(() => {
    setReduced(prefersReducedMotion(ref?.current))
    return onReducedMotionChange(() => setReduced(prefersReducedMotion(ref?.current)))
  }, [ref])
  return reduced
}

/**
 * Fades a part in once, on the reveal role's transition (the element carries `motion-reveal`), as it arrives. Under
 * reduced motion, or when `enabled` is false, it is simply there. `rise` adds the short upward travel of a block.
 */
export function useEnter<T extends HTMLElement>(ref: React.RefObject<T | null>, { enabled, delay = 0, rise = false }: { enabled: boolean; delay?: number; rise?: boolean }): void {
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || !enabled || prefersReducedMotion(el)) return
    el.style.opacity = "0"
    if (rise) el.style.transform = `translateY(${Math.round(revealDistance(el) / 2)}px)`
    el.style.transitionDelay = `${delay}ms`
    void el.offsetWidth
    el.style.opacity = "1"
    if (rise) el.style.transform = "none"
    // Runs once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
