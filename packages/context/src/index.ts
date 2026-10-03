// @aleeforoughi/feather-context: who Feather renders for, and where.
//
// A host passes these per render (principle 11: Feather stores nothing about people). They describe what a person
// can do and prefers, never a diagnosis (principle 7). Every field is optional; the composer fills documented
// defaults and says so in its trace. Types only: the module emits no runtime code.

export type Density = "compact" | "comfortable" | "spacious"

/** How this person likes to work: explicit user settings, or preferences the host learned. */
export interface PersonaSlice {
  /** How much fits on screen. */
  density?: Density
  /** How much reasoning to show: brief collapses "Why?", detailed opens it. */
  explanation?: "brief" | "standard" | "detailed"
  /** Motion the person asked for. A request to reduce always wins; "full" never overrides a reduce from elsewhere. */
  motion?: "full" | "reduced"
  /** How the person prefers to act. */
  inputMode?: "pointer" | "touch" | "keyboard" | "voice" | "switch"
  /** Where these preferences come from: "explicit" settings outrank "learned" ones (principle 8). Default explicit. */
  source?: "explicit" | "learned"
}

/** What the person can perceive and do, right now. Interaction needs, never diagnoses. */
export interface CapabilityProfile {
  /** Ways the person can give input. */
  input?: { pointer?: boolean; touch?: boolean; keyboard?: boolean; voice?: boolean; switch?: boolean }
  /** Ways the person can take in output. */
  output?: { visual?: "available" | "unavailable"; audio?: "available" | "unavailable" }
  /** "low" asks for stronger contrast (AAA). */
  vision?: "typical" | "low"
  /** Motor precision: "low" asks for targets of at least 44 px, and spacing to match. */
  precision?: "typical" | "low"
}

/** The surface the experience appears on. */
export interface DeviceContext {
  surface?: "phone" | "tablet" | "desktop" | "watch" | "speaker" | "terminal"
  /** Viewport width in CSS pixels. */
  width?: number
  /** The operating system asks for reduced motion (prefers-reduced-motion). */
  reducedMotion?: boolean
  colorScheme?: "light" | "dark"
}

/** The brand's theme axes that bear on composition (from its feather-tokens/2 file). */
export interface BrandAxes {
  density?: Density
  motion?: "calm" | "snappy"
}

/** Everything the composer may consider besides the experience itself. */
export interface RenderContext {
  persona?: PersonaSlice
  capability?: CapabilityProfile
  device?: DeviceContext
  /** BCP 47 locale for formatting; defaults to the experience's locale, then "en". */
  locale?: string
  brand?: BrandAxes
}
