/** Brand tokens as Feather reads them: feather-tokens/2 (or qooe-tokens/1, which migrates on read). */
export interface BrandTokens {
  schema?: "feather-tokens/2" | "qooe-tokens/1"
  name?: string
  colors: { primary: string; background: string; surface: string; text: string } & Record<string, string>
  typography: { fontFamily: { display?: string; body?: string }; headingWeight?: number; scale?: Record<string, string> }
  spacing?: Record<string, string>
  radius?: Record<string, string>
  shape?: keyof typeof SHAPES
  density?: keyof typeof DENSITY
  elevation?: keyof typeof ELEVATION
  motion?: keyof typeof MOTION
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
  | { ok: true; css: string; fonts: string; summary: { shape: string; density: string; elevation: string; motion: string; display: string; body: string } }
  | { ok: false; problems: string[] }

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

export const SHAPES: { sharp: string; soft: string; rounded: string; pill: string }
export const DENSITY: { compact: string; comfortable: string; spacious: string }
export const ELEVATION: Record<"flat" | "soft" | "dramatic", Record<"xs" | "sm" | "md" | "lg" | "xl", string>>
export const MOTION: { calm: [string, string]; snappy: [string, string] }
