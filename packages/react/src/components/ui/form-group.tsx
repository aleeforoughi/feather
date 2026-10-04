"use client"

import * as React from "react"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import { cn } from "../../lib/cn"

import { Button } from "./button"
import { Icon } from "./icon"
import { Input } from "./input"
import { Label } from "./label"
import { Textarea } from "./textarea"
import { WhyDisclosure, type Expandable } from "./why-disclosure"

/** What a field asks for. The names mirror the IR's Input kinds. */
export type FormGroupKind = "text" | "long-text" | "number" | "email" | "phone" | "url" | "date" | "money"

/** One question, as the IR's FormField states it. */
export interface FormGroupField {
  id: string
  prompt: string
  kind: FormGroupKind
  required?: boolean
  value?: string | number
  min?: number
  max?: number
  maxLength?: number
  currency?: string
  /** A heading the field sits under; consecutive fields with the same group are shown together. */
  group?: string
}

/** An answer, encoded as an Input of the same kind encodes it: a string, or a number for number and money. */
export type FormGroupAnswer = string | number

/** What the caller may report back about an act: when it refused the reply, the form stays open and says why. */
export type FormGroupActResult = void | { ok: true } | { ok: false; message: string }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE = /^\+?[0-9 ()./-]{3,32}$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i
/** The longest text answer the IR accepts. */
const MAX_TEXT = 4000

const chars = (s: string) => Array.from(s).length
const upperFirst = (s: string) => (s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s)

/** Whether `value` is an ISO 8601 date or date-time that names a real day (the IR's rule, ported). */
function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] ?? "0", m[5] ?? "0", m[6] ?? "0"].map(Number) as [number, number, number, number, number, number]
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return false
  const day = new Date(0)
  day.setUTCFullYear(y, mo - 1, d)
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return false
  const zone = m[7]
  if (zone && zone !== "Z") {
    const [oh, om] = zone.slice(1).split(":").map(Number) as [number, number]
    if (oh > 23 || om > 59) return false
  }
  return true
}

function isUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

/** The outcome of checking one field: its answer (undefined when left empty), or why it is not acceptable. */
export type FieldCheck = { ok: true; value: FormGroupAnswer | undefined } | { ok: false; message: string }

/**
 * Checks what was typed into one field the way the IR checks an Input's answer: text is trimmed, an empty optional
 * field is left out (never sent as ""), numbers are parsed, dates are ISO 8601 strings. `badInput` says the browser
 * held text it could not read as a number.
 */
export function checkFormField(field: FormGroupField, raw: string, badInput = false): FieldCheck {
  const text = raw.trim()
  const numeric = field.kind === "number" || field.kind === "money"
  if (text === "" && !(numeric && badInput)) return field.required === true ? { ok: false, message: "This is required." } : { ok: true, value: undefined }
  if (numeric) {
    const value = Number(text)
    if (badInput || !DECIMAL.test(text) || !Number.isFinite(value)) return { ok: false, message: "Enter a number." }
    if (field.min !== undefined && value < field.min) return { ok: false, message: `Enter ${field.min} or more.` }
    if (field.max !== undefined && value > field.max) return { ok: false, message: `Enter ${field.max} or less.` }
    return { ok: true, value }
  }
  if (field.kind === "date") return isIsoDate(text) ? { ok: true, value: text } : { ok: false, message: "Enter a date, like 2026-03-14." }
  const length = chars(text)
  if (length > MAX_TEXT) return { ok: false, message: `Use ${MAX_TEXT.toLocaleString("en")} characters or fewer.` }
  if (field.maxLength !== undefined && length > field.maxLength) return { ok: false, message: `Use ${field.maxLength} characters or fewer (now ${length}).` }
  if (field.kind === "email" && !EMAIL.test(text)) return { ok: false, message: "Enter an email address, like name@example.com." }
  if (field.kind === "phone" && !PHONE.test(text)) return { ok: false, message: "Enter a phone number, like +971 4 123 4567." }
  if (field.kind === "url" && !isUrl(text)) return { ok: false, message: "Enter a web address, like https://example.com." }
  return { ok: true, value: text }
}

export interface FormCheck {
  /** Field id to answer, for the fields that were answered, in field order. */
  answers: Record<string, FormGroupAnswer>
  /** Field id to the problem, for the fields that cannot be sent. */
  problems: Record<string, string>
  /** The first field with a problem, in order. */
  firstInvalid?: string
  /** Nothing is wrong with any field, but none was answered. */
  empty: boolean
}

