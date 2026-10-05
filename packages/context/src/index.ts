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
  /** How much the person hands over: "ask" picks for themselves (a prediction shows as a note, nothing preselected),
   * "suggest" takes the caller's prediction preselected (the default), "delegate" keeps only the recommended way in
   * view and folds the other options behind one disclosure. Never touches an irreversible or critical node. */
  autonomy?: "ask" | "suggest" | "delegate"
  /** The fields above the host learned rather than the person set. Explicit settings outrank learned ones
   * (principle 8); a field not listed here is explicit. */
  learned?: Array<"density" | "explanation" | "motion" | "inputMode" | "autonomy">
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
  /** Reading: "plain" asks for less to read at once: detail stays behind "Why?" and other options fold away. */
  reading?: "typical" | "plain"
  /** What holds for now and passes: eyes on the road, hands full, a loud room. Each is an interaction need, as
   * binding as a lasting one while it holds. */
  temporary?: {
    /** The person cannot look at a screen: the experience is spoken when audio is available. */
    eyesBusy?: boolean
    /** The person cannot use their hands: the experience is spoken when they can speak and hear. */
    handsBusy?: boolean
    /** Sound cannot be relied on: every audio cue is also text, and speech is not chosen for busy eyes or hands. */
    noisy?: boolean
  }
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
