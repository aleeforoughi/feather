import * as React from "react"
import { Section } from "@aleeforoughi/feather-expression"
import type { FormField, FormVariant } from "../core/types"
import { useHydrated } from "./hydration"
import { KnobBody, KnobTitle, alignClass, useKnobs } from "./knobs"
import { BUTTON_PRIMARY, BUTTON_QUIET, join, useRegion, type BlockProps } from "./shared"

// The browser's own controls in the house's geometry and tokens: the minimal underline (the field is its baseline, at
// the control's height), the body type role, the tertiary placeholder, the focus ring on the control and the
// destructive line while it is invalid. Native controls work with no script, on every device, with its own keyboard
// and its own pickers, and they keep feather-react off a page's first load.
const UNDERLINE =
  "block w-full min-w-0 rounded-none border-0 border-b border-line-primary bg-transparent type-body text-fg-primary placeholder:text-fg-tertiary motion-state focus-ring aria-invalid:border-destructive"
const INPUT = `${UNDERLINE} h-control`
const TEXTAREA = `${UNDERLINE} field-sizing-content min-h-24 py-3`
const SELECT = `${UNDERLINE} h-control cursor-pointer appearance-none pe-8`
const RADIO = "size-5 shrink-0 cursor-pointer accent-primary focus-ring"
const LABEL = "type-label text-fg-primary"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEL = /^[+()\d\s.-]{6,}$/

/** What is wrong with one answer, in words (or null). The same rules the browser's own checks follow, said plainly. */
export function fieldProblem(field: FormField, raw: FormDataEntryValue | null): string | null {
  const value = typeof raw === "string" ? raw.trim() : ""
  const type = field.type ?? "text"
  const label = field.label.replace(/[.:?]+$/, "")
  if (!value) return field.required ? (type === "select" || type === "choice" ? `Choose ${label.toLowerCase()}.` : `Fill in ${label.toLowerCase()}.`) : null
  if (type === "email" && !EMAIL.test(value)) return "That email address looks incomplete: it needs an @ and a domain."
  if (type === "tel" && !TEL.test(value)) return "That number has letters in it, or is too short."
  if (type === "url") {
    try {
      const u = new URL(value)
      if (!/^https?:$/.test(u.protocol)) throw new Error("protocol")
    } catch {
      return "That link needs to start with https://"
    }
  }
  if (type === "number") {
    const n = Number(value)
    if (!Number.isFinite(n)) return "That needs to be a number."
    if (field.max !== undefined && n > field.max) return `At most ${field.max}.`
  } else if (field.max !== undefined && value.length > field.max) return `At most ${field.max} characters (this is ${value.length}).`
  return null
}

interface ControlProps {
  field: FormField
  id: string
  error?: string
}

