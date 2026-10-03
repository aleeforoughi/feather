"use client"

import * as React from "react"
import { motion } from "motion/react"
import { CheckIcon } from "lucide-react"
import { cn } from "../../lib/cn"

import { useThemeMotion } from "../../lib/motion"
import { Button } from "./button"
import { Icon } from "./icon"
import { Input } from "./input"
import { Label } from "./label"
import { Tradeoff } from "./tradeoff"

/** What kind of value an Alternative asks for when chosen (IR `input`). */
type AlternativeInput = "Price" | "Date" | "Text" | "Location" | "Person"

/** The value a chosen Alternative carries: `{ amount, currency }`, an ISO 8601 date, or words. */
type AlternativeValue = { amount: number; currency: string } | string

type AlternativeItem = {
  id: string
  intent: string
  label?: string
  input?: AlternativeInput
  tradeoff?: { gains?: string[]; costs?: string[]; summary?: string }
  /** Default currency for a Price input. */
  currency?: string
}

type AlternativeListProps = {
  alternatives: AlternativeItem[]
  onAct: (id: string, act: "choose", value?: AlternativeValue) => void
  className?: string
}

const DEFAULT_CURRENCY = "USD"

/** Currency codes are three letters (ISO 4217); returns the upper-cased code, or null. */
function normalizeCurrency(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : null
}

