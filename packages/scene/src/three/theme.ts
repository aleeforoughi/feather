// The brand's palette as Three.js colours, read once from the CSS variables in scope of the World's canvas. Parsing
// is the shared one (src/shared/palette.ts: hex and rgb() directly, anything else through a 1×1 canvas); a variable is
// first resolved by the browser through a hidden probe, so var() chains and color-mix() read the way the page sees them.
import { Color, LinearSRGBColorSpace } from "three"
import { parseColor as parseLinear } from "../shared/palette"

export interface Theme {
  /** `--background`: the ground, the fog and the theme background. */
  background: Color
  /** `--foreground`: ink, the contact shadow. */
  foreground: Color
  /** `--primary`: the key light's tint, the first stop of a colour ramp. */
  primary: Color
  /** `--accent`: the rim light's tint, the last stop of a ramp. */
  accent: Color
  /** `--block-1…4`: the colour-blocking surfaces, when the brand has them. */
  blocks: Color[]
}

const BLOCKS = 4

/** The theme's colours. Neutral stand-ins (a light ground, a near-black ink) for anything the page does not set. */
export function readTheme(el: Element | null): Theme {
  const background = variable(el, "--background") ?? parseColor("#f7f7f5", new Color())
  const foreground = variable(el, "--foreground") ?? parseColor("#18181b", new Color())
  const primary = variable(el, "--primary") ?? foreground.clone()
  const accent = variable(el, "--accent") ?? primary.clone().lerp(background, 0.5)
  const blocks: Color[] = []
  for (let i = 1; i <= BLOCKS; i++) {
    const block = variable(el, `--block-${i}`)
    if (block) blocks.push(block)
  }
  return { background, foreground, primary, accent, blocks }
}

/** A CSS colour as a Three.js colour (linear working space); `fallback` when it is not one. */
export function parseColor(value: string, fallback: Color): Color {
  const linear = parseLinear(value)
  return linear ? toColor(linear) : fallback
}

/** A colour reference in renderer options: a theme variable (`--accent` or `var(--accent)`) or any CSS colour. */
export function themeColor(theme: Theme, ref: string, scope: Element | null = null): Color {
  const trimmed = ref.trim()
  const name = /^var\((--[\w-]+)\)$/.exec(trimmed)?.[1] ?? (trimmed.startsWith("--") ? trimmed : null)
  if (!name) return parseColor(trimmed, theme.primary.clone())
  const block = /^--block-(\d)$/.exec(name)
  if (block) return (theme.blocks[Number(block[1]) - 1] ?? theme.accent).clone()
  const known: Record<string, Color | undefined> = { "--background": theme.background, "--foreground": theme.foreground, "--primary": theme.primary, "--accent": theme.accent }
  return (known[name] ?? variable(scope, name) ?? theme.primary).clone()
}

/** A light's tint from a brand colour: its hue, half its saturation, at a fixed lightness, so a near-black primary
 * still gives a bright key light. */
export function tint(color: Color, lightness: number): Color {
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  return new Color().setHSL(hsl.h, hsl.s * 0.5, lightness)
}

const toColor = ([r, g, b]: readonly [number, number, number]) => new Color().setRGB(r, g, b, LinearSRGBColorSpace)

function variable(el: Element | null, name: string): Color | null {
  if (!el || typeof getComputedStyle !== "function") return null
  const raw = getComputedStyle(el).getPropertyValue(name).trim()
  if (!raw) return null
  if (/^#|^rgba?\(/i.test(raw)) {
    const direct = parseLinear(raw)
    if (direct) return toColor(direct)
  }
  // A canvas has no rendered children: the probe goes in its parent, where the same variables are in scope.
  const host = typeof HTMLCanvasElement !== "undefined" && el instanceof HTMLCanvasElement ? el.parentElement : el
  let resolved = ""
  if (host) {
    const probe = document.createElement("span")
    probe.style.display = "none"
    probe.style.color = `var(${name})`
    host.appendChild(probe)
    resolved = getComputedStyle(probe).color
    probe.remove()
  }
  const linear = (resolved ? parseLinear(resolved) : null) ?? parseLinear(raw)
  return linear ? toColor(linear) : null
}
