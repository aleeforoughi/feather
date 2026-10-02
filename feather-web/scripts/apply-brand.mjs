// QOOE Master Design System — theme engine.
// Turns brand/tokens.json into src/styles/brand.css (theme variables) and src/styles/brand-fonts.css.
// Deterministic: no network, no dependencies. Every component in src/components/ui reads these
// variables, so one file reshapes the whole system into the brand.
import fs from "node:fs"
import path from "node:path"

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Fonts pre-installed with the foundation (works offline in the sandbox): variable unless listed below. */
export const FONTS = {
  Geist: "@fontsource-variable/geist",
  Inter: "@fontsource-variable/inter",
  Sora: "@fontsource-variable/sora",
  "Space Grotesk": "@fontsource-variable/space-grotesk",
  "DM Sans": "@fontsource-variable/dm-sans",
  "Plus Jakarta Sans": "@fontsource-variable/plus-jakarta-sans",
  Outfit: "@fontsource-variable/outfit",
  Fraunces: "@fontsource-variable/fraunces",
  Manrope: "@fontsource-variable/manrope",
  Nunito: "@fontsource-variable/nunito",
  "Playfair Display": "@fontsource-variable/playfair-display",
  "JetBrains Mono": "@fontsource-variable/jetbrains-mono",
  Figtree: "@fontsource-variable/figtree",
  Poppins: "@fontsource/poppins",
}

/** Fonts without a variable cut: the weights loaded (enough for body, UI and display). */
export const STATIC_FONT_WEIGHTS = { Poppins: [400, 500, 600, 700, 800] }

/** The CSS family name a font is registered under. */
export const fontFamilyName = (name) => (STATIC_FONT_WEIGHTS[name] ? name : `${name} Variable`)

/** The stylesheet imports a font needs. */
export const fontImports = (name) => (STATIC_FONT_WEIGHTS[name] ? STATIC_FONT_WEIGHTS[name].map((w) => `${FONTS[name]}/${w}.css`) : [FONTS[name]])

export const SHAPES = { sharp: "0rem", soft: "0.375rem", rounded: "0.75rem", pill: "1.5rem" }
export const DENSITY = { compact: "0.22rem", comfortable: "0.25rem", spacious: "0.29rem" }
export const ELEVATION = {
  flat: { xs: "none", sm: "none", md: "none", lg: "none", xl: "none" },
  soft: {
    xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  },
  dramatic: {
    xs: "0 2px 4px 0 rgb(0 0 0 / 0.18)",
    sm: "0 4px 10px -2px rgb(0 0 0 / 0.25)",
    md: "0 10px 24px -6px rgb(0 0 0 / 0.32)",
    lg: "0 20px 40px -10px rgb(0 0 0 / 0.4)",
    xl: "0 32px 64px -16px rgb(0 0 0 / 0.5)",
  },
}
export const MOTION = { calm: ["320ms", "cubic-bezier(0.22, 1, 0.36, 1)"], snappy: ["160ms", "cubic-bezier(0.2, 0, 0, 1)"] }

function expand(hex) {
  const h = hex.toLowerCase()
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h
}

