// Feather theme engine.
// Turns brand tokens (feather-tokens/2, or qooe-tokens/1 through migrateTokens) into the theme CSS every Feather
// component reads, plus the font imports the brand needs. Deterministic: no network, no dependencies, no Node
// built-ins, so it runs the same in Node (the feather-brand CLI) and in the browser (Storybook, the playground).
import { migrateTokens } from "./schema.mjs"

/** The heading weights a brand may pick (section 2). */
export const HEADING_WEIGHTS = [400, 500, 600, 700]

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
  "Geist Mono": "@fontsource-variable/geist-mono",
  Figtree: "@fontsource-variable/figtree",
  Poppins: "@fontsource/poppins",
}

/** Fonts without a variable cut: the weights loaded (enough for body, UI and display). */
export const STATIC_FONT_WEIGHTS = { Poppins: [400, 500, 600, 700, 800] }

/** The CSS family name a font is registered under. */
export const fontFamilyName = (name) => (STATIC_FONT_WEIGHTS[name] ? name : `${name} Variable`)

/** The URL-safe file name of a font family: "Plus Jakarta Sans" → "plus-jakarta-sans". */
/** The generic family a font falls back to: monospace for the mono families, sans-serif otherwise. */
const fallback = (name) => (/\bMono\b/.test(name) ? "monospace" : "sans-serif")

export const fontSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-")

/** The Fontsource stylesheets a font needs. */
export const fontSources = (name) => (STATIC_FONT_WEIGHTS[name] ? STATIC_FONT_WEIGHTS[name].map((w) => `${FONTS[name]}/${w}.css`) : [FONTS[name]])

/**
 * The stylesheet a theme imports for a font: this package's own fonts/<slug>.css, which imports the Fontsource
 * package. Resolving through @aleeforoughi/feather-tokens means a product never installs the fonts itself.
 */
export const fontImports = (name) => [`@aleeforoughi/feather-tokens/fonts/${fontSlug(name)}.css`]

/**
 * Radius tiers per brand shape (docs/visual-system.md section 7). Every set obeys nesting: xs <= control <= card <=
 * dialog, with "full" (a pill) only as a control radius. A brand's shape picks one set and can never produce another.
 */
/** Radius hierarchy per shape (section 7). The control (button) radius is the base; each enclosing level adds one
 * `step`: a card holding controls is control + step, a card holding a card one step more, and a dialog sits at least
 * a step above what it holds. Curves inside curves are therefore always tighter, and an item inset by one step in a
 * list is exactly concentric. `card` and `dialog` are the values with nothing rounded nested inside. */
export const RADIUS_TIERS = {
  sharp: { xs: "0px", control: "0px", card: "0px", dialog: "0px", step: "0px" },
  soft: { xs: "0.25rem", control: "0.25rem", card: "0.5rem", dialog: "0.75rem", step: "0.25rem" },
  rounded: { xs: "0.25rem", control: "0.5rem", card: "0.75rem", dialog: "1rem", step: "0.25rem" },
  pill: { xs: "0.25rem", control: "9999px", card: "1rem", dialog: "1.25rem", step: "0.25rem" },
}
/** The radius primitives (section 2): 0, 4, 8, 12, 16 and full. */
export const RADIUS_PRIMITIVES = { 0: "0px", 4: "0.25rem", 8: "0.5rem", 12: "0.75rem", 16: "1rem", 20: "1.25rem", 24: "1.5rem", full: "9999px" }
/** The card radius of each shape (the radius a surface gets): what `--radius` aliases. */
export const SHAPES = Object.fromEntries(Object.entries(RADIUS_TIERS).map(([shape, tiers]) => [shape, tiers.card]))

/**
 * Density (section 3). The brand's `density` axis keeps its schema names (compact, comfortable, spacious) and each maps
 * onto one semantic density. DENSITIES holds the variables each semantic density sets.
 */
