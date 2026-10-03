"use client"

import * as React from "react"
import { SparklesIcon } from "lucide-react"
import { cn } from "../../lib/cn"

import { Badge } from "./badge"
import { Button } from "./button"
import { Icon } from "./icon"
import { Label } from "./label"
import { RadioGroup, RadioGroupItem } from "./radio-group"
import { confidenceText } from "./recommendation"

type PredictedChoiceOption = { id: string; label: string; description?: string }

type PredictedChoiceProps = {
  intent: string
  /** The question; it labels the radio group. */
  prompt: React.ReactNode
  options: PredictedChoiceOption[]
  predicted: {
    /** The predicted option's id. */
    option: string
    /** Why, in one line. */
    summary?: string
    /** 0 to 1. */
    confidence?: number
  }
  onAct: (act: "accept" | "change", option?: string) => void
  className?: string
}

/** The act and the words on the button for the option that is selected now. */
function predictedAction(selected: string, predicted: string, label: string): { act: "accept" | "change"; text: string } {
  return selected === predicted ? { act: "accept", text: `Keep ${label}` } : { act: "change", text: `Use ${label}` }
}

/**
 * A choice with the likely option preselected and marked "Likely", with the reason. "Keep {label}" accepts the
 * prediction; picking another option turns the button into "Use {label}", which changes to it.
 */
function PredictedChoice({ intent, prompt, options, predicted, onAct, className }: PredictedChoiceProps) {
  const uid = React.useId()
  const [selected, setSelected] = React.useState(predicted.option)
  const [announcement, setAnnouncement] = React.useState("")
  const current = options.find((o) => o.id === selected) ?? options.find((o) => o.id === predicted.option) ?? options[0]
  if (!current) return null
  const action = predictedAction(current.id, predicted.option, current.label)
  const promptId = `${uid}-prompt`
  const summaryId = `${uid}-summary`

  return (
    <div
      data-slot="predicted-choice"
      data-variant={current.id === predicted.option ? "predicted" : "changed"}
      data-intent={intent}
      className={cn("flex flex-col gap-3 type-body-sm", className)}
    >
      <p id={promptId} data-slot="predicted-choice-prompt" className="type-label text-fg-primary">
        {prompt}
      </p>
      <RadioGroup
        aria-labelledby={promptId}
        value={selected}
        onValueChange={(value) => {
          const next = options.find((o) => o.id === value)
          setSelected(String(value))
          if (next) setAnnouncement(predictedAction(next.id, predicted.option, next.label).text)
        }}
      >
        {options.map((option) => {
          const isPredicted = option.id === predicted.option
          const inputId = `${uid}-${option.id}`
          const descriptionId = `${inputId}-description`
          const detail = isPredicted ? [predicted.summary, predicted.confidence !== undefined ? confidenceText(predicted.confidence) : undefined].filter(Boolean).join(" · ") : ""
          const describedBy = [option.description ? descriptionId : "", detail ? summaryId : ""].filter(Boolean).join(" ") || undefined
          return (
            <div
              key={option.id}
              data-slot="predicted-choice-option"
              data-variant={isPredicted ? "likely" : "other"}
              data-state={option.id === selected ? "selected" : "unselected"}
              className="flex items-start gap-2 rounded-card border border-line-secondary p-3 motion-state data-[state=selected]:border-primary"
            >
              <RadioGroupItem value={option.id} id={inputId} aria-describedby={describedBy} />
              <div data-slot="predicted-choice-body" className="flex min-w-0 flex-1 flex-col gap-1">
                <Label htmlFor={inputId} className="flex-wrap">
                  <span data-slot="predicted-choice-label" className="min-w-0 break-words">{option.label}</span>
                  {isPredicted && (
                    <Badge variant="secondary" data-slot="predicted-choice-likely">
                      <Icon icon={SparklesIcon} size={16} aria-hidden="true" data-icon="inline-start" />
                      Likely
                    </Badge>
                  )}
                </Label>
                {option.description && (
                  <p id={descriptionId} data-slot="predicted-choice-description" className="break-words text-fg-secondary">
                    {option.description}
                  </p>
                )}
                {detail && (
                  <p id={summaryId} data-slot="predicted-choice-summary" className="break-words text-fg-secondary">
                    {detail}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </RadioGroup>
      <div>
        <Button
          type="button"
          data-slot="predicted-choice-action"
          data-variant={action.act}
          className="h-auto! min-h-(--control-height) max-w-full whitespace-normal py-1"
          onClick={() => (action.act === "accept" ? onAct("accept") : onAct("change", current.id))}
        >
          {action.text}
        </Button>
      </div>
      <p role="status" aria-live="polite" data-slot="predicted-choice-status" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}

export { PredictedChoice, predictedAction }
export type { PredictedChoiceOption, PredictedChoiceProps }
