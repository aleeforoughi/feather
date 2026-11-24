/** An open, self-hosted font (feather-tokens/3): WOFF2 files, a metric-matched local fallback, and a preload flag
 * (display faces only). */
export interface FontObject {
  family: string
  files: { src: string; weight?: number | [number, number]; style?: "normal" | "italic" }[]
  fallback: { family: "Arial" | "Helvetica" | "Helvetica Neue" | "Times New Roman" | "Georgia" | "Courier New"; sizeAdjust: number; ascentOverride: number; descentOverride: number; lineGapOverride?: number }
  preload?: boolean
  display?: "swap" | "optional" | "fallback"
  generic?: "sans-serif" | "serif" | "monospace"
}
export type FontSlot = string | FontObject
/** One step of the fluid display scale: size in rem and tracking in em, each at the 360px and the 1440px viewport. */
export interface DisplayStep {
  size?: { min?: number; max?: number }
  tracking?: { min?: number; max?: number }
  leading?: number
}
export type SignatureName = "expo-out" | "quint-out" | "sine-out" | "scout" | "sheet" | "standard"
export type ExpressionRole = "reveal" | "media" | "scene" | "stagger" | "hoverOut" | "spring"

/** Brand tokens as Feather reads them: feather-tokens/3 (feather-tokens/2 and qooe-tokens/1 migrate on read). */
export interface BrandTokens {
  schema?: "feather-tokens/3" | "feather-tokens/2" | "qooe-tokens/1"
  name?: string
  colors: { primary: string; background: string; surface: string; text: string } & Record<string, string>
  typography: {
    fontFamily: { display?: FontSlot; body?: FontSlot; mono?: FontSlot }
    headingWeight?: 400 | 500 | 600 | 700
    scale?: Record<string, string>
    /** feather-tokens/3: the fluid display scale (partial values merge over the house defaults). */
    display?: Partial<Record<"xl" | "l" | "m" | "s", DisplayStep>>
    features?: { tabularNums?: boolean; balanceTitles?: boolean; prettyBody?: boolean }
    /** A second face for the speaker's voice in a Living Page. */
    voiceFace?: FontSlot
  }
  spacing?: Record<string, string>
  radius?: Record<string, string>
  shape?: "sharp" | "soft" | "rounded" | "pill"
  density?: "compact" | "comfortable" | "spacious"
  elevation?: "flat" | "soft" | "dramatic"
  motion?: "calm" | "snappy"
  /** feather-tokens/3. Cinematic stretches only the expression roles; product UI runs calm. */
  pace?: "calm" | "snappy" | "cinematic"
  signature?: SignatureName | { cubicBezier: [number, number, number, number] }
  overshoot?: boolean
  spring?: { bounce?: number }
  reduced?: Partial<Record<ExpressionRole, "fade" | "none">>
  contrast?: "quiet" | "bold"
  surface?: "flat" | "paper" | "glass" | "film"
  /** Glass only: the overlay blur in px (8 to 30). */
  blur?: number
  /** Film only: the grain opacity (0.02 to 0.08). */
  grain?: number
  focus?: "accent" | "primary"
  voice?: string[]
  /** Component tokens, keyed "slot" or "slot.variant". */
  components?: Record<string, Record<string, string | number>>
}

/** A reference theme file (themes/*.json). */
export interface ReferenceTheme {
  name: string
  dark: boolean
  tokens: BrandTokens
}

export type ThemeResult =
  | {
      ok: true
      css: string
      fonts: string
      derived: DerivedEmphasis
      /** Preload links for display faces marked `preload` (feather-tokens/3). */
      preload: { href: string; as: "font"; type: "font/woff2"; crossorigin: "anonymous" }[]
      summary: { shape: string; density: string; elevation: string; motion: string; display: string; body: string; pace?: string; signature?: string; contrast?: string; surface?: string; focus?: string }
    }
  | { ok: false; problems: string[] }

/** The emphasis colors the engine derived (hex), for tests and audits. */
export interface DerivedEmphasis {
  textPrimary: string
  textSecondary: string
  textTertiary: string
  borderPrimary: string
}

export type MigrationResult = { ok: true; tokens: BrandTokens & { schema: "feather-tokens/3" }; from: string } | { ok: false; problems: string[] }

export const TOKEN_SCHEMA: "feather-tokens/3"
export const KNOWN_SCHEMAS: readonly string[]
export function migrateTokens(input: unknown): MigrationResult