/** An ISO 8601 calendar date (YYYY-MM-DD) that exists, e.g. not 2026-02-30. */
function isIsoDate(raw: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

/**
 * Checks what the person typed and encodes it as the IR reply value, or returns null while it is not valid.
 * Price gives `{ amount, currency }` (a finite number of 0 or more, and a three-letter currency); Date gives
 * an ISO 8601 string; Text, Location and Person give a trimmed, non-empty string.
 */
function encodeAlternativeValue(kind: AlternativeInput, raw: string, currency: string = DEFAULT_CURRENCY): AlternativeValue | null {
  const text = raw.trim()
  if (text === "") return null
  switch (kind) {
    case "Price": {
      if (!/^\d+(\.\d+)?$/.test(text)) return null
      const code = normalizeCurrency(currency)
      const amount = Number(text)
      return code && Number.isFinite(amount) ? { amount, currency: code } : null
    }
    case "Date":
      return isIsoDate(text) ? text : null
    default:
      return text
  }
}

/** The label a person sees for an alternative: its label, else its intent. */
function alternativeLabel(alt: Pick<AlternativeItem, "label" | "intent">): string {
  return alt.label?.trim() || alt.intent
}

const FIELD_LABEL: Record<AlternativeInput, string> = {
  Price: "Price",
  Date: "Date",
  Text: "Your answer",
  Location: "Location",
  Person: "Person",
}

/**
 * Other ways to go, in order. Each is a button; its tradeoff sits under it. An alternative with an `input`
 * opens an inline labelled field when chosen, and "Use this" submits it once the value is valid. Escape
 * cancels. The chosen one reflects `data-variant="chosen"`.
 */
function AlternativeList({ alternatives, onAct, className }: AlternativeListProps) {
  const [chosen, setChosen] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [announcement, setAnnouncement] = React.useState("")
  const buttons = React.useRef(new Map<string, HTMLButtonElement | null>())
  const refocus = React.useRef<string | null>(null)

  React.useEffect(() => {
    // After the field closes, focus goes back to the alternative's button: the control it came from.
    if (editing === null && refocus.current) {
      buttons.current.get(refocus.current)?.focus()
      refocus.current = null
    }
  }, [editing])

  function choose(alt: AlternativeItem) {
    if (alt.input) {
      setEditing(alt.id)
      return
    }
    setChosen(alt.id)
    setAnnouncement(`Chosen: ${alternativeLabel(alt)}`)
    onAct(alt.id, "choose")
  }

  function submit(alt: AlternativeItem, value: AlternativeValue) {
    refocus.current = alt.id
    setEditing(null)
    setChosen(alt.id)
    setAnnouncement(`Chosen: ${alternativeLabel(alt)}`)
    onAct(alt.id, "choose", value)
  }

  function cancel(alt: AlternativeItem) {
    refocus.current = alt.id
    setEditing(null)
    setAnnouncement(`Cancelled: ${alternativeLabel(alt)}`)
  }

  return (
    <div data-slot="alternative-list" data-variant={chosen ? "chosen" : "open"} className={cn("flex flex-col gap-3", className)}>
      <ul data-slot="alternative-list-items" className="flex flex-col gap-3">
        {alternatives.map((alt) => (
          <AlternativeRow
            key={alt.id}
            alt={alt}
            state={chosen === alt.id ? "chosen" : editing === alt.id ? "editing" : "idle"}
            buttonRef={(el) => void buttons.current.set(alt.id, el)}
            onChoose={() => choose(alt)}
            onSubmit={(value) => submit(alt, value)}
            onCancel={() => cancel(alt)}
          />
        ))}
      </ul>
      <p role="status" aria-live="polite" data-slot="alternative-list-status" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}

function AlternativeRow({
  alt,
  state,
  buttonRef,
  onChoose,
  onSubmit,
  onCancel,
}: {
  alt: AlternativeItem
  state: "idle" | "editing" | "chosen"
  buttonRef: (el: HTMLButtonElement | null) => void
  onChoose: () => void
  onSubmit: (value: AlternativeValue) => void
  onCancel: () => void
}) {
  const uid = React.useId()
  const label = alternativeLabel(alt)
  const hasTradeoff = Boolean(alt.tradeoff && ((alt.tradeoff.gains?.length ?? 0) > 0 || (alt.tradeoff.costs?.length ?? 0) > 0 || alt.tradeoff.summary))
  const tradeoffId = `${uid}-tradeoff`
  const formId = `${uid}-form`
  return (
    <li
      data-slot="alternative-list-item"
      data-variant={state}
      className="flex flex-col gap-2 rounded-card border border-line-secondary p-3 motion-state data-[variant=chosen]:border-primary"
    >
      <div data-slot="alternative-list-row" className="flex flex-wrap items-center gap-2">
        <Button
          ref={buttonRef}
          type="button"
          variant={state === "chosen" ? "default" : "outline"}
          data-slot="alternative-list-button"
          data-variant={state}
          aria-describedby={hasTradeoff ? tradeoffId : undefined}
          aria-expanded={alt.input ? state === "editing" : undefined}
          aria-controls={alt.input && state === "editing" ? formId : undefined}
          onClick={onChoose}
          className="h-auto! min-h-(--control-height) max-w-full whitespace-normal py-1 text-left"
        >
          {state === "chosen" && <Icon icon={CheckIcon} aria-hidden="true" />}
          {label}
        </Button>
        {state === "chosen" && (
          <span data-slot="alternative-list-chosen" className="type-label text-fg-secondary">
            Chosen
          </span>
        )}
      </div>
      {hasTradeoff && <Tradeoff id={tradeoffId} {...alt.tradeoff} />}
      {alt.input && state === "editing" && <AlternativeField key="field" id={formId} alt={alt} label={label} onSubmit={onSubmit} onCancel={onCancel} />}
    </li>
  )
}

function AlternativeField({
  id,
  alt,
  label,
  onSubmit,
  onCancel,
}: {
  id: string
  alt: AlternativeItem
  label: string
  onSubmit: (value: AlternativeValue) => void
  onCancel: () => void
}) {
  const m = useThemeMotion()
  const kind = alt.input!
  const uid = React.useId()
  const [raw, setRaw] = React.useState("")
  const [currency, setCurrency] = React.useState(alt.currency ?? DEFAULT_CURRENCY)
  const valueRef = React.useRef<HTMLInputElement>(null)
  const value = encodeAlternativeValue(kind, raw, currency)

  React.useEffect(() => {
    // The person just chose this alternative, so moving into its field is the sensible next control.
    valueRef.current?.focus()
  }, [])

  return (
    <motion.form
      id={id}
      data-slot="alternative-list-field"
      data-variant={kind.toLowerCase()}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: m.duration, ease: m.ease }}
      noValidate
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (value !== null) onSubmit(value)
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <div data-slot="alternative-list-field-group" className="flex min-w-32 flex-1 flex-col gap-2">
        <Label htmlFor={`${uid}-value`}>
          {FIELD_LABEL[kind]} for {label}
        </Label>
        <Input
          ref={valueRef}
          id={`${uid}-value`}
          data-slot="alternative-list-input"
          type={kind === "Price" ? "number" : kind === "Date" ? "date" : "text"}
          inputMode={kind === "Price" ? "decimal" : undefined}
          min={kind === "Price" ? 0 : undefined}
          step={kind === "Price" ? "any" : undefined}
          autoComplete="off"
          aria-describedby={`${uid}-hint`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </div>
      {kind === "Price" && (
        <div data-slot="alternative-list-currency-group" className="flex w-24 flex-col gap-2">
          <Label htmlFor={`${uid}-currency`}>Currency</Label>
          <Input
            id={`${uid}-currency`}
            data-slot="alternative-list-currency"
            type="text"
            maxLength={3}
            autoComplete="off"
            aria-invalid={normalizeCurrency(currency) === null || undefined}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
        </div>
      )}
      <Button type="submit" data-slot="alternative-list-submit" disabled={value === null}>
        Use this
      </Button>
      <p data-slot="alternative-list-hint" className="sr-only" id={`${uid}-hint`}>
        Press Escape to cancel.
      </p>
    </motion.form>
  )
}

export { AlternativeList, encodeAlternativeValue, alternativeLabel, isIsoDate, normalizeCurrency }
export type { AlternativeItem, AlternativeInput, AlternativeListProps, AlternativeValue }
