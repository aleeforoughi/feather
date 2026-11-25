import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "../../lib/cn"
import { errorMotion } from "../../lib/micro"

// A field in the control frame (docs/visual-system.md section 3): the density's height and padding, the control radius,
// the 1px primary border that identifies it, and the body type role. As aria-invalid arrives it shakes once (3px, on
// transform, section 10 "Micro-motion"), beside the colour and the message that carry the error.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-control w-full min-w-0 rounded-control border border-line-primary bg-transparent px-control type-body text-fg-primary motion-state file:inline-flex file:h-6 file:border-0 file:bg-transparent file:type-label file:text-fg-primary placeholder:text-fg-tertiary disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-line-disabled disabled:bg-surface-disabled disabled:text-fg-disabled disabled:placeholder:text-fg-disabled aria-invalid:border-destructive",
        errorMotion,
        className
      )}
      {...props}
    />
  )
}

export { Input }
