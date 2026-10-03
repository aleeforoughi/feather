import { cn } from "../../lib/cn"

/** A placeholder block. It breathes calmly (the loading motion, 1600ms) and keeps the geometry of what it stands for. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("motion-loading rounded-xs bg-surface-hover", className)}
      {...props}
    />
  )
}

export { Skeleton }
