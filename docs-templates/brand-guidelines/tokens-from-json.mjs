#!/usr/bin/env node
// Maps a qooe-tokens/1 brand/tokens.json to the CSS custom properties the Feather brand-guidelines template reads.
//   node tokens-from-json.mjs <brand/tokens.json> <out tokens.css>
// Node built-ins only. Missing optional colors get derived values; every text/background pair the template uses
// is nudged until it is readable (WCAG AA).
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const HEX = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i
const PX = /^\d+(\.\d+)?px$/
const FONT = /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/

const DEFAULTS = {
  fontFamily: { display: "Space Grotesk", body: "Inter" },
  scale: { xs: "12px", sm: "14px", base: "16px", lg: "20px", xl: "28px", display: "56px" },
  spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "40px", xxl: "64px" },
  radius: { sm: "4px", md: "8px", lg: "16px" },
}

const rgbOf = (hex) => {
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join("")
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("").toUpperCase()}`
const norm = (hex) => toHex(rgbOf(hex))

export const luminance = (hex) => {
  const [r, g, b] = rgbOf(hex).map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** `amount` (0-1) of `a` over `b`. */
export const mix = (a, b, amount) => {
  const x = rgbOf(a)
  const y = rgbOf(b)
  return toHex(x.map((v, i) => v * amount + y[i] * (1 - amount)))
}
/** Moves `fg` toward `toward` until it reads at `ratio` or better on every background. */
export const ensure = (fg, backgrounds, ratio, toward) => {
  let out = fg
  for (let step = 1; step <= 20 && backgrounds.some((bg) => contrast(out, bg) < ratio); step++) out = mix(toward, fg, step / 20)
  return out
}
/** The readable text color for `bg`: the first candidate that passes 4.5:1, else the better of white and near-black. */
export const onColor = (bg, candidates) => {
  const ok = candidates.filter((c) => contrast(c, bg) >= 4.5).sort((a, b) => contrast(b, bg) - contrast(a, bg))
  if (ok.length) return ok[0]
  return contrast("#FFFFFF", bg) >= contrast("#0B0B0B", bg) ? "#FFFFFF" : "#0B0B0B"
}

const color = (v) => (typeof v === "string" && HEX.test(v) ? norm(v) : null)
const size = (v, fallback) => (typeof v === "string" && PX.test(v) ? v : fallback)
const family = (v, fallback) => (typeof v === "string" && FONT.test(v.trim()) ? v.trim() : fallback)

const stack = (name, fallback) => [...new Set([name, fallback])].map((f) => `"${f}"`).join(", ") + ", system-ui, sans-serif"

export function tokensToCss(tokens, source = "brand/tokens.json") {
  const c = tokens?.colors ?? {}
  const need = (role) => {
    const v = color(c[role])
    if (!v) throw new Error(`tokens.colors.${role} must be a #hex color, got ${JSON.stringify(c[role])}`)
    return v
  }
  const primary = need("primary")
  const background = need("background")
  const surface = need("surface")
  const text = need("text")
  const dark = luminance(background) < 0.25
  const accent = color(c.accent) ?? mix(primary, background, 0.4)
  const border = color(c.border) ?? mix(text, background, 0.14)
  const muted = ensure(color(c.mutedForeground) ?? mix(text, background, 0.68), [background, surface], 4.5, text)
  const given = color(c.primaryText)
  const onPrimary = given && contrast(given, primary) >= 4.5 ? given : onColor(primary, [surface, background, text])
  const onPrimaryMuted = ensure(mix(onPrimary, primary, 0.78), [primary], 4.5, onPrimary)
  const onPrimaryLine = mix(onPrimary, primary, 0.3)
  const onAccent = onColor(accent, [text, background, surface])
  const destructive = ensure(color(c.destructive) ?? (dark ? "#E8806E" : "#B3402F"), [background, surface], 3, dark ? "#FFFFFF" : "#000000")
  const success = ensure(color(c.success) ?? (dark ? "#6FCF9F" : "#2F7D5B"), [background, surface], 3, dark ? "#FFFFFF" : "#000000")

  const ty = tokens?.typography ?? {}
  const fonts = { display: family(ty.fontFamily?.display, DEFAULTS.fontFamily.display), body: family(ty.fontFamily?.body, DEFAULTS.fontFamily.body) }
  const scale = Object.fromEntries(Object.entries(DEFAULTS.scale).map(([k, d]) => [k, size(ty.scale?.[k], d)]))
  const spacing = Object.fromEntries(Object.entries(DEFAULTS.spacing).map(([k, d]) => [k, size(tokens?.spacing?.[k], d)]))
  const radius = Object.fromEntries(Object.entries(DEFAULTS.radius).map(([k, d]) => [k, size(tokens?.radius?.[k], d)]))
  const name = typeof tokens?.name === "string" ? tokens.name.replace(/[^\w .-]/g, "").trim() : ""

  const lines = [
    `/* Generated from ${source}${name ? ` (${name})` : ""} by tokens-from-json.mjs. Do not edit: change the tokens and regenerate. */`,
    ":root {",
    `  --brand-primary: ${primary};`,
    `  --brand-on-primary: ${onPrimary};`,
    `  --brand-on-primary-muted: ${onPrimaryMuted};`,
    `  --brand-on-primary-line: ${onPrimaryLine};`,
    `  --brand-background: ${background};`,
    `  --brand-surface: ${surface};`,
    `  --brand-text: ${text};`,
    `  --brand-muted: ${muted};`,
    `  --brand-accent: ${accent};`,
    `  --brand-on-accent: ${onAccent};`,
    `  --brand-border: ${border};`,
    `  --brand-destructive: ${destructive};`,
    `  --brand-success: ${success};`,
    "",
    `  --font-display: ${stack(fonts.display, DEFAULTS.fontFamily.display)};`,
    `  --font-body: ${stack(fonts.body, DEFAULTS.fontFamily.body)};`,
    '  --font-mono: "JetBrains Mono", ui-monospace, monospace;',
    `  --font-display-name: "${fonts.display}";`,
    `  --font-body-name: "${fonts.body}";`,
    "",
    ...Object.entries(scale).map(([k, v]) => `  --text-${k}: ${v};`),
    ...Object.entries(spacing).map(([k, v]) => `  --space-${k}: ${v};`),
    ...Object.entries(radius).map(([k, v]) => `  --radius-${k}: ${v};`),
    "}",
    "",
  ]
  return lines.join("\n")
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invoked) {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) {
    console.error("usage: node tokens-from-json.mjs <brand/tokens.json> <out tokens.css>")
    process.exit(2)
  }
  try {
    const css = tokensToCss(JSON.parse(fs.readFileSync(input, "utf8")), path.basename(path.dirname(path.resolve(input))) + "/" + path.basename(input))
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
    fs.writeFileSync(output, css)
    console.log(`wrote ${output}`)
  } catch (err) {
    console.error(`tokens-from-json: ${err.message}`)
    process.exit(1)
  }
}
