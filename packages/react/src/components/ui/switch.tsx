import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "../../lib/cn"

// The track is 40 x 24px (32 x 20px small) with a 16px (12px) thumb inside 4px of padding, so the thumb travels a whole
// step. The hit area reaches 44 x 44px through the ::after of `hit-area`.
function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch hit-area inline-flex shrink-0 items-center rounded-full p-1 motion-switch aria-invalid:bg-destructive data-[size=default]:h-6 data-[size=default]:w-10 data-[size=sm]:h-5 data-[size=sm]:w-8 data-checked:bg-primary data-unchecked:bg-line-primary data-disabled:cursor-not-allowed data-disabled:opacity-disabled",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-surface-base motion-switch group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-4 group-data-[size=sm]/switch:data-checked:translate-x-3 data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
