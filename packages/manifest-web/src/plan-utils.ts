// Reading a layout plan: the pure helpers come from @aleeforoughi/feather-dialog; what is DOM-specific lives here.
import { childrenOf, experienceCurrency, experienceOf, irNodes, nodeIndex, planNodes } from "@aleeforoughi/feather-dialog"

export { childrenOf, experienceCurrency, experienceOf, irNodes, nodeIndex, planNodes }

const FOCUSABLE = 'button, input:not([type="hidden"]), textarea, select, a[href], summary, [role="radio"], [role="checkbox"], [role="switch"], [tabindex]:not([tabindex="-1"])'

/**
 * The first control inside an element a person can reach: enabled, and not hidden. In a group of radios it is the one
 * that is checked, as the group's tab stop is, else the first. (A radio's own tabindex is settled after the first
 * render, so it is not relied on.)
 */
export function firstControl(root: Element): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (el.hasAttribute("disabled") || el.closest("[hidden]") || el.getAttribute("aria-hidden") === "true") continue
    if (el.getAttribute("role") === "radio") {
      const group = el.closest('[role="radiogroup"]')
      return group?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? el
    }
    return el
  }
  return null
}