/** Checks every field of a form. Nothing may be sent unless `problems` is empty and `empty` is false. */
export function checkForm(fields: FormGroupField[], raws: Record<string, string>, badInput: ReadonlySet<string> = new Set()): FormCheck {
  const answers: Record<string, FormGroupAnswer> = {}
  const problems: Record<string, string> = {}
  let firstInvalid: string | undefined
  for (const field of fields) {
    const result = checkFormField(field, raws[field.id] ?? "", badInput.has(field.id))
    if (!result.ok) {
      problems[field.id] = result.message
      firstInvalid ??= field.id
    } else if (result.value !== undefined) answers[field.id] = result.value
  }
  return { answers, problems, firstInvalid, empty: firstInvalid === undefined && Object.keys(answers).length === 0 }
}

/** The fields in runs: consecutive fields with the same group share a run; a field with no group starts or joins an ungrouped run. */
export function formSections(fields: FormGroupField[]): Array<{ group?: string; fields: FormGroupField[] }> {
  const runs: Array<{ group?: string; fields: FormGroupField[] }> = []
  for (const field of fields) {
    const last = runs[runs.length - 1]
    if (last && last.group === field.group) last.fields.push(field)
    else runs.push({ group: field.group, fields: [field] })
  }
  return runs
}

const AUTOCOMPLETE_BY_ID: Array<[RegExp, string]> = [
  [/^(full[-_ ]?)?name$/i, "name"],
  [/^(first[-_ ]?name|given[-_ ]?name)$/i, "given-name"],
  [/^(last[-_ ]?name|family[-_ ]?name|surname)$/i, "family-name"],
  [/^(street|address|street[-_ ]?address|address[-_ ]?line1)$/i, "street-address"],
  [/^(city|town)$/i, "address-level2"],
  [/^(state|region|province)$/i, "address-level1"],
  [/^(postcode|post[-_ ]?code|postal[-_ ]?code|zip|zip[-_ ]?code)$/i, "postal-code"],
  [/^country$/i, "country-name"],
  [/^(organi[sz]ation|company)$/i, "organization"],
]

/** The `autocomplete` token for a field: by kind for email, phone and url; by a well-known id for text; otherwise off. */
export function autocompleteFor(field: Pick<FormGroupField, "id" | "kind">): string {
  if (field.kind === "email") return "email"
  if (field.kind === "phone") return "tel"
  if (field.kind === "url") return "url"
  if (field.kind === "text") return AUTOCOMPLETE_BY_ID.find(([pattern]) => pattern.test(field.id))?.[1] ?? "off"
  return "off"
}

const INPUT_TYPE: Record<Exclude<FormGroupKind, "long-text">, string> = { text: "text", number: "number", email: "email", phone: "tel", url: "url", date: "date", money: "number" }

/** What the field accepts, in words: its currency, its range, its length. */
export function fieldHint(field: FormGroupField): string {
  const parts: string[] = []
  if (field.kind === "money" && field.currency) parts.push(`Amount in ${field.currency}.`)
  if (field.kind === "number" || field.kind === "money") {
    if (field.min !== undefined && field.max !== undefined) parts.push(`Between ${field.min} and ${field.max}.`)
    else if (field.min !== undefined) parts.push(`${field.min} or more.`)
    else if (field.max !== undefined) parts.push(`${field.max} or less.`)
  } else if (field.maxLength !== undefined) parts.push(`Up to ${field.maxLength} characters.`)
  return parts.join(" ")
}

/** The words that say what the form did: how many answers were sent, or what stopped it. */
export function formStatusText(state: "sent" | "skipped" | "invalid" | "empty", count = 0): string {
  switch (state) {
    case "sent":
      return `Sent. ${count} ${count === 1 ? "answer was" : "answers were"} sent.`
    case "skipped":
      return "Skipped. No answers were sent."
    case "invalid":
      return `Not sent. ${count === 1 ? "One answer needs" : `${count} answers need`} fixing.`
    case "empty":
      return "Not sent. Answer at least one question."
  }
}

type Phase = "editing" | "sent" | "skipped"

/**
 * Several questions asked together and sent with one act (IR node Form). It is one real form: one submit button, and a
 * secondary Skip only when no field is required. Submitting checks every field the way the IR checks an Input's answer,
 * shows each problem beside its field and moves focus to the first, and calls `onAct` only when every answer is valid
 * and at least one field is answered. Empty optional fields are left out of the answer. After a successful submit the
 * values stay visible, read-only, with a status message: what was sent is never in doubt, and a second act is not
 * offered. The caller renders a new node to start over.
 */
