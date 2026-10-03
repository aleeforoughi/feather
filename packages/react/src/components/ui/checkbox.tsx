"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cn } from "../../lib/cn"
import { CheckIcon } from "lucide-react"
import { Icon } from "./icon"

// A 20px box (the check is a 16px icon inside its 1px border). The hit area reaches 44 x 44px through the ::after of
// `hit-area`, which nothing around the box may clip.
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer hit-area flex size-5 shrink-0 items-center justify-center rounded-xs border border-line-primary motion-state group-has-disabled/field:opacity-disabled disabled:cursor-not-allowed disabled:opacity-disabled aria-invalid:border-destructive aria-invalid:aria-checked:border-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <Icon icon={CheckIcon} size={16} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