export const DENSITY = { compact: "tight", comfortable: "default", spacious: "spacious" }
export const DENSITIES = {
  tight: {
    "--control-height": "2.25rem",
    "--control-px": "0.75rem",
    "--control-py": "0.5rem",
    "--icon-slot": "1rem",
    "--pad-x": "1rem",
    "--pad-y": "0.75rem",
    "--card-pad": "1rem",
    "--dialog-pad": "1.5rem",
    "--gap": "0.5rem",
    "--group-gap": "1rem",
    "--inset-content-y": "1rem",
    "--inset-content-x": "1.5rem",
    "--inset-header-top": "1.25rem",
    "--inset-header-bottom": "0.75rem",
    "--inset-header-x": "1.5rem",
    "--inset-action": "1rem",
    "--inset-utility-y": "0.5rem",
    "--inset-utility-x": "0.75rem",
    "--inset-display": "1.5rem",
    "--gap-action": "0.5rem",
    "--gap-label": "0.25rem",
    "--gap-field": "0.75rem",
  },
  default: {
    "--control-height": "2.75rem",
    "--control-px": "1rem",
    "--control-py": "0.75rem",
    "--icon-slot": "1.25rem",
    "--pad-x": "1.5rem",
    "--pad-y": "1rem",
    "--card-pad": "1.5rem",
    "--dialog-pad": "2rem",
    "--gap": "0.75rem",
    "--group-gap": "1.5rem",
    "--inset-content-y": "1.25rem",
    "--inset-content-x": "2rem",
    "--inset-header-top": "1.5rem",
    "--inset-header-bottom": "1rem",
    "--inset-header-x": "2rem",
    "--inset-action": "1.25rem",
    "--inset-utility-y": "0.75rem",
    "--inset-utility-x": "1rem",
    "--inset-display": "2rem",
    "--gap-action": "0.5rem",
    "--gap-label": "0.5rem",
    "--gap-field": "1rem",
  },
  spacious: {
    "--control-height": "3.25rem",
    "--control-px": "1.25rem",
    "--control-py": "1rem",
    "--icon-slot": "1.5rem",
    "--pad-x": "2rem",
    "--pad-y": "1.5rem",
    "--card-pad": "2rem",
    "--dialog-pad": "2.5rem",
    "--gap": "1rem",
    "--group-gap": "2rem",
    "--inset-content-y": "1.5rem",
    "--inset-content-x": "2.5rem",
    "--inset-header-top": "2rem",
    "--inset-header-bottom": "1.25rem",
    "--inset-header-x": "2.5rem",
    "--inset-action": "1.5rem",
    "--inset-utility-y": "1rem",
    "--inset-utility-x": "1.25rem",
    "--inset-display": "3rem",
    "--gap-action": "0.75rem",
    "--gap-label": "0.5rem",
    "--gap-field": "1.25rem",
  },
}

/** Elevation levels 1 to 3 per brand axis (section 8). Level 0 is "none"; components use shadow-1, shadow-2, shadow-3. */
export const ELEVATION = {
  flat: { 1: "none", 2: "none", 3: "0 12px 32px rgb(0 0 0 / 0.12)" },
  soft: { 1: "0 1px 2px rgb(0 0 0 / 0.06)", 2: "0 4px 12px rgb(0 0 0 / 0.08)", 3: "0 12px 32px rgb(0 0 0 / 0.12)" },
  dramatic: { 1: "0 2px 4px rgb(0 0 0 / 0.18)", 2: "0 10px 24px -6px rgb(0 0 0 / 0.32)", 3: "0 20px 40px -10px rgb(0 0 0 / 0.4)" },
}
/** The Tailwind shadow scale, kept as aliases of the three levels (xs and sm are level 1, md level 2, lg and xl level 3). */
export const SHADOW_ALIASES = { xs: 1, sm: 1, md: 2, lg: 3, xl: 3 }

/** The six durations per motion axis, in milliseconds (section 10), and the one curve. */
export const DURATIONS = {
  calm: { micro: 100, fast: 140, base: 180, medium: 240, slow: 320, large: 420 },
  snappy: { micro: 80, fast: 100, base: 140, medium: 180, slow: 240, large: 320 },
}
export const MOTION = DURATIONS
export const EASE_STANDARD = "cubic-bezier(0.4, 0, 0.2, 1)"

/** The contrast floors the engine derives colors to (section 5), against both `--background` and `--card`. */
export const CONTRAST_FLOORS = {
  textPrimary: 7,
  textSecondary: 4.5,
  textTertiary: 4.5,
  /** A meaningful icon. Icons share the text scale, so they meet the text floors; this is the minimum. */
  icon: 3,
  /** The border that identifies a control (inputs, selects, outline buttons). */
  borderPrimary: 3,
  /** Primary text on a tinted surface (hover, pressed, selected, a status tint). */
  onTint: 4.5,
  /** The destructive color: the atoms set error and destructive text in it, on the surfaces and on its own tint. */
  destructive: 4.5,
}

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

const toLinear = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
const fromLinear = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)

