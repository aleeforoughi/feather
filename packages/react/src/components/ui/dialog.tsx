import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "../../lib/cn"

import { Button } from "./button"
import { XIcon } from "lucide-react"

import { Icon } from "./icon"
import { usePortalContainer } from "../../lib/portal-container"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  const container = usePortalContainer()
  return <DialogPrimitive.Portal data-slot="dialog-portal" container={container} {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "motion-dialog fixed inset-0 isolate z-50 bg-scrim opacity-100 supports-backdrop-filter:backdrop-blur-xs data-starting-style:opacity-0 data-ending-style:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "motion-dialog fixed inset-4 z-50 m-auto grid h-fit max-h-[calc(100dvh-var(--spacing)*8)] w-auto overflow-y-auto translate-y-0 scale-100 rounded-dialog border border-line-secondary bg-surface-overlay type-body-sm text-fg-primary opacity-100 shadow-3 outline-none sm:max-w-sm data-starting-style:translate-y-4 data-starting-style:scale-[0.985] data-starting-style:opacity-0 data-ending-style:translate-y-4 data-ending-style:scale-[0.985] data-ending-style:opacity-0",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-4 right-4"
                size="icon"
              />
            }
          >
            <Icon icon={XIcon} />
            <span data-slot="dialog-close-label" className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      data-region="header"
      className={cn("flex flex-col gap-element inset-header", className)}
      {...props}
    />
  )
}

/** The dialog's body: the content region between the header and the footer. */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      data-region="content"
      className={cn("flex flex-col gap-field inset-content", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      data-region="action"
      className={cn(
        "relative flex flex-col-reverse gap-action rounded-b-dialog bg-surface-subtle inset-action before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-line-tertiary sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading type-title text-fg-primary",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "type-body-sm text-fg-secondary *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-fg-primary",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
