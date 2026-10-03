import * as React from "react"
import { cn } from "../../lib/cn"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 type-label text-fg-primary select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-disabled peer-disabled:cursor-not-allowed peer-disabled:opacity-disabled",
        className
      )}
      {...props}
    />
  )
}

export { Label }