function luminance(hex) {
  const v = expand(hex).slice(1)
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** WCAG contrast of two hex colors; null when either is not a plain hex (e.g. a color-mix). */
export function contrastRatio(a, b) {
  return typeof a === "string" && typeof b === "string" && HEX.test(a) && HEX.test(b) ? contrast(a, b) : null
}

/** Text color for a fill: whichever of the brand's text/background reads better, else black/white. */
function onColor(fill, text, background) {
  const candidates = [text, background, "#000000", "#ffffff"].filter(Boolean)
  return candidates.reduce((best, c) => (contrast(fill, c) > contrast(fill, best) ? c : best), candidates[0])
}

/**
 * Component tokens (Amplify-style third tier): per-component overrides applied to the component's
 * data-slot, so a brand can reshape one component without touching its code. Generated rules are
 * un-layered CSS, which wins over Tailwind's layered utilities. Only these properties are allowed.
 */
const COMPONENT_PROPS = {
  radius: (v) => (v in SHAPES ? `border-radius: ${SHAPES[v]}` : /^\d+(\.\d+)?(px|rem)$/.test(v) ? `border-radius: ${v}` : null),
  borderWidth: (v) => (/^\d+(\.\d+)?px$/.test(v) ? `border-width: ${v}` : null),
  shadow: (v) => (v === "none" ? "box-shadow: none" : ["xs", "sm", "md", "lg", "xl"].includes(v) ? `box-shadow: var(--shadow-${v})` : null),
  fontWeight: (v) => (/^[1-9]00$/.test(String(v)) ? `font-weight: ${v}` : null),
  letterSpacing: (v) => (/^-?\d+(\.\d+)?em$/.test(v) ? `letter-spacing: ${v}` : null),
  textTransform: (v) => (["none", "uppercase", "lowercase", "capitalize"].includes(v) ? `text-transform: ${v}` : null),
  fontFamily: (v) => (v === "display" ? "font-family: var(--brand-font-display)" : v === "body" ? "font-family: var(--brand-font-body)" : null),
  paddingX: (v) => (Number.isFinite(v) && v >= 0 && v <= 16 ? `padding-inline: calc(var(--spacing) * ${v})` : null),
  height: (v) => (Number.isFinite(v) && v >= 4 && v <= 24 ? `height: calc(var(--spacing) * ${v})` : null),
  background: (v) => colorValue(v, "background"),
  foreground: (v) => colorValue(v, "color"),
  borderColor: (v) => colorValue(v, "border-color"),
}
const ROLES = { primary: "--primary", background: "--background", surface: "--card", text: "--foreground", accent: "--accent", muted: "--muted", border: "--border", destructive: "--destructive" }
function colorValue(v, prop) {
  if (typeof v !== "string") return null
  if (ROLES[v]) return `${prop}: var(${ROLES[v]})`
  return HEX.test(v) ? `${prop}: ${expand(v)}` : null
}

function componentRules(components, problems) {
  const rules = []
  // "slot" themes every variant of a component; "slot.variant" (e.g. "button.outline") themes one variant
  // and wins over the slot's own tokens (more specific selector, emitted after).
  const entries = Object.entries(components ?? {}).sort(([a], [b]) => Number(a.includes(".")) - Number(b.includes(".")))
  for (const [key, props] of entries) {
    const m = /^([a-z][a-z-]{1,40})(?:\.([a-z][a-z0-9-]{0,30}))?$/.exec(key)
    if (!m) {
      problems.push(`components.${key} is not a component slot name (use "slot" or "slot.variant")`)
      continue
    }
    const [, slot, variant] = m
    const decls = []
    for (const [prop, value] of Object.entries(props ?? {})) {
      const make = COMPONENT_PROPS[prop]
      const decl = make ? make(value) : null
      if (!decl) problems.push(`components.${key}.${prop} = ${JSON.stringify(value)} is not an allowed component token`)
      else decls.push(`  ${decl};`)
    }
    const selector = variant ? `[data-slot="${slot}"][data-variant="${variant}"]` : `[data-slot="${slot}"]`
    if (decls.length > 0) rules.push(`${selector} {\n${decls.join("\n")}\n}`)
  }
  return rules
}

export function buildTheme(tokens) {
  const problems = []
  const c = tokens.colors ?? {}
  for (const role of ["primary", "background", "surface", "text"]) {
    if (typeof c[role] !== "string" || !HEX.test(c[role])) problems.push(`colors.${role} must be a hex color`)
  }
  for (const [role, value] of Object.entries(c)) {
    if (typeof value === "string" && !HEX.test(value)) problems.push(`colors.${role} must be a hex color, got ${value}`)
  }
  const fonts = tokens.typography?.fontFamily ?? {}
  const display = fonts.display ?? fonts.body
  const body = fonts.body ?? fonts.display
  for (const [slot, family] of [["display", display], ["body", body]]) {
    if (!family) problems.push(`typography.fontFamily.${slot} is required`)
    else if (!FONTS[family]) problems.push(`typography.fontFamily.${slot} "${family}" is not in the foundation font set: ${Object.keys(FONTS).join(", ")}`)
  }
  const headingWeight = tokens.typography?.headingWeight
  if (headingWeight !== undefined && !(Number.isInteger(headingWeight) && headingWeight >= 100 && headingWeight <= 900 && headingWeight % 100 === 0)) {
    problems.push("typography.headingWeight must be 100–900 in steps of 100")
  }
  const shape = tokens.shape ?? "soft"
  const density = tokens.density ?? "comfortable"
  const elevation = tokens.elevation ?? "soft"
  const motion = tokens.motion ?? "calm"
  if (!SHAPES[shape]) problems.push(`shape must be one of ${Object.keys(SHAPES).join(", ")}`)
  if (!DENSITY[density]) problems.push(`density must be one of ${Object.keys(DENSITY).join(", ")}`)
  if (!ELEVATION[elevation]) problems.push(`elevation must be one of ${Object.keys(ELEVATION).join(", ")}`)
  if (!MOTION[motion]) problems.push(`motion must be one of ${Object.keys(MOTION).join(", ")}`)
  const rules = componentRules(tokens.components, problems)
  if (problems.length > 0) return { ok: false, problems }

  const bg = expand(c.background)
  const text = expand(c.text)
  const surface = expand(c.surface)
  const primary = expand(c.primary)
  const accent = expand(c.accent ?? c.primary)
  const destructive = expand(c.destructive ?? "#e5484d")
  // Status colors: the brand's own when it names them, otherwise defaults tuned for a light or a dark background.
  const darkBg = luminance(bg) < 0.2
  const status = (name, light, dark) => {
    const color = expand(c[name] ?? (darkBg ? dark : light))
    return [color, expand(c[`${name}Text`] ?? onColor(color, text, bg))]
  }
  const [success, successText] = status("success", "#2f9e5c", "#4cc27d")
  const [warning, warningText] = status("warning", "#e8a215", "#f0b84a")
  const [info, infoText] = status("info", "#2f78c4", "#5aa0e6")
  const mix = (a, b, pct) => `color-mix(in oklab, ${a} ${pct}%, ${b})`
  const shadows = ELEVATION[elevation]
  const [duration, ease] = MOTION[motion]
  const vars = {
    "--background": bg,
    "--foreground": text,
    "--card": surface,
    "--card-foreground": text,
    "--popover": surface,
    "--popover-foreground": text,
    "--primary": primary,
    "--primary-foreground": expand(c.primaryText ?? onColor(primary, text, bg)),
    "--secondary": mix(text, surface, 10),
    "--secondary-foreground": text,
    "--muted": mix(text, bg, 8),
    // Supporting text: the brand's own color when it names one, otherwise a quiet mix of text and background.
    "--muted-foreground": c.mutedForeground ? expand(c.mutedForeground) : mix(text, bg, 64),
    "--accent": mix(accent, bg, 18),
    "--accent-foreground": text,
    "--destructive": destructive,
    "--success": success,
    "--success-foreground": successText,
    "--warning": warning,
    "--warning-foreground": warningText,
    "--info": info,
    "--info-foreground": infoText,
    "--border": expand(c.border ?? "") === "" ? mix(text, bg, 16) : expand(c.border),
    "--input": mix(text, bg, 20),
    "--ring": primary,
    "--chart-1": primary,
    "--chart-2": accent,
    "--chart-3": mix(primary, text, 55),
    "--chart-4": mix(accent, bg, 60),
    "--chart-5": mix(text, bg, 45),
    "--radius": SHAPES[shape],
    "--sidebar": surface,
    "--sidebar-foreground": text,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": expand(c.primaryText ?? onColor(primary, text, bg)),
    "--sidebar-accent": mix(accent, surface, 18),
    "--sidebar-accent-foreground": text,
    "--sidebar-border": mix(text, surface, 16),
    "--sidebar-ring": primary,
    "--brand-font-body": `"${fontFamilyName(body)}", ${body === "JetBrains Mono" ? "monospace" : "sans-serif"}`,
    "--brand-font-display": `"${fontFamilyName(display)}", sans-serif`,
    "--spacing": DENSITY[density],
    "--shadow-xs": shadows.xs,
    "--shadow-sm": shadows.sm,
    "--shadow-md": shadows.md,
    "--shadow-lg": shadows.lg,
    "--shadow-xl": shadows.xl,
    "--motion-duration": duration,
    "--motion-ease": ease,
  }
  const css = `/* Generated by scripts/apply-brand.mjs from brand/tokens.json — do not edit by hand. */\n:root:root {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n  color-scheme: ${luminance(bg) < 0.2 ? "dark" : "light"};\n}\n${headingWeight !== undefined ? `\n/* Heading weight (typography.headingWeight) — component tokens below may still override one component. */\n.font-heading {\n  font-weight: ${headingWeight};\n}\n` : ""}${rules.length > 0 ? `\n/* Component tokens */\n${rules.join("\n\n")}\n` : ""}`
  const imports = [...new Set([...fontImports(display), ...fontImports(body)])].map((pkg) => `@import "${pkg}";`).join("\n")
  return { ok: true, css, fonts: `/* Generated by scripts/apply-brand.mjs — brand fonts. */\n${imports}\n`, summary: { shape, density, elevation, motion, display, body } }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (isMain) {
  const tokensPath = "brand/tokens.json"
  if (!fs.existsSync(tokensPath)) {
    console.log("No brand/tokens.json yet — the foundation keeps its neutral theme.")
    process.exit(0)
  }
  const theme = buildTheme(JSON.parse(fs.readFileSync(tokensPath, "utf8")))
  if (!theme.ok) {
    console.log(`Brand theme failed:\n- ${theme.problems.join("\n- ")}`)
    process.exit(1)
  }
  fs.mkdirSync("src/styles", { recursive: true })
  fs.writeFileSync("src/styles/brand.css", theme.css)
  fs.writeFileSync("src/styles/brand-fonts.css", theme.fonts)
  console.log(`Brand theme applied: ${JSON.stringify(theme.summary)}`)
}
