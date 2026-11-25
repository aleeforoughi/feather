// The feather-react parts a page loads only when a visitor needs them, as one lazy chunk: the gallery's Lightbox (on
// the first open) and the form's Select and RadioGroup (after hydration, over the native controls the server wrote).
// Keeping them off the page's first load keeps Base UI's dialog, popup and composite code out of the runtime.
import { Lightbox, RadioGroup, RadioGroupItem, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, FieldLabel } from "@aleeforoughi/feather-react"

export { Lightbox }

export interface PartSelectProps {
  id: string
  name: string
  required?: boolean
  placeholder: string
  options: string[]
  className: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

/** feather-react's Select, sending `name` as the native select did. */
export function PartSelect({ id, name, required, placeholder, options, className, ...aria }: PartSelectProps) {
  return (
    <Select name={name} required={required} items={options.map((o) => ({ value: o, label: o }))}>
      <SelectTrigger id={id} className={className} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export interface PartChoiceProps {
  id: string
  name: string
  label: string
  required?: boolean
  options: string[]
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

/** feather-react's RadioGroup, each option labelled, sending `name` as the native radios did. */
export function PartChoice({ id, name, label, required, options, ...aria }: PartChoiceProps) {
  return (
    <RadioGroup name={name} aria-label={label} required={required} className="flex flex-col gap-1" {...aria}>
      {options.map((o, i) => (
        <div key={o} data-slot="form-choice" className="flex min-h-12 items-center gap-3">
          <RadioGroupItem value={o} id={`${id}-${i}`} />
          <FieldLabel htmlFor={`${id}-${i}`} className="type-body">
            {o}
          </FieldLabel>
        </div>
      ))}
    </RadioGroup>
  )
}
