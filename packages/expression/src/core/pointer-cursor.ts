// Cursor states: elements opt in with data-cursor="view|drag|play|link" and an optional data-cursor-label. One
// delegated listener pair per document tells the follower which state to show. Fields never take a state.
import { POINTER_FIELDS } from "./pointer"

export type CursorKind = "view" | "drag" | "play" | "link"
export const CURSOR_LABELS: Record<CursorKind, string> = { view: "View", drag: "Drag", play: "Play", link: "" }
const isKind = (v: string | undefined): v is CursorKind => v === "view" || v === "drag" || v === "play" || v === "link"

/** The state for an event target: its nearest data-cursor, or null (a field, or nothing opted in). */
export function cursorFor(target: EventTarget | null): { kind: CursorKind; label: string } | null {
  if (!(target instanceof Element)) return null
  if (target.closest(POINTER_FIELDS)) return null
  const host = target.closest<HTMLElement>("[data-cursor]")
  const kind = host?.dataset.cursor
  if (!host || !isKind(kind)) return null
  return { kind, label: host.dataset.cursorLabel ?? CURSOR_LABELS[kind] }
}

/** Drives `follower` (state in data-cursor) and `label` (the text node holder) from the page. Returns the cleanup. */
export function cursorStates(follower: HTMLElement, label: HTMLElement): () => void {
  const clear = () => {
    delete follower.dataset.cursor
    label.textContent = ""
  }
  const over = (e: Event) => {
    const hit = cursorFor(e.target)
    if (!hit) return clear()
    follower.dataset.cursor = hit.kind
    label.textContent = hit.label
  }
  document.addEventListener("pointerover", over)
  document.addEventListener("pointerleave", clear)
  return () => {
    document.removeEventListener("pointerover", over)
    document.removeEventListener("pointerleave", clear)
    clear()
  }
}
