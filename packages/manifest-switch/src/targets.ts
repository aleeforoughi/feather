// Targets: the controls a person can scan to, found in the rendered DOM. The organisms add and remove controls as
// they arm and disarm, so the list is read afresh whenever it is needed, never cached.

const CONTROLS =
  'button, input:not([type="hidden"]), textarea, select, a[href], summary, [role="radio"], [role="checkbox"], [role="switch"], [contenteditable=""], [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

function hiddenOrDisabled(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return true
  if (el.closest("[hidden], [inert], [aria-hidden='true'], fieldset[disabled]")) return true
  const view = el.ownerDocument.defaultView
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const style = view?.getComputedStyle(node)
    if (style && (style.display === "none" || style.visibility === "hidden")) return true
  }
  return false
}

/** The enabled, visible controls inside `root`, in DOM order (which is the plan's order). */
export function targetsIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CONTROLS)).filter((el) => !hiddenOrDisabled(el))
}

/** The nearest target at or above `el`, if it is one of `targets`. */
export function targetAt(el: EventTarget | null, targets: HTMLElement[]): HTMLElement | undefined {
  if (!(el instanceof Element)) return undefined
  return targets.find((t) => t === el || t.contains(el))
}

/** A field where typing goes to the field: a text input, a textarea or a contenteditable. */
export function isTextEntry(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable || el.getAttribute("contenteditable") === "" || el.getAttribute("contenteditable") === "true") return true
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return !["button", "checkbox", "radio", "submit", "reset", "range", "color", "file", "image", "hidden"].includes(el.type)
  return false
}

/** The committing control of an armed irreversible act: the organisms' `*-confirm` slots. Dwell never selects it. */
export function isCommitting(el: Element): boolean {
  const slot = el.closest("[data-slot]")?.getAttribute("data-slot") ?? ""
  const own = el.getAttribute("data-slot") ?? slot
  return own === "confirm" || own.endsWith("-confirm")
}