function FormGroup({
  id,
  intent,
  prompt,
  fields,
  submitLabel,
  importance = "normal",
  expandable,
  primary,
  defaultExpanded = false,
  onAct,
  className,
}: {
  /** The node's id, kept on the root as `data-node-id`. */
  id?: string
  intent: string
  /** What the answers are for, in one line; the form's heading. */
  prompt?: string
  fields: FormGroupField[]
  /** The words for the one act that sends every answer; defaults to the intent. */
  submitLabel?: string
  importance?: "low" | "normal" | "high" | "critical"
  expandable?: Expandable
  primary?: boolean
  /** Whether "Why?" starts open (a layout plan's `expanded`). Acting closes it. */
  defaultExpanded?: boolean
  /** `submit` carries an object from field id to answer; `skip` carries nothing. May report that the reply was refused. */
  onAct: (act: "submit" | "skip", value?: Record<string, FormGroupAnswer>) => FormGroupActResult
  className?: string
}) {
  const uid = React.useId()
  const [values, setValues] = React.useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.id, f.value === undefined ? "" : String(f.value)])))
  const [problems, setProblems] = React.useState<Record<string, string>>({})
  const [phase, setPhase] = React.useState<Phase>("editing")
  const [status, setStatus] = React.useState<{ kind: "sent" | "skipped" | "invalid" | "empty" | "refused"; text: string }>()
  const [whyOpen, setWhyOpen] = React.useState(defaultExpanded)
  const controls = React.useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>())
  const statusRef = React.useRef<HTMLParagraphElement>(null)
  const acted = React.useRef(false)
  const focusStatus = React.useRef(false)
  const locked = phase !== "editing"
  const required = fields.some((f) => f.required === true)
  const sections = formSections(fields)
  const promptId = `${uid}-prompt`
  const act = upperFirst(submitLabel ?? intent)
  const headingLevel = prompt ? "h4" : "h3"
  const Heading = headingLevel

  React.useEffect(() => {
    if (!focusStatus.current) return
    focusStatus.current = false
    statusRef.current?.focus()
  })

  // What the act reported: when the caller refused the reply, the form stays open and says so.
  const finish = (result: FormGroupActResult, done: "sent" | "skipped", count: number) => {
    if (result && result.ok === false) {
      acted.current = false
      setStatus({ kind: "refused", text: `Not sent. ${result.message}` })
      return
    }
    setWhyOpen(false)
    setPhase(done)
    setStatus({ kind: done, text: formStatusText(done, count) })
    focusStatus.current = true
  }

  const submit = () => {
    if (acted.current) return
    const badInput = new Set<string>()
    for (const f of fields) {
      const el = controls.current.get(f.id)
      if ((f.kind === "number" || f.kind === "money") && el instanceof HTMLInputElement && el.validity.badInput) badInput.add(f.id)
    }
    const check = checkForm(fields, values, badInput)
    setProblems(check.problems)
    if (check.firstInvalid !== undefined) {
      const count = Object.keys(check.problems).length
      setStatus({ kind: "invalid", text: formStatusText("invalid", count) })
      controls.current.get(check.firstInvalid)?.focus()
      return
    }
    if (check.empty) {
      setStatus({ kind: "empty", text: formStatusText("empty") })
      controls.current.get(fields[0]?.id ?? "")?.focus()
      return
    }
    acted.current = true
    finish(onAct("submit", check.answers), "sent", Object.keys(check.answers).length)
  }
  const skip = () => {
    if (acted.current) return
    acted.current = true
    finish(onAct("skip"), "skipped", 0)
  }

  const variant = phase === "editing" ? "default" : phase
  const statusKind = status?.kind
  return (
    <form
      data-slot="form-group"
      data-variant={variant}
      data-importance={importance}
      data-primary={primary ? "true" : undefined}
      data-node-id={id}
      noValidate
      aria-labelledby={prompt ? promptId : undefined}
      aria-label={prompt ? undefined : upperFirst(intent)}
      className={cn("flex flex-col overflow-hidden rounded-card border border-line-secondary bg-card type-body-sm text-fg-primary", className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (locked) return
        submit()
      }}
    >
      {prompt && (
        <div data-slot="form-group-header" data-region="header" className="min-w-0 inset-header">
          <h3 id={promptId} data-slot="form-group-prompt" className="font-heading type-title text-fg-primary break-words">
            {prompt}
          </h3>
        </div>
      )}
      <div data-slot="form-group-content" data-region="content" className="flex min-w-0 flex-col gap-group inset-content">
        {sections.map((section, index) => {
          const sectionId = `${uid}-section-${index}`
          const body = section.fields.map((field) => {
            const fieldId = `${uid}-${field.id}`
            const markerId = `${fieldId}-marker`
            const hintId = `${fieldId}-hint`
            const errorId = `${fieldId}-error`
            const problem = problems[field.id]
            const hint = fieldHint(field)
            const numeric = field.kind === "number" || field.kind === "money"
            const describedBy = [markerId, hint ? hintId : "", problem ? errorId : ""].filter(Boolean).join(" ")
            const common = {
              id: fieldId,
              "data-slot": "form-group-control",
              name: field.id,
              value: values[field.id] ?? "",
              required: field.required === true,
              readOnly: locked,
              "aria-required": field.required === true || undefined,
              "aria-readonly": locked || undefined,
              "aria-invalid": problem ? true : undefined,
              "aria-describedby": describedBy,
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const next = e.target.value
                setValues((v) => ({ ...v, [field.id]: next }))
                // What was wrong is cleared as soon as the person works on it; the next submit checks again.
                if (problems[field.id]) setProblems((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== field.id)))
              },
              className: "read-only:bg-surface-subtle",
            }
            const register = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
              if (el) controls.current.set(field.id, el)
              else controls.current.delete(field.id)
            }
            return (
              <div
                key={field.id}
                data-slot="form-group-field"
                data-field-id={field.id}
                data-kind={field.kind}
                data-variant={problem ? "invalid" : "default"}
                className="flex min-w-0 flex-col gap-label"
              >
                <div data-slot="form-group-label-row" className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <Label htmlFor={fieldId} data-slot="form-group-label" className="break-words">{field.prompt}</Label>
                  <span id={markerId} data-slot="form-group-marker" className="type-caption text-fg-secondary">
                    {field.required === true ? "Required" : "Optional"}
                  </span>
                </div>
                <div data-slot="form-group-control-row" className="flex items-center gap-2">
                  {field.kind === "long-text" ? (
                    <Textarea {...common} ref={register} />
                  ) : (
                    <Input
                      {...common}
                      ref={register}
                      type={INPUT_TYPE[field.kind]}
                      inputMode={numeric ? "decimal" : undefined}
                      min={numeric ? field.min : undefined}
                      max={numeric ? field.max : undefined}
                      step={numeric ? "any" : undefined}
                      autoComplete={autocompleteFor(field)}
                    />
                  )}
                  {field.kind === "money" && field.currency && (
                    <span aria-hidden data-slot="form-group-currency" className="shrink-0 type-label text-fg-secondary">{field.currency}</span>
                  )}
                </div>
                {hint && <p id={hintId} data-slot="form-group-hint" className="text-fg-secondary">{hint}</p>}
                {problem && (
                  <p id={errorId} data-slot="form-group-error" className="flex items-start gap-2 type-body-sm font-medium text-fg-primary">
                    <span data-slot="form-group-error-icon" className="flex h-5 shrink-0 items-center">
                      <Icon icon={CircleAlertIcon} size={16} aria-hidden className="text-destructive" />
                    </span>
                    <span data-slot="form-group-error-text">
                      <span data-slot="form-group-error-prefix" className="sr-only">Error: </span>
                      {problem}
                    </span>
                  </p>
                )}
              </div>
            )
          })
          if (section.group === undefined) {
            return (
              <div key={`run-${index}`} data-slot="form-group-ungrouped" className="flex min-w-0 flex-col gap-field">
                {body}
              </div>
            )
          }
          return (
            <div key={`run-${index}`} data-slot="form-group-section" role="group" aria-labelledby={sectionId} data-group={section.group} className="flex min-w-0 flex-col gap-element">
              <Heading id={sectionId} data-slot="form-group-section-heading" className="font-heading type-label text-fg-primary break-words">
                {section.group}
              </Heading>
              <div data-slot="form-group-section-fields" className="flex min-w-0 flex-col gap-field">
                {body}
              </div>
            </div>
          )
        })}
      </div>
      <div data-slot="form-group-actions" data-region="action" className="flex flex-wrap items-center gap-action inset-action">
        {!locked && (
          <>
            <Button
              type="submit"
              data-slot="form-group-submit"
              variant={primary ? "default" : "outline"}
              className="h-auto! min-h-(--control-height) max-w-full py-1 whitespace-normal"
            >
              {act}
            </Button>
            {!required && (
              <Button
                type="button"
                data-slot="form-group-skip"
                variant={primary ? "outline" : "ghost"}
                onClick={skip}
              >
                Skip
              </Button>
            )}
          </>
        )}
        {expandable && !locked && <WhyDisclosure expandable={expandable} open={whyOpen} onOpenChange={setWhyOpen} forceOpen={importance === "critical"} className="basis-full" />}
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          data-slot="form-group-status"
          data-variant={statusKind ?? "idle"}
          className={cn("flex items-start gap-2 rounded-xs type-label text-fg-primary", status ? "basis-full" : "sr-only")}
        >
          {status && (
            <span data-slot="form-group-status-icon" className="flex h-5 shrink-0 items-center">
              {phase !== "editing" ? <Icon icon={CircleCheckIcon} size={16} aria-hidden /> : <Icon icon={CircleAlertIcon} size={16} aria-hidden className="text-destructive" />}
            </span>
          )}
          <span data-slot="form-group-status-text">{status?.text ?? ""}</span>
        </p>
      </div>
    </form>
  )
}

export { FormGroup }
