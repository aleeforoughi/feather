import * as React from "react"
import { allows, loudnessOf, type Loudness } from "../core/loudness"

// How the components read loudness (docs/proposals/2026-11-24-range.md section 3.3). Loudness is a ceiling the page,
// a block or the brand declares: the nearest data-loudness, else the theme's --loudness. Where nothing declares one,
// a component does what its props ask (its caller chose the effect). Reduced motion is checked separately and is
// always stronger: no loudness turns motion back on.

type Capability = Parameters<typeof allows>[1]

/** The declared loudness at an element, or null when neither the page, a block nor the brand declares one. */
export function declaredLoudness(el: Element | null | undefined): Loudness | null {
  if (!el || typeof document === "undefined") return null
  const marked = el.closest?.("[data-loudness]")
  const themed = getComputedStyle(document.documentElement).getPropertyValue("--loudness").trim()
  return marked || themed ? loudnessOf(el) : null
}

/** Whether the loudness at an element allows a capability: true where none is declared. */
export function loudnessAllows(el: Element | null | undefined, what: Capability): boolean {
  const level = declaredLoudness(el)
  return level === null || allows(level, what)
}

/** The declared loudness at `ref`, read after mount (null on the server, on the first render and where none is
 * declared). The server and the first client render already show every component's still form, so reading it in an
 * effect never flashes motion that loudness forbids. */
export function useDeclaredLoudness(ref: React.RefObject<Element | null>): Loudness | null {
  const [level, setLevel] = React.useState<Loudness | null>(null)
  React.useEffect(() => setLevel(declaredLoudness(ref.current)), [ref])
  return level
}

/** Whether `what` is allowed at `ref` (true until read, and where none is declared). */
export function useLoudnessAllows(ref: React.RefObject<Element | null>, what: Capability): boolean {
  const level = useDeclaredLoudness(ref)
  return level === null || allows(level, what)
}
