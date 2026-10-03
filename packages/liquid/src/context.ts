// Context as the composer sees it: whatever the host passed, nothing invented. Missing fields stay missing; each
// rule names its default in the trace when it falls back to one.
import type { RenderContext } from "@aleeforoughi/feather-context"

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
