// Palettes from CSS colours. A scene takes the brand's colours as the browser understands them (hex, rgb(), oklch(),
// color-mix(), a named colour, a var()), and works in linear light: a 1×1 canvas turns any colour the browser accepts
// into sRGB bytes, and the bytes become linear RGB. Hex and rgb() are parsed directly, so they need no canvas.

/** Linear RGB, each channel 0 to 1. */
export type LinearRGB = readonly [number, number, number]

/** An sRGB channel (0 to 1) in linear light. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** A linear channel back to sRGB (0 to 1). */
export function linearToSrgb(c: number): number {
  const x = Math.min(1, Math.max(0, c))
  return x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055
}

const fromBytes = (r: number, g: number, b: number): LinearRGB => [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)]

function parseHex(value: string): LinearRGB | null {
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value)?.[1]
  if (!hex) return null
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex
  return fromBytes(parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16))
}

function parseRgb(value: string): LinearRGB | null {
  const body = /^rgba?\(([^)]*)\)$/i.exec(value)?.[1]
  if (!body) return null
  const parts = body
    .split(/[\s,/]+/)
    .filter(Boolean)
    .slice(0, 3)
  if (parts.length < 3) return null
  const bytes = parts.map((p) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p)))
  if (bytes.some((b) => !Number.isFinite(b))) return null
  const [r, g, b] = bytes.map((b) => Math.min(255, Math.max(0, b)))
  return fromBytes(r, g, b)
}

let probe: CanvasRenderingContext2D | null | undefined

/** Any colour the browser accepts, through a 1×1 canvas: null when the browser rejects it or has no 2D canvas. */
function parseWithCanvas(value: string): LinearRGB | null {
  if (typeof document === "undefined") return null
  if (probe === undefined) {
    try {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      probe = canvas.getContext("2d", { willReadFrequently: true })
    } catch {
      probe = null
    }
  }
  const ctx = probe
  if (!ctx) return null
  // A rejected colour leaves fillStyle as it was: set two different sentinels, so a real black or white still parses.
  ctx.fillStyle = "#000"
  ctx.fillStyle = value
  if (ctx.fillStyle === "#000000") {
    ctx.fillStyle = "#fff"
    ctx.fillStyle = value
    if (ctx.fillStyle === "#ffffff") return null
  }
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return fromBytes(r, g, b)
}

/** A CSS colour in linear RGB, or null when it is not a colour. */
export function parseColor(value: string): LinearRGB | null {
  const v = value.trim()
  if (!v) return null
  return parseHex(v) ?? parseRgb(v) ?? parseWithCanvas(v)
}

/** Linear RGB in OKLab (L about 0 to 1), where mixing two colours keeps their lightness even and hue honest. */
export function linearToOklab([r, g, b]: LinearRGB): LinearRGB {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

/** The theme's colours a scene reads by default: the ground, the primary, the accent, then the brand's colour blocks. */
export const THEME_COLORS = ["--background", "--primary", "--accent", "--block-1", "--block-2", "--block-3", "--block-4"] as const

/** Neutral stops for a page with no theme at all (a light ground and a near-black). */
const HOUSE: LinearRGB[] = [fromBytes(247, 247, 245), fromBytes(24, 24, 27)]

/** Colours closer than this (linear RGB distance) count as one stop: the default blocks repeat the primary. */
const SAME = 0.004

const distinct = (list: LinearRGB[]) => list.filter((c, i) => list.slice(0, i).every((d) => Math.hypot(c[0] - d[0], c[1] - d[1], c[2] - d[2]) > SAME))

/** Resolves a custom property to a colour at `el`: through a hidden probe, so var() chains and color-mix() resolve the
 * way the page sees them. */
function themeColor(el: Element, name: string): LinearRGB | null {
  const raw = getComputedStyle(el).getPropertyValue(name).trim()
  if (!raw) return null
  const direct = parseHex(raw) ?? parseRgb(raw)
  if (direct) return direct
  const span = document.createElement("span")
  span.style.display = "none"
  span.style.color = `var(${name})`
  el.appendChild(span)
  const computed = getComputedStyle(span).color
  span.remove()
  return parseColor(computed) ?? parseColor(raw)
}

/** The palette a scene uses when it is given none: the theme's colours at `el` (THEME_COLORS, the ones that are set
 * and distinct), at most `max` (3 to 5), and never fewer than two. */
export function themePalette(el: Element | null, max = 5): LinearRGB[] {
  if (!el || typeof document === "undefined") return HOUSE.slice()
  const found = distinct(THEME_COLORS.map((name) => themeColor(el, name)).filter((c): c is LinearRGB => c !== null)).slice(0, Math.max(2, max))
  if (found.length >= 2) return found
  return found.length === 1 ? [found[0], HOUSE.find((h) => Math.hypot(h[0] - found[0][0], h[1] - found[0][1], h[2] - found[0][2]) > 0.25) ?? HOUSE[1]] : HOUSE.slice()
}

/** The given colours (unparseable ones dropped), else the theme's at `el`. */
export function resolvePalette(colors: readonly string[] | undefined, el: Element | null, max = 5): LinearRGB[] {
  const given = (colors ?? []).map(parseColor).filter((c): c is LinearRGB => c !== null).slice(0, max)
  if (given.length >= 2) return given
  const theme = themePalette(el, max)
  // One colour given: it is the ground, and the theme's other colours follow it.
  return given.length === 1 ? [given[0], ...theme.slice(1, max)] : theme
}

/** A palette as a flat vec3 array of `size` stops for a shader, the stops repeated in order to fill it (GLSL ES 1.00
 * can only index a uniform array with a loop index, so every slot must hold a real colour). */
export function paletteUniform(palette: readonly LinearRGB[], size = 5, space: "linear" | "oklab" = "linear"): Float32Array {
  const out = new Float32Array(size * 3)
  const list = palette.length ? palette : HOUSE
  for (let i = 0; i < size; i++) {
    const c = list[i % list.length]
    out.set(space === "oklab" ? linearToOklab(c) : c, i * 3)
  }
  return out
}
