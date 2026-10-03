import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/cn"

// A chip: a pill (the pill-semantic part, so `rounded-full`) 24px tall with the caption role. A badge that is a link reaches 44 x 44px
// through `hit-area`. The icon sits in a 16px slot, 8px from the label.
const badgeVariants = cva(
  "group/badge [a]:hit-area inline-flex h-6 w-fit shrink-0 items-center justify-center gap-2 rounded-full border border-transparent px-3 type-caption font-medium whitespace-nowrap motion-hover has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-surface-pressed",
        destructive:
          "bg-destructive/10 text-destructive [a]:hover:bg-destructive/20",
        outline:
          "border-line-primary text-fg-primary [a]:hover:bg-surface-hover",
        ghost:
          "text-fg-primary hover:bg-surface-hover",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
