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
/** feather-tokens/4: how loud the brand's website patterns may get (0 quiet, 1 composed, 2 expressive, 3 spectacle). */
export type Loudness = 0 | 1 | 2 | 3
/** feather-tokens/4: one word that sets pace and signature together. */
export type Personality = "calm" | "precise" | "playful" | "cinematic"
/** feather-tokens/4: a colour-blocked section's surface and the ink that reads on it (4.5:1). Leave `ink` out and the
 * engine picks one that reads. */
export interface BlockPair {
  surface: string
  ink?: string
}

/** Brand tokens as Feather reads them: feather-tokens/4 or /3 (feather-tokens/2 and qooe-tokens/1 migrate on read). */
export interface BrandTokens {
  schema?: "feather-tokens/4" | "feather-tokens/3" | "feather-tokens/2" | "qooe-tokens/1"
  name?: string
  colors: BrandColors
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
  /** The product durations axis; in feather-tokens/4 it may instead be `{ personality }`, and product durations then
   * follow pace (cinematic runs product UI calm). */
  motion?: "calm" | "snappy" | { personality?: Personality }
  /** feather-tokens/4: the brand's default loudness (default 1); a block's data-loudness overrides it. */
  loudness?: Loudness
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

/** A brand's colours: four required roles, the optional named roles (accent, border, destructive, success, warning,
 * info, their *Text inks, primaryText, mutedForeground), and in feather-tokens/4 the colour blocks and the media scrim. */
export type BrandColors = { primary: string; background: string; surface: string; text: string } & {
  /** feather-tokens/4: up to four colour blocks (block-1..block-4); the rest derive from the palette. */
  blocks?: BlockPair[]
  /** feather-tokens/4: the media scrim's colour (default the inverse surface); the engine solves its opacity. */
  mediaScrim?: string
  /** feather-tokens/4: the ink on the media scrim (4.5:1 over a white and a black frame). */
  inkOnMedia?: string
} & Record<string, string | BlockPair[] | undefined>

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
      summary: { shape: string; density: string; elevation: string; motion: string; display: string; body: string; pace?: string; signature?: string; contrast?: string; surface?: string; focus?: string; loudness?: Loudness; personality?: Personality }
    }
  | { ok: false; problems: string[] }

/** The emphasis colors the engine derived (hex), for tests and audits. */
export interface DerivedEmphasis {
  textPrimary: string
  textSecondary: string
  textTertiary: string
  borderPrimary: string
}

export type MigrationTarget = "feather-tokens/3" | "feather-tokens/4"
export type MigrationResult = { ok: true; tokens: BrandTokens & { schema: MigrationTarget }; from: string } | { ok: false; problems: string[] }

/** What an older document migrates to on read, and what `feather-brand --migrate` stamps by default. */
export const TOKEN_SCHEMA: "feather-tokens/3"
/** The newest schema; a document moves to it only on request. */
export const LATEST_SCHEMA: "feather-tokens/4"
export const KNOWN_SCHEMAS: readonly string[]
export const MIGRATION_TARGETS: readonly MigrationTarget[]
/** Older documents become /3, a /3 or /4 one stays as it is; `to` moves it up (never down). */
export function migrateTokens(input: unknown, options?: { to?: MigrationTarget }): MigrationResult

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
/** feather-tokens/4: the display face's class, which sets the measured display and heading defaults. */
export type FaceClass = "grotesk" | "serif" | "mono" | "rounded"
export const FACE_CLASSES: readonly FaceClass[]
export const FOUNDATION_FACE_CLASSES: Record<string, FaceClass>
/** The heading and display weight a /4 brand that sets neither headingWeight nor contrast gets, by face class. */
export const FACE_WEIGHTS: Record<FaceClass, 400 | 500 | 600>
export function faceClass(value: FontSlot | undefined): FaceClass
/** The measured display scale for a face class (feather-tokens/4 defaults; measured, Qooler file 28). */
export function measuredDisplay(cls: FaceClass): Record<"xl" | "l" | "m" | "s", { size: { min: number; max: number }; tracking: { min: number; max: number }; leading: number }>
export function fluidClamp(min: number, max: number, viewport?: [number, number]): string
export function fluidTracking(size: { min: number; max: number }, tracking: { min: number; max: number }, viewport?: [number, number]): string

// ── feather-tokens/4: the range layer (src/range.mjs) ──
export const LOUDNESS: readonly Loudness[]
export const DEFAULT_LOUDNESS: Loudness
export const BLOCK_COUNT: number
export const BLOCK_FLOOR: number
export const MEDIA_FLOOR: number
/** The media scrim's opacity search: from `start`, by `step`, up to `max`. */
export const MEDIA_SCRIM: { start: number; step: number; max: number }
/** House constants in foundation.css (the same in every brand): --layer-* and --opacity-*. */
export const LAYERS: Record<"base" | "raised" | "sticky" | "overlay" | "modal" | "toast" | "cursor", number>
export const OPACITY: Record<"dim" | "muted" | "disabled", number>
export const PERSONALITIES: Record<Personality, { pace: "calm" | "snappy" | "cinematic"; signature: SignatureName; overshoot?: boolean }>
