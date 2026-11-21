// The React side of the core: thin hooks, each a subscription that cleans up after itself.
import * as React from "react"
import { onReducedMotionChange, prefersReducedMotion } from "./core/motion"
import { reveal, type RevealOptions } from "./core/reveal"

/** Whether motion is reduced right now (system preference or a data-motion="reduced" ancestor). Server renders and
 * the first client render assume reduced, so nothing starts hidden before the script decides. */
export function useReducedMotion(ref?: React.RefObject<Element | null>): boolean {
  const [reduced, setReduced] = React.useState(true)
  React.useEffect(() => {
    setReduced(prefersReducedMotion(ref?.current))
    return onReducedMotionChange(() => setReduced(prefersReducedMotion(ref?.current)))
  }, [ref])
  return reduced
}

/** Reveals the element as it enters the viewport (the reveal role). `enabled: false` shows it at once. */
export function useReveal<T extends HTMLElement>(ref: React.RefObject<T | null>, { enabled = true, ...options }: RevealOptions & { enabled?: boolean } = {}): void {
  const { role, from, delay, once, threshold } = options
  React.useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    return reveal(el, { role, from, delay, once, threshold })
  }, [ref, enabled, role, from, delay, once, threshold])
}

/** Sets every ref to the value (a plain function: a forwarded ref is the caller's to set). */
function assignRefs<T>(refs: Array<React.Ref<T> | undefined>, value: T | null) {
  for (const ref of refs) {
    if (typeof ref === "function") ref(value)
    else if (ref) (ref as { current: T | null }).current = value
  }
}

/** Merges refs (a forwarded ref and an internal one). */
export function useMergedRef<T>(a: React.Ref<T> | undefined, b?: React.Ref<T>): React.RefCallback<T> {
  return React.useCallback((value: T | null) => assignRefs([a, b], value), [a, b])
}
