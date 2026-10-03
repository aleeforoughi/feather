import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/cn"

const alertVariants = cva(
  "group/alert relative grid w-full gap-element rounded-card border border-line-secondary inset-content text-left type-body-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:*:data-[slot=alert-title]:pr-12 has-data-[slot=alert-action]:*:data-[slot=alert-description]:pr-12 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-icon-slot",
  {
    variants: {
      variant: {
        default: "bg-card text-fg-primary",
        destructive: "border-destructive bg-card text-fg-primary *:[svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-region="content"
      data-variant={variant ?? "default"}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "type-label group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-fg-primary",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "type-body-sm text-balance text-fg-secondary md:text-pretty [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-fg-primary [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
