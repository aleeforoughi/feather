// Context as the composer sees it: whatever the host passed, nothing invented. Missing fields stay missing; each
// rule names its default in the trace when it falls back to one.
import type { CapabilityProfile, PersonaSlice, RenderContext } from "@aleeforoughi/feather-context"

/** Reference contexts: one experience composed in each shows how Feather adapts (tests, playground, docs). */
export const REFERENCE_CONTEXTS: Record<"phone" | "desktop-detailed" | "low-vision-low-precision" | "screenless", { title: string; context: RenderContext }> = {
  phone: {
    title: "Phone, defaults",
    context: { device: { surface: "phone", width: 390 } },
  },
  "desktop-detailed": {
    title: "Desktop, wants the reasoning",
    context: { device: { surface: "desktop", width: 1280 }, persona: { explanation: "detailed", density: "compact", inputMode: "keyboard" } },
  },
  "low-vision-low-precision": {
    title: "Low vision, low motor precision, reduced motion",
    context: { device: { surface: "tablet", width: 820, reducedMotion: true }, capability: { vision: "low", precision: "low" }, persona: { explanation: "brief" } },
  },
  screenless: {
    title: "No screen: voice only",
    context: { device: { surface: "speaker" }, capability: { output: { visual: "unavailable", audio: "available" }, input: { voice: true } } },
  },
}

export type ReferenceContextName = keyof typeof REFERENCE_CONTEXTS

/** Reference personas (L5): how a person likes to work. Each changes the plan in a way test/personas.test.ts measures. */
export const REFERENCE_PERSONAS: Record<"delegator" | "deliberate" | "touch-first" | "calm" | "switch-preferred", { title: string; persona: PersonaSlice; changes: string }> = {
  delegator: {
    title: "Delegates, wants it brief",
    persona: { autonomy: "delegate", explanation: "brief", density: "compact", inputMode: "keyboard" },
    changes: "other ways to go fold behind one disclosure; detail stays closed; compact density",
  },
  deliberate: {
    title: "Picks for themselves, wants the reasoning",
    persona: { autonomy: "ask", explanation: "detailed" },
    changes: "a prediction shows as a note and nothing is preselected; detail shows open",
  },
  "touch-first": {
    title: "Prefers touch, even at a desk",
    persona: { inputMode: "touch" },
    changes: "targets of at least 44 px on a desktop",
  },
  calm: {
    title: "Less motion, more room",
    persona: { motion: "reduced", density: "spacious" },
    changes: "reduced motion; spacious density",
  },
  "switch-preferred": {
    title: "Prefers switch access",
    persona: { inputMode: "switch" },
    changes: "the switch manifestation: scanning order and dwell",
  },
}

export type ReferencePersonaName = keyof typeof REFERENCE_PERSONAS

/** Reference capability profiles (L5): what a person can perceive and do, now. Interaction needs, never diagnoses
 * (principle 7). Each changes the plan in a way test/personas.test.ts measures. */
export const REFERENCE_CAPABILITIES: Record<
  "low-vision" | "low-precision" | "no-screen-speaking" | "no-screen-typing" | "plain-reading" | "hands-busy",
  { title: string; capability: CapabilityProfile; changes: string }
> = {
  "low-vision": { title: "Low vision", capability: { vision: "low" }, changes: "WCAG AAA contrast" },
  "low-precision": { title: "Low motor precision, touch only", capability: { precision: "low", input: { touch: true, pointer: false } }, changes: "targets of at least 44 px; spacious density" },
  "no-screen-speaking": { title: "No screen; hears and speaks", capability: { output: { visual: "unavailable" } }, changes: "the voice manifestation; irreversible acts confirmed by a spoken keyword" },
  "no-screen-typing": {
    title: "No screen; hears, does not speak",
    capability: { output: { visual: "unavailable" }, input: { voice: false, keyboard: true } },
    changes: "the text manifestation, read aloud by a screen reader; irreversible acts confirmed by a typed keyword",
  },
  "plain-reading": { title: "Plain reading", capability: { reading: "plain" }, changes: "detail stays closed; other ways to go fold behind one disclosure" },
  "hands-busy": { title: "Hands busy, for now", capability: { temporary: { handsBusy: true } }, changes: "the voice manifestation while it holds" },
}

export type ReferenceCapabilityName = keyof typeof REFERENCE_CAPABILITIES
