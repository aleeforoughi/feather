// Loudness: one quality at every volume (docs/proposals/2026-11-24-range.md section 3.3). A brand sets its default
// (feather-tokens/4 `loudness`, written as --loudness on the theme) and a page or a block overrides it with
// data-loudness="0..3" on any ancestor. Expression components ask `loudnessOf(el)` what they may do:
//   0 quiet       micro-motion only: no reveals, no kinetic type, no scroll choreography, no scenes
//   1 composed    reveals
//   2 expressive  kinetic type, parallax, pinned scenes
//   3 spectacle   full choreography and scenes
// The finish is the same at every level; only how much moves changes. Reduced motion is stronger than any loudness.

export type Loudness = 0 | 1 | 2 | 3

/** The house default when neither the page nor the brand says. */
export const DEFAULT_LOUDNESS: Loudness = 1

const clamp = (n: number): Loudness => (Math.max(0, Math.min(3, Math.round(n))) as Loudness)

/** The loudness at an element: the nearest data-loudness, else the theme's --loudness, else the house default. */
export function loudnessOf(el?: Element | null): Loudness {
  if (typeof document === "undefined") return DEFAULT_LOUDNESS
  const marked = el?.closest?.("[data-loudness]")?.getAttribute("data-loudness")
  if (marked !== null && marked !== undefined && marked !== "" && Number.isFinite(Number(marked))) return clamp(Number(marked))
  // The brand default is a theme variable on the root.
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--loudness").trim()
  return raw && Number.isFinite(Number(raw)) ? clamp(Number(raw)) : DEFAULT_LOUDNESS
}

/** What a loudness allows. A component asks for the capability it needs, never compares numbers itself. */
export function allows(level: Loudness, what: "reveal" | "kinetic" | "scroll" | "scene"): boolean {
  return level >= { reveal: 1, kinetic: 2, scroll: 2, scene: 3 }[what]
}