/** The chevron of a select: decoration, drawn over the native control's end. */
function Chevron() {
  return (
    <svg data-slot="form-select-chevron" aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2 text-fg-secondary" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

/** One field: its label, its native control, its hint and its message (in words, announced as it appears). */
function Control({ field, id, error }: ControlProps) {
  const type = field.type ?? "text"
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [field.hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined
  const common = { "aria-invalid": error ? true : undefined, "aria-describedby": describedBy }
  const label = (
    <>
      {field.label}
      {field.required ? null : (
        <span data-slot="form-optional" className="ms-2 type-caption text-fg-secondary">
          (optional)
        </span>
      )}
    </>
  )
  const hint = field.hint ? (
    <p id={hintId} data-slot="form-hint" className="type-body-sm text-fg-secondary">
      {field.hint}
    </p>
  ) : null
  const message = error ? (
    <p id={errorId} role="alert" data-slot="form-error" className="type-body-sm text-destructive">
      {error}
    </p>
  ) : null

  if (type === "choice") {
    return (
      <fieldset data-slot="form-field" data-variant="choice" data-invalid={error ? true : undefined} aria-describedby={describedBy} className="flex flex-col gap-2">
        <legend data-slot="form-label" className={join(LABEL, "mb-2")}>
          {label}
        </legend>
        {hint}
        <div data-slot="form-choices" className="flex flex-col">
          {(field.options ?? []).map((o, i) => (
            <div key={o} data-slot="form-choice" className="flex min-h-12 items-center gap-3">
              <input type="radio" data-slot="form-radio" id={`${id}-${i}`} name={field.name} value={o} required={field.required} aria-invalid={error ? true : undefined} className={RADIO} />
              <label htmlFor={`${id}-${i}`} data-slot="form-choice-label" className="cursor-pointer type-body text-fg-primary">
                {o}
              </label>
            </div>
          ))}
        </div>
        {message}
      </fieldset>
    )
  }

  let control: React.ReactNode
  if (type === "textarea") {
    control = <textarea id={id} data-slot="form-textarea" name={field.name} required={field.required} maxLength={field.max} placeholder={field.placeholder} autoComplete={field.autocomplete} rows={4} className={TEXTAREA} {...common} />
  } else if (type === "select") {
    control = (
      <div data-slot="form-select" className="relative">
        <select id={id} data-slot="form-select-control" name={field.name} required={field.required} defaultValue="" autoComplete={field.autocomplete} className={SELECT} {...common}>
          <option value="" disabled={field.required}>
            {field.placeholder ?? "Choose one"}
          </option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <Chevron />
      </div>
    )
  } else {
    const t = type as "text" | "email" | "tel" | "url" | "number"
    const length = t === "number" ? (field.max !== undefined ? { max: field.max } : {}) : field.max !== undefined ? { maxLength: field.max } : {}
    control = <input id={id} data-slot="form-input" name={field.name} type={t} required={field.required} placeholder={field.placeholder} autoComplete={field.autocomplete} inputMode={t === "number" ? "decimal" : undefined} className={INPUT} {...length} {...common} />
  }
  return (
    <div data-slot="form-field" data-variant={type} data-invalid={error ? true : undefined} className="flex flex-col gap-2">
      <label htmlFor={id} data-slot="form-label" className={LABEL}>
        {label}
      </label>
      {control}
      {hint}
      {message}
    </div>
  )
}

/**
 * A short form that works with no script: a real `<form>` that posts to `action` (an http(s) URL or a path), or, for a
 * `mailto:` action, opens the visitor's mail with the answers (text/plain). Every field is the browser's own control
 * (input, textarea, select, a radio group in a fieldset) in the house's underline style and tokens. With script the browser's own bubbles give way to messages in words beside each field,
 * announced as they appear, and a summary of what needs a look; focus goes to the first. Variants (feather.page/1):
 * - underline (the default): the whole form, each field a minimal baseline;
 * - conversational: one question at a time, with its place ("2 of 4") announced, Back and Next, and the send on the
 *   last; Enter moves on. With no script it is the whole form.
 */
export function FormBlock({ block }: BlockProps<"form">) {
  const { id, titleId, labelled } = useRegion(block, "Form")
  const knobs = useKnobs<FormVariant>("form", block, { space: "l" })
  const hydrated = useHydrated()
  const form = React.useRef<HTMLFormElement>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [status, setStatus] = React.useState("")
  const [step, setStep] = React.useState(0)
  const fields = block.fields
  const conversational = knobs.variant === "conversational" && fields.length > 1
  const last = fields.length - 1
  const base = block.id ?? titleId.replace(/-title$/, "")
  const fieldId = (f: FormField) => `${base}-${f.name}`
  const mailto = block.action.trim().toLowerCase().startsWith("mailto:")

  const check = (list: FormField[]) => {
    const data = form.current ? new FormData(form.current) : new FormData()
    const found: Record<string, string> = {}
    for (const f of list) {
      const problem = fieldProblem(f, data.get(f.name))
      if (problem) found[f.name] = problem
    }
    return found
  }
  const focusField = (f: FormField) => {
    // Field names and ids are slugs, so they are safe in a selector as they are.
    const el = form.current?.querySelector<HTMLElement>(`#${fieldId(f)}, [id^="${fieldId(f)}-"]`)
    el?.focus()
  }
  const goTo = (next: number) => {
    setStep(next)
    setStatus(`Question ${next + 1} of ${fields.length}`)
    afterCommit(() => focusField(fields[next]))
  }
  const next = () => {
    const found = check([fields[step]])
    setErrors((e) => ({ ...withoutKey(e, fields[step].name), ...found }))
    if (Object.keys(found).length) return focusField(fields[step])
    goTo(Math.min(last, step + 1))
  }
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (conversational && step < last) {
      event.preventDefault()
      return next()
    }
    const found = check(fields)
    setErrors(found)
    const wrong = fields.filter((f) => found[f.name])
    if (wrong.length === 0) {
      setStatus("Sending…")
      return
    }
    event.preventDefault()
    setStatus(`${wrong.length === 1 ? "One answer needs" : `${wrong.length} answers need`} a look: ${wrong.map((f) => f.label.replace(/[.:?]+$/, "")).join(", ")}.`)
    if (conversational) {
      const at = fields.indexOf(wrong[0])
      setStep(at)
      afterCommit(() => focusField(wrong[0]))
    } else focusField(wrong[0])
  }

  const centre = knobs.align === "center"
  return (
    <Section id={id} data-block="form" {...labelled} {...knobs.section}>
      {block.title ? (
        <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
          {block.title}
        </KnobTitle>
      ) : null}
      <KnobBody knobs={knobs}>
        <div data-slot="form-box" className={alignClass(knobs.align === "split" ? "start" : knobs.align, "col-span-full flex max-w-2xl flex-col gap-8")}>
          {block.body ? (
            <p data-slot="form-body" className={join("max-w-prose type-body-lg text-prose text-fg-secondary", centre && "mx-auto")}>
              {block.body}
            </p>
          ) : null}
          <form
            ref={form}
            data-slot="form"
            data-variant={knobs.variant}
            action={block.action}
            method="post"
            {...(mailto ? { encType: "text/plain" } : {})}
            noValidate={hydrated}
            onSubmit={onSubmit}
            aria-labelledby={block.title ? titleId : undefined}
            aria-label={block.title ? undefined : "Form"}
            className="flex w-full flex-col gap-8 text-start"
          >
            {conversational ? (
              <div data-slot="form-progress" className="flex flex-col gap-3 noscript:hidden">
                <p data-slot="form-progress-label" className="type-caps numeric text-fg-secondary">
                  {`${step + 1} of ${fields.length}`}
                </p>
                <div data-slot="form-progress-track" aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-surface-subtle">
                  <div data-slot="form-progress-bar" className="h-full origin-left rounded-full bg-primary motion-state" style={{ scale: `${(step + 1) / fields.length} 1` }} />
                </div>
              </div>
            ) : null}
            {fields.map((f, i) => (
              <div
                key={f.name}
                data-slot="form-step"
                data-state={!conversational || i === step ? "active" : "idle"}
                hidden={conversational && hydrated && i !== step ? true : undefined}
                className={conversational ? "scripting:not-data-[state=active]:hidden" : undefined}
              >
                <Control field={f} id={fieldId(f)} error={errors[f.name]} />
              </div>
            ))}
            <p data-slot="form-status" role="status" aria-live="polite" className="type-body-sm text-fg-secondary">
              {status}
            </p>
            <div data-slot="form-actions" className="flex flex-wrap items-center gap-3">
              {conversational ? (
                <>
                  <button type="button" data-slot="form-back" className={join(BUTTON_QUIET, "noscript:hidden")} disabled={step === 0} onClick={() => goTo(Math.max(0, step - 1))}>
                    Back
                  </button>
                  {step < last ? (
                    <button type="button" data-slot="form-next" className={join(BUTTON_PRIMARY, "noscript:hidden")} onClick={next}>
                      Next
                    </button>
                  ) : null}
                </>
              ) : null}
              <button type="submit" data-slot="form-submit" className={join(BUTTON_PRIMARY, conversational && step < last && "scripting:hidden")}>
                {block.submit ?? (mailto ? "Write the email" : "Send")}
              </button>
            </div>
            {block.note ? (
              <p data-slot="form-note" className="type-caption text-fg-secondary">
                {block.note}
              </p>
            ) : null}
          </form>
        </div>
      </KnobBody>
    </Section>
  )
}

const withoutKey = (o: Record<string, string>, key: string) => {
  const { [key]: _drop, ...rest } = o
  void _drop
  return rest
}

/** After React has committed the step (the next field is in the document), in the next task. */
const afterCommit = (fn: () => void) => setTimeout(fn, 0)
