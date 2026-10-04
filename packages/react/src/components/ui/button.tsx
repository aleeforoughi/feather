import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/cn"

// The control frame (docs/visual-system.md section 3): the height, padding, icon slot and gap come from the density.
// A pinned size sets data-density on the button itself, so its own frame resolves onto tight (xs, sm) or spacious (lg).
// An icon-only size is the square of the same height. The hit area reaches 44 x 44px through an invisible ::after.
const buttonVariants = cva(
  "group/button hit-area inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-transparent bg-clip-padding type-label whitespace-nowrap motion-hover select-none not-disabled:active:not-aria-[haspopup]:press disabled:cursor-not-allowed disabled:opacity-disabled aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon-slot",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground not-disabled:hover:bg-primary/80",
        outline:
          "border-line-primary bg-surface-base text-fg-primary not-disabled:hover:bg-surface-hover aria-expanded:bg-surface-hover",
        secondary:
          "bg-secondary text-secondary-foreground not-disabled:hover:bg-surface-pressed aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-fg-primary not-disabled:hover:bg-surface-hover aria-expanded:bg-surface-hover",
        destructive:
          "bg-destructive-muted text-destructive not-disabled:hover:bg-destructive-muted-hover",
        link: "text-primary underline-offset-4 not-disabled:hover:underline",
      },
      size: {
        default: "h-control px-control",
        xs: "h-control px-control",
        sm: "h-control px-control",
        lg: "h-control px-control",
        icon: "size-control p-0",
        "icon-xs": "size-control p-0",
        "icon-sm": "size-control p-0",
        "icon-lg": "size-control p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * The semantic density a size pins: xs and sm are tight, lg is spacious, and `icon` is the default 44px square (the visual audit's
 * SIZE_HEIGHT pins it there). `default` follows the surrounding density.
 */
const SIZE_DENSITY: Record<string, "tight" | "default" | "spacious" | undefined> = {
  xs: "tight",
  sm: "tight",
  lg: "spacious",
  "icon-xs": "tight",
  "icon-sm": "tight",
  "icon-lg": "spacious",
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      data-density={SIZE_DENSITY[size ?? "default"]}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
