// The native controls the product-flow blocks are built from. A page block must work in full with no script, so
// every control here is the browser's own (a radio, a checkbox, a range, a field, a button) in the house's geometry
// and tokens, never a scripted widget with a role on a span: feather-react's Base UI radios, switches and sliders are
// spans until their script runs, which a static page cannot wait for. 48px rows, 20px marks, the focus ring on the
// control itself, the primary as the accent colour.
import * as React from "react"
import { join } from "./shared"

/** A radio or checkbox mark: 20px, the brand's primary, the ring on the mark. */
export const MARK = "size-5 shrink-0 accent-primary focus-ring"
/** A row that holds one choice: the whole row is the label, so the hit area is the row. Checked rows read raised. */
export const CHOICE_ROW =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-line-primary bg-surface-base px-4 py-3 type-body text-fg-primary motion-hover-out not-has-checked:hover:bg-surface-hover has-checked:border-fg-primary has-checked:bg-surface-raised"
/** A compact choice (a time slot): the same row, shorter words. */
export const CHOICE_PILL =
  "inline-flex min-h-12 min-w-12 cursor-pointer items-center gap-2 rounded-control border border-line-primary bg-surface-base px-4 type-label numeric text-fg-primary motion-hover-out not-has-checked:hover:bg-surface-hover has-checked:border-fg-primary has-checked:bg-surface-raised"
/** A text field: 48px, the control radius, the identifying border at 3:1. */
export const FIELD =
  "min-h-12 w-full rounded-control border border-line-primary bg-surface-base px-4 type-body text-fg-primary focus-ring aria-invalid:border-destructive"
export const FIELD_LABEL = "type-label text-fg-primary"
export const FIELD_HELP = "type-caption text-fg-secondary"
/** A slider: native, full width, 48px tall so its thumb is easy to reach. */
export const RANGE = "h-12 w-full cursor-pointer accent-primary focus-ring"

/** One choice in a radio group: a native radio and its words, the row being the label. */
export function Choice({ name, value, checked, onChange, children, hint, slot, pill = false, required }: { name: string; value: string; checked: boolean; onChange: (value: string) => void; children: React.ReactNode; hint?: React.ReactNode; slot: string; pill?: boolean; required?: boolean }) {
  return (
    <label data-slot={slot} className={pill ? CHOICE_PILL : CHOICE_ROW}>
      <input type="radio" data-slot={`${slot}-input`} name={name} value={value} checked={checked} required={required} onChange={() => onChange(value)} className={join(MARK, pill && "sr-only")} />
      <span data-slot={`${slot}-text`} className="flex min-w-0 flex-1 flex-col gap-1">
        <span data-slot={`${slot}-label`}>{children}</span>
        {hint ? (
          <span data-slot={`${slot}-hint`} className="type-caption text-fg-secondary">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: string
  /** Shown instead of the words (the words stay, visually hidden): a small inline SVG. */
  icon?: React.ReactNode
}

/**
 * A segmented control as a real radio group: a fieldset, its legend, and one native radio per segment. Arrow keys
 * move between segments as in any radio group; the checked segment is filled. Used by the view-mode switch and the
 * colour scheme toggle.
 */
export function Segmented<T extends string>({ legend, name, options, value, onChange, slot, hideLegend = false, className }: { legend: string; name: string; options: readonly SegmentOption<T>[]; value: T; onChange: (value: T) => void; slot: string; hideLegend?: boolean; className?: string }) {
  return (
    <fieldset data-slot={slot} className={join("flex min-w-0 items-center gap-3", className)}>
      <legend data-slot={`${slot}-legend`} className={hideLegend ? "sr-only" : "float-left me-3 type-label text-fg-secondary"}>
        {legend}
      </legend>
      <div data-slot={`${slot}-options`} className="inline-flex gap-1 rounded-control border border-line-primary bg-surface-base">
        {options.map((o) => (
          <label key={o.value} data-slot={`${slot}-option`} data-state={o.value === value ? "checked" : "unchecked"} className="relative inline-flex cursor-pointer">
            <input type="radio" data-slot={`${slot}-input`} name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} className="peer sr-only" />
            <span
              data-slot={`${slot}-segment`}
              className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-control px-3 type-label text-fg-primary motion-hover-out peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--ring) peer-not-checked:hover:bg-surface-hover"
            >
              {o.icon ? (
                <>
                  <span data-slot={`${slot}-icon`} aria-hidden="true" className="inline-flex size-4">
                    {o.icon}
                  </span>
                  <span data-slot={`${slot}-label`} className="sr-only">
                    {o.label}
                  </span>
                </>
              ) : (
                o.label
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Reads and writes one key of localStorage, never throwing (a private window, blocked storage). */
export const store = {
  get(key: string): string | null {
    try {
      return typeof localStorage === "undefined" ? null : localStorage.getItem(key)
    } catch {
      return null
    }
  },
  /** True when it was stored. */
  set(key: string, value: string | null): boolean {
    try {
      if (typeof localStorage === "undefined") return false
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
}

/** What was chosen this visit, for when storage is off (a private window): the choice still holds until the page goes. */
const memory = new Map<string, string | null>()
const listeners = new Map<string, Set<() => void>>()

/**
 * A remembered choice, as state: read from storage on the client's first render (or, when hydrating server markup,
 * right after it, before paint), `server` on the server. Writing it stores it and updates every reader of the key.
 */
export function useStored<T extends string>(key: string, server: T, parse: (saved: string | null) => T): [T, (v: string | null) => void] {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const set = listeners.get(key) ?? new Set()
      set.add(onChange)
      listeners.set(key, set)
      const onStorage = (e: StorageEvent) => e.key === key && onChange()
      window.addEventListener("storage", onStorage)
      return () => {
        set.delete(onChange)
        window.removeEventListener("storage", onStorage)
      }
    },
    [key]
  )
  const value = React.useSyncExternalStore(
    subscribe,
    () => parse(memory.has(key) ? (memory.get(key) ?? null) : store.get(key)),
    () => server
  )
  const write = React.useCallback(
    (v: string | null) => {
      // Storage is off: the choice holds for this visit only.
      if (store.set(key, v)) memory.delete(key)
      else memory.set(key, v)
      listeners.get(key)?.forEach((f) => f())
    },
    [key]
  )
  return [value, write]
}

/** Moves focus to an element after a step changes (never on the first render, so a page never jumps on load). */
export function useFocusOnChange(key: unknown): React.RefObject<HTMLElement | null> {
  const ref = React.useRef<HTMLElement | null>(null)
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    ref.current?.focus({ preventScroll: false })
  }, [key])
  return ref
}
