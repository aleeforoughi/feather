import * as React from "react"
import { cn } from "../../lib/cn"

// A multi-line field: the same border, radius, type role and states as Input, with the control padding.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-control border border-line-primary bg-transparent px-control py-control type-body text-fg-primary motion-state placeholder:text-fg-tertiary disabled:cursor-not-allowed disabled:border-line-disabled disabled:bg-surface-disabled disabled:text-fg-disabled disabled:placeholder:text-fg-disabled aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
