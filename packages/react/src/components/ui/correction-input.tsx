"use client"

import * as React from "react"
import { cn } from "../../lib/cn"

import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"

type CorrectionInputProps = {
  intent: string
  /** The question; it is the field's label. */
  prompt: string
  /** What was understood, in words. */
  original?: string
  onAct: (act: "submit", value: string) => void
  className?: string
}

/** What a correction sends: the text without surrounding space, or null while it is blank. */
function correctionValue(raw: string): string | null {
  const text = raw.trim()
  return text === "" ? null : text
}

/**
 * The person corrects something that was understood wrong. It shows what was understood and a labelled text
 * field. Submit is disabled while the field is blank; Enter in the field submits. After submitting the field
 * clears and focus stays in it, ready for another.
 */
function CorrectionInput({ intent, prompt, original, onAct, className }: CorrectionInputProps) {
  const uid = React.useId()
  const [raw, setRaw] = React.useState("")
  const [announcement, setAnnouncement] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const value = correctionValue(raw)
  const originalId = `${uid}-original`

  return (
    <form
      data-slot="correction-input"
      data-variant={value === null ? "blank" : "ready"}
      data-intent={intent}
      noValidate
      className={cn("flex flex-col gap-2 type-body-sm", className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (value === null) return
        onAct("submit", value)
        setRaw("")
        setAnnouncement(`Correction sent: ${value}`)
        inputRef.current?.focus()
      }}
    >
      {original && (
        <p id={originalId} data-slot="correction-input-original" className="break-words text-fg-secondary">
          Understood as: <span data-slot="correction-input-original-text" className="font-medium text-fg-primary">{original}</span>
        </p>
      )}
      <Label htmlFor={`${uid}-field`}>
        {prompt}
      </Label>
      <div data-slot="correction-input-row" className="flex flex-wrap items-center gap-2">
        <Input
          ref={inputRef}
          id={`${uid}-field`}
          data-slot="correction-input-field"
          type="text"
          autoComplete="off"
          aria-describedby={original ? originalId : undefined}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="min-w-32 flex-1"
        />
        <Button type="submit" data-slot="correction-input-submit" disabled={value === null}>
          Submit correction
        </Button>
      </div>
      <p role="status" aria-live="polite" data-slot="correction-input-status" className="sr-only">
        {announcement}
      </p>
    </form>
  )
}

export { CorrectionInput, correctionValue }
export type { CorrectionInputProps }
