"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "../../lib/cn"
import { errorMotion, pressMotion } from "../../lib/micro"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-2", className)}
      {...props}
    />
  )
}

// A 20px circle, the same box as the checkbox, so a row of choices shares one geometry. The hit area reaches 44 x 44px.
// Micro-motion (section 10): the circle fills over `motion-toggle` and the dot grows from half its size as it appears.
function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "group/radio-group-item peer hit-area flex aspect-square size-5 shrink-0 rounded-full border border-line-primary motion-toggle disabled:cursor-not-allowed disabled:opacity-disabled aria-invalid:border-destructive aria-invalid:aria-checked:border-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        pressMotion,
        errorMotion,
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="group/radio-indicator flex size-4 items-center justify-center motion-state data-starting-style:opacity-0 data-ending-style:opacity-0"
      >
        <span
          data-slot="radio-group-dot"
          className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground motion-toggle group-data-starting-style/radio-indicator:scale-50"
        />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
