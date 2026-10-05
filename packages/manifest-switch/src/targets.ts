// Targets: the controls a person can scan to, found in the rendered DOM. The organisms add and remove controls as
// they arm and disarm, so the list is read afresh whenever it is needed, never cached.

const CONTROLS =
  'button, input:not([type="hidden"]), textarea, select, a[href], summary, [role="radio"], [role="checkbox"], [role="switch"], [contenteditable=""], [contenteditable="true"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [tabindex]:not([tabindex="-1"])'

function hiddenOrDisabled(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return true
  // A read-only field (a Form after it was sent) cannot be changed, so there is nothing to scan to.
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.readOnly) return true
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
  // A collapsed experience has no targets (docs/lifecycle.md section 2.5): the artifact link it leaves is for reading and
  // following by other means, and scanning stops.
  return Array.from(root.querySelectorAll<HTMLElement>(CONTROLS)).filter((el) => !hiddenOrDisabled(el))
}

/** What identifies a target across an update that remounts it: the plan node it is in, its slot, and its place among those. */
export interface TargetSignature {
  key: string
  nth: number
}

const keyOf = (el: HTMLElement) => `${el.closest("[data-feather-node]")?.getAttribute("data-feather-node") ?? ""}|${el.getAttribute("data-slot") ?? el.tagName}|${el.getAttribute("role") ?? ""}`

export function signatureOf(el: HTMLElement, targets: HTMLElement[]): TargetSignature {
  const key = keyOf(el)
  return { key, nth: targets.filter((t) => keyOf(t) === key).indexOf(el) }
}

/** The target with the same signature, if there is one (the same place among its kind, else the last of them). */
export function findBySignature(sig: TargetSignature, targets: HTMLElement[]): HTMLElement | undefined {
  const same = targets.filter((t) => keyOf(t) === sig.key)
  return same[Math.min(Math.max(sig.nth, 0), same.length - 1)]
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

const POPUP_ROLES = '[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]'

/**
 * Where the targets are: the open popup of a control in the experience, if there is one, else the experience itself.
 * A popup is open when a control in `host` has `aria-expanded="true"` with an `aria-controls` that names a visible
 * element, or when focus has moved into a menu, listbox or dialog outside `host` (a portal).
 */
export function scopeOf(host: HTMLElement): HTMLElement {
  const doc = host.ownerDocument
  for (const owner of Array.from(host.querySelectorAll<HTMLElement>('[aria-expanded="true"][aria-controls]'))) {
    for (const id of (owner.getAttribute("aria-controls") ?? "").split(/\s+/)) {
      const popup = id ? doc.getElementById(id) : null
      if (popup && !host.contains(popup) && !hiddenOrDisabled(popup)) return popup
    }
  }
  const inPopup = doc.activeElement?.closest<HTMLElement>(POPUP_ROLES)
  if (inPopup && !host.contains(inPopup)) return inPopup
  return host
}
