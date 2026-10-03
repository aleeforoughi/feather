import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { cn } from "../../lib/cn"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { Icon } from "./icon"

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("not-last:border-b not-last:border-line-tertiary", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header data-slot="accordion-header" className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger relative flex flex-1 items-start justify-between gap-2 rounded-control border border-transparent py-3 text-left type-label text-fg-primary motion-hover hover:underline aria-disabled:pointer-events-none aria-disabled:opacity-disabled **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:text-fg-secondary",
          className
        )}
        {...props}
      >
        {children}
        <Icon icon={ChevronDownIcon} data-slot="accordion-trigger-icon" className="pointer-events-none group-aria-expanded/accordion-trigger:hidden" />
        <Icon icon={ChevronUpIcon} data-slot="accordion-trigger-icon" className="pointer-events-none hidden group-aria-expanded/accordion-trigger:inline" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

// The panel opens by animating a grid track from 0fr to 1fr (the `panel` role: opacity and a clipped track, never raw
// height), so the content keeps its own height while it clips.
function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="grid grid-rows-[1fr] type-body-sm motion-panel data-ending-style:grid-rows-[0fr] data-ending-style:opacity-0 data-starting-style:grid-rows-[0fr] data-starting-style:opacity-0"
      {...props}
    >
      <div data-slot="accordion-content-clip" className="min-h-0 overflow-hidden">
        <div
          data-slot="accordion-content-body"
          className={cn(
            "pt-0 pb-3 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-fg-primary [&_p:not(:last-child)]:mb-4",
            className
          )}
        >
          {children}
        </div>
      </div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
