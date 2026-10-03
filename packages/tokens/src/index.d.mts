/** Brand tokens as Feather reads them: feather-tokens/2 (or qooe-tokens/1, which migrates on read). */
export interface BrandTokens {
  schema?: "feather-tokens/2" | "qooe-tokens/1"
  name?: string
  colors: { primary: string; background: string; surface: string; text: string } & Record<string, string>
  typography: { fontFamily: { display?: string; body?: string }; headingWeight?: 400 | 500 | 600 | 700; scale?: Record<string, string> }
  spacing?: Record<string, string>
  radius?: Record<string, string>
  shape?: "sharp" | "soft" | "rounded" | "pill"
  density?: "compact" | "comfortable" | "spacious"
  elevation?: "flat" | "soft" | "dramatic"
  motion?: "calm" | "snappy"
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
  | { ok: true; css: string; fonts: string; derived: DerivedEmphasis; summary: { shape: string; density: string; elevation: string; motion: string; display: string; body: string } }
  | { ok: false; problems: string[] }

/** The emphasis colors the engine derived (hex), for tests and audits. */
export interface DerivedEmphasis {
  textPrimary: string
  textSecondary: string
  textTertiary: string
  borderPrimary: string
}

export type MigrationResult = { ok: true; tokens: BrandTokens & { schema: "feather-tokens/2" }; from: string } | { ok: false; problems: string[] }

export const TOKEN_SCHEMA: "feather-tokens/2"
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
export const RADIUS_TIERS: Record<"sharp" | "soft" | "rounded" | "pill", Record<RadiusTier, string>>
export const RADIUS_PRIMITIVES: Record<"0" | "4" | "8" | "12" | "16" | "full", string>
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
export const CONTRAST_FLOORS: { textPrimary: number; textSecondary: number; textTertiary: number; icon: number; borderPrimary: number; onTint: number }
