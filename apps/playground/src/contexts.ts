// The contexts the playground shows. The reference contexts come from the composer; the switch and terminal ones are
// the contexts docs/manifestations.md section 5 uses to reach those bodies.
import type { RenderContext } from "@aleeforoughi/feather-context"
import { REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"

export interface NamedContext {
  id: string
  title: string
  context: RenderContext
}

const phone = REFERENCE_CONTEXTS.phone
const screenless = REFERENCE_CONTEXTS.screenless
const desktop = REFERENCE_CONTEXTS["desktop-detailed"]
const lowVision = REFERENCE_CONTEXTS["low-vision-low-precision"]

/** What the "Four contexts" tab shows: one context for each body. */
export const FOUR_CONTEXTS: NamedContext[] = [
  { id: "phone", title: phone.title, context: phone.context },
  { id: "switch", title: "Switch access: two switches", context: { capability: { input: { switch: true } } } },
  { id: "screenless", title: screenless.title, context: screenless.context },
  { id: "terminal", title: "Terminal", context: { device: { surface: "terminal" } } },
]

/** What the Rendered tab can show besides the controls on the left. */
export const PRESET_CONTEXTS: NamedContext[] = [
  ...FOUR_CONTEXTS,
  { id: "desktop", title: desktop.title, context: desktop.context },
  { id: "low-vision", title: lowVision.title, context: lowVision.context },
]