function toOklab(hex) {
  const v = expand(hex).slice(1)
  const [r, g, b] = [0, 2, 4].map((i) => toLinear(parseInt(v.slice(i, i + 2), 16) / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return `#${rgb.map((x) => Math.round(Math.min(1, Math.max(0, fromLinear(x))) * 255).toString(16).padStart(2, "0")).join("")}`
}

/** `pct`% of `a` mixed into `b` in oklab, as a hex color: the same mix CSS `color-mix(in oklab, a pct%, b)` makes. */
function oklabMix(a, b, pct) {
  const [x, y] = [toOklab(a), toOklab(b)]
  return fromOklab(x.map((v, i) => (v * pct) / 100 + (y[i] * (100 - pct)) / 100))
}

/**
 * The lightest mix of `fg` into `base` (the smallest whole percentage of `fg`) that reaches `min` contrast against every
 * color in `against`. Returns { pct, hex }, or null when even `fg` itself cannot reach it.
 */
function lightestMix(fg, base, against, min) {
  for (let pct = 1; pct <= 100; pct++) {
    const hex = oklabMix(fg, base, pct)
    if (against.every((surface) => contrast(hex, surface) >= min)) return { pct, hex }
  }
  return null
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
  // A radius tier (xs, control, card, dialog) or one of the radius primitives (0, 4, 8, 12, 16, full): never a free value.
  radius: (v) => (["xs", "control", "card", "dialog"].includes(v) ? `border-radius: var(--radius-${v})` : String(v) in RADIUS_PRIMITIVES ? `border-radius: ${RADIUS_PRIMITIVES[v]}` : null),
  // Borders are 1px or none (docs/visual-system.md section 8).
  borderWidth: (v) => (v === "0px" || v === "1px" ? `border-width: ${v}` : null),
  shadow: (v) => (v === "none" ? "box-shadow: none" : [1, 2, 3].includes(Number(v)) ? `box-shadow: var(--elevation-${v})` : v in SHADOW_ALIASES ? `box-shadow: var(--elevation-${SHADOW_ALIASES[v]})` : null),
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
const ROLES = { primary: "--primary", background: "--background", surface: "--card", text: "--text-primary", accent: "--accent", muted: "--muted", border: "--border-secondary", destructive: "--destructive" }
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

export function buildTheme(input) {
  const migrated = migrateTokens(input)
  if (!migrated.ok) return { ok: false, problems: migrated.problems }
  const tokens = migrated.tokens
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
  if (headingWeight !== undefined && !HEADING_WEIGHTS.includes(headingWeight)) {
    problems.push(`typography.headingWeight must be one of ${HEADING_WEIGHTS.join(", ")}`)
  }
  const shape = tokens.shape ?? "rounded"
  const density = tokens.density ?? "comfortable"
  const elevation = tokens.elevation ?? "soft"
  const motion = tokens.motion ?? "calm"
  if (!RADIUS_TIERS[shape]) problems.push(`shape must be one of ${Object.keys(RADIUS_TIERS).join(", ")}`)
  if (!DENSITY[density]) problems.push(`density must be one of ${Object.keys(DENSITY).join(", ")}`)
  if (!ELEVATION[elevation]) problems.push(`elevation must be one of ${Object.keys(ELEVATION).join(", ")}`)
  if (!DURATIONS[motion]) problems.push(`motion must be one of ${Object.keys(DURATIONS).join(", ")}`)
  const rules = componentRules(tokens.components, problems)
  if (problems.length > 0) return { ok: false, problems }

  const bg = expand(c.background)
  const text = expand(c.text)
  const surface = expand(c.surface)
  const primary = expand(c.primary)
  const accent = expand(c.accent ?? c.primary)
  // The default red is chosen per side of the theme; on a light background the brighter red misses 4.5:1 as text.
  const darkBg = luminance(bg) < 0.2
  const destructive = expand(c.destructive ?? (darkBg ? "#ff6b62" : "#b42318"))
  // Status colors: the brand's own when it names them, otherwise defaults tuned for a light or a dark background.
  const status = (name, light, dark) => {
    const color = expand(c[name] ?? (darkBg ? dark : light))
    return [color, expand(c[`${name}Text`] ?? onColor(color, text, bg))]
  }
  const [success, successText] = status("success", "#2f9e5c", "#4cc27d")
  const [warning, warningText] = status("warning", "#e8a215", "#f0b84a")
  const [info, infoText] = status("info", "#2f78c4", "#5aa0e6")
  const mix = (a, b, pct) => `color-mix(in oklab, ${a} ${pct}%, ${b})`

  // ── Emphasis (section 5): derived from the brand's own colors, each checked against --card and --background. ──
  const on = [bg, surface]
  const worst = (color) => Math.min(...on.map((s) => contrast(color, s)))
  const ratio = (color) => `${worst(color).toFixed(2)}:1`
  const secondaryGiven = c.mutedForeground ? expand(c.mutedForeground) : null
  if (worst(text) < CONTRAST_FLOORS.textPrimary) problems.push(`colors.text reaches ${ratio(text)} on colors.background and colors.surface; --text-primary needs ${CONTRAST_FLOORS.textPrimary}:1`)
  if (secondaryGiven && worst(secondaryGiven) < CONTRAST_FLOORS.textSecondary) problems.push(`colors.mutedForeground reaches ${ratio(secondaryGiven)} on colors.background and colors.surface; --text-secondary needs ${CONTRAST_FLOORS.textSecondary}:1`)
  const tertiary = lightestMix(text, bg, on, CONTRAST_FLOORS.textTertiary)
  if (!tertiary) problems.push(`no mix of colors.text into colors.background reaches ${CONTRAST_FLOORS.textTertiary}:1 for --text-tertiary`)
  const borderPrimary = lightestMix(text, bg, on, CONTRAST_FLOORS.borderPrimary)
  if (!borderPrimary) problems.push(`no mix of colors.text into colors.background reaches ${CONTRAST_FLOORS.borderPrimary}:1 for --border-primary`)
  const destructiveOn = [...on, oklabMix(destructive, surface, 12)]
  const destructiveWorst = Math.min(...destructiveOn.map((s) => contrast(destructive, s)))
  if (destructiveWorst < CONTRAST_FLOORS.destructive) problems.push(`colors.destructive reaches ${destructiveWorst.toFixed(2)}:1 on colors.background, colors.surface and its own tint; error and destructive text need ${CONTRAST_FLOORS.destructive}:1`)
  if (problems.length > 0) return { ok: false, problems }
  // Secondary sits between primary and tertiary: the brand's mutedForeground, or the mix halfway from the floor to full text.
  const halfway = oklabMix(text, bg, Math.ceil((tertiary.pct + 100) / 2))
  const textSecondary = secondaryGiven ?? (worst(halfway) >= CONTRAST_FLOORS.textSecondary ? halfway : tertiary.hex)
  const derived = { textPrimary: text, textSecondary, textTertiary: tertiary.hex, borderPrimary: borderPrimary.hex }

  // Text on every tint the system lays under it must stay readable.
  const tints = {
    "--surface-hover": 6,
    "--surface-pressed": 10,
  }
  const onTint = (name, tint) => {
    const r = contrast(text, tint)
    if (r < CONTRAST_FLOORS.onTint) problems.push(`${name} leaves --text-primary at ${r.toFixed(2)}:1; text on a tint needs ${CONTRAST_FLOORS.onTint}:1`)
  }
  for (const [name, pct] of Object.entries(tints)) onTint(name, oklabMix(text, surface, pct))
  onTint("--surface-selected", oklabMix(primary, surface, 12))
  for (const [name, color] of [["--destructive-muted", destructive], ["--success-muted", success], ["--warning-muted", warning], ["--info-muted", info]]) onTint(name, oklabMix(color, surface, 12))
  if (problems.length > 0) return { ok: false, problems }

  const shadows = ELEVATION[elevation]
  const durations = DURATIONS[motion]
  const tiers = RADIUS_TIERS[shape]
  const semanticDensity = DENSITY[density]
  const vars = {
    "--background": bg,
    "--foreground": "var(--text-primary)",
    "--card": surface,
    "--card-foreground": "var(--text-primary)",
    "--popover": surface,
    "--popover-foreground": "var(--text-primary)",
    "--primary": primary,
    "--primary-foreground": expand(c.primaryText ?? onColor(primary, text, bg)),
    "--secondary": mix(text, surface, 10),
    "--secondary-foreground": "var(--text-primary)",
    "--muted": mix(text, bg, 8),
    "--muted-foreground": "var(--text-secondary)",
    "--accent": mix(accent, bg, 18),
    "--accent-foreground": "var(--text-primary)",
    "--destructive": destructive,
    "--destructive-muted": mix("var(--destructive)", "var(--card)", 12),
    "--success": success,
    "--success-foreground": successText,
    "--success-muted": mix("var(--success)", "var(--card)", 12),
    "--warning": warning,
    "--warning-foreground": warningText,
    "--warning-muted": mix("var(--warning)", "var(--card)", 12),
    "--info": info,
    "--info-foreground": infoText,
    "--info-muted": mix("var(--info)", "var(--card)", 12),
    // Emphasis: text, icons and borders share one scale.
    "--text-primary": text,
    "--text-secondary": textSecondary,
    "--text-tertiary": tertiary.hex,
    "--text-disabled": mix(text, bg, 38),
    "--text-inverse": bg,
    "--border-primary": borderPrimary.hex,
    "--border-secondary": c.border ? expand(c.border) : mix(text, bg, 16),
    "--border-tertiary": mix(text, bg, 10),
    "--border-disabled": mix(text, bg, 8),
    "--border-inverse": mix(bg, text, 24),
    "--border": "var(--border-secondary)",
    "--input": "var(--border-primary)",
    // Surfaces (section 6).
    "--surface-base": "var(--background)",
    "--surface-subtle": mix(text, bg, 4),
    "--surface-raised": "var(--card)",
    "--surface-overlay": "var(--popover)",
    "--surface-hover": mix(text, "var(--card)", 6),
    "--surface-pressed": mix(text, "var(--card)", 10),
    "--surface-selected": mix(primary, "var(--card)", 12),
    "--surface-disabled": mix(text, "var(--card)", 6),
    "--surface-inverse": text,
    // The scrim behind a dialog or sheet: it dims the page without hiding it; a dark theme needs more to read.
    "--scrim": darkBg ? "rgb(0 0 0 / 0.5)" : "rgb(0 0 0 / 0.1)",
    // Focus: one ring, three variants.
    "--ring": primary,
    "--ring-danger": "var(--destructive)",
    "--ring-inverse": "var(--text-inverse)",
    "--chart-1": primary,
    "--chart-2": accent,
    "--chart-3": mix(primary, text, 55),
    "--chart-4": mix(accent, bg, 60),
    "--chart-5": mix(text, bg, 45),
    "--radius-xs": tiers.xs,
    "--radius-control": tiers.control,
    "--radius-card": tiers.card,
    "--radius-step": tiers.step,
    "--radius-dialog": tiers.dialog,
    "--radius": "var(--radius-card)",
    "--sidebar": surface,
    "--sidebar-foreground": "var(--text-primary)",
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": expand(c.primaryText ?? onColor(primary, text, bg)),
    "--sidebar-accent": mix(accent, surface, 18),
    "--sidebar-accent-foreground": "var(--text-primary)",
    "--sidebar-border": mix(text, surface, 16),
    "--sidebar-ring": primary,
    "--brand-font-body": `"${fontFamilyName(body)}", ${fallback(body)}`,
    "--brand-font-display": `"${fontFamilyName(display)}", ${fallback(display)}`,
    // The unit is fixed; density sets sizes and gaps through its own variables.
    "--spacing": "0.25rem",
    ...DENSITIES[semanticDensity],
    "--opacity-disabled": "0.5",
    // Levels 1 to 3 (components use shadow-1, shadow-2, shadow-3, which read these); the Tailwind scale aliases them.
    "--elevation-1": shadows[1],
    "--elevation-2": shadows[2],
    "--elevation-3": shadows[3],
    ...Object.fromEntries(Object.entries(SHADOW_ALIASES).map(([name, level]) => [`--shadow-${name}`, `var(--elevation-${level})`])),
    ...Object.fromEntries(Object.entries(durations).map(([name, ms]) => [`--duration-${name}`, `${ms}ms`])),
    "--ease-standard": EASE_STANDARD,
    "--motion-duration": "var(--duration-base)",
    "--motion-ease": "var(--ease-standard)",
    ...(headingWeight !== undefined ? { "--heading-weight": String(headingWeight) } : {}),
  }
  const densityBlocks = Object.entries(DENSITIES)
    .map(([name, set]) => `[data-density="${name}"],\n:root:root[data-density="${name}"] {\n${Object.entries(set).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`)
    .join("\n\n")
  const css = `/* Generated by feather-brand (@aleeforoughi/feather-tokens) from the brand tokens — do not edit by hand. */\n:root:root {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n  color-scheme: ${darkBg ? "dark" : "light"};\n}\n\n/* Density: any element with data-density overrides the density variables for its subtree. */\n${densityBlocks}\n${headingWeight !== undefined ? `\n/* Heading weight (typography.headingWeight) — component tokens below may still override one component. */\n.font-heading {\n  font-weight: ${headingWeight};\n}\n` : ""}${rules.length > 0 ? `\n/* Component tokens */\n${rules.join("\n\n")}\n` : ""}`
  const imports = [...new Set([...fontImports(display), ...fontImports(body)])].map((pkg) => `@import "${pkg}";`).join("\n")
  return { ok: true, css, fonts: `/* Generated by feather-brand (@aleeforoughi/feather-tokens) — brand fonts. */\n${imports}\n`, derived, summary: { shape, density, elevation, motion, display, body } }
}