export function buildTheme(tokens: unknown): ThemeResult
export function contrastRatio(a: unknown, b: unknown): number | null

export const FONTS: Record<string, string>
export const STATIC_FONT_WEIGHTS: Record<string, number[]>
export function fontFamilyName(name: string): string
export function fontSlug(name: string): string
export function fontSources(name: string): string[]
export function fontImports(name: string): string[]

export type RadiusTier = "xs" | "control" | "card" | "dialog"
export type SemanticDensity = "tight" | "default" | "spacious"

export const HEADING_WEIGHTS: readonly [400, 500, 600, 700]
/** Per shape: each radius tier, plus `step`, the radius one enclosing level adds (section 7). */
export const RADIUS_TIERS: Record<"sharp" | "soft" | "rounded" | "pill", Record<RadiusTier | "step", string>>
export const RADIUS_PRIMITIVES: Record<"0" | "4" | "8" | "12" | "16" | "20" | "24" | "full", string>
/** The card radius of each shape. */
export const SHAPES: { sharp: string; soft: string; rounded: string; pill: string }
/** Brand density axis value → semantic density. */
export const DENSITY: { compact: "tight"; comfortable: "default"; spacious: "spacious" }
export const DENSITIES: Record<SemanticDensity, Record<string, string>>
export const ELEVATION: Record<"flat" | "soft" | "dramatic", Record<1 | 2 | 3, string>>
export const SHADOW_ALIASES: Record<"xs" | "sm" | "md" | "lg" | "xl", 1 | 2 | 3>
export const DURATIONS: Record<"calm" | "snappy", Record<"micro" | "fast" | "base" | "medium" | "slow" | "large", number>>
export const MOTION: typeof DURATIONS
export const EASE_STANDARD: string
export const CONTRAST_FLOORS: { textPrimary: number; textSecondary: number; textTertiary: number; icon: number; borderPrimary: number; onTint: number; destructive: number }
/** `pct`% of hex `a` mixed into hex `b` in oklab, as a hex color: what CSS `color-mix(in oklab, a pct%, b)` makes. */
export function oklabMix(a: string, b: string, pct: number): string
/** The destructive tint percentages: the rest tint, and the range the hover tint is derived in (strongest first). */
/** WCAG AAA floors applied under [data-contrast="AAA"] (composer rule 10). */
export const AAA_FLOORS: { text: number }
export const DESTRUCTIVE_TINTS: { rest: number; hover: { strongest: number; weakest: number } }

// ── feather-tokens/3: the expression layer (src/expression.mjs) ──
export const SIGNATURES: Record<SignatureName, [number, number, number, number]>
export const DEFAULT_SIGNATURE: SignatureName
export const OVERSHOOT: [number, number, number, number]
export const CURVE_BOUNDS: { x: [number, number]; y: [number, number] }
export const PACES: readonly ["calm", "snappy", "cinematic"]
export const EXPRESSION_ROLES: Record<"calm" | "snappy" | "cinematic", { reveal: number; media: number; scene: number; staggerWord: number; staggerBlock: number; hoverOut: number; revealDistance: number; mediaScale: number; bounce: number }>
export const SEQUENCE_CAP_MS: number
export const REDUCED_FADE_MS: number
export const REDUCED_DEFAULTS: Record<ExpressionRole, "fade" | "none">
export const SPRING_BOUNCE: [number, number]
export const FLUID_VIEWPORT: [number, number]
export const DISPLAY_STEPS: readonly ["xl", "l", "m", "s"]
export const DISPLAY_DEFAULTS: Record<"xl" | "l" | "m" | "s", { size: { min: number; max: number }; tracking: { min: number; max: number }; leading: number }>
export const DISPLAY_BOUNDS: { size: [number, number]; tracking: [number, number]; leading: [number, number] }
export const CONTRASTS: Record<"quiet" | "bold", { weight: number; tighten: number }>
export const SURFACES: readonly ["flat", "paper", "glass", "film"]
export const GLASS_BLUR: { min: number; max: number; default: number }
export const FILM_GRAIN: { min: number; max: number; default: number }
export const FOCUS: readonly ["accent", "primary"]
export const FOCUS_FLOOR: number
export const FALLBACK_FACES: readonly string[]
export function fluidClamp(min: number, max: number, viewport?: [number, number]): string
export function fluidTracking(size: { min: number; max: number }, tracking: { min: number; max: number }, viewport?: [number, number]): string
