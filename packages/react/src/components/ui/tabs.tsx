"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/cn"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-card p-1 text-fg-secondary group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:gap-2 data-[variant=line]:rounded-none data-[variant=line]:p-0",
  {
    variants: {
      variant: {
        default: "bg-surface-subtle",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

// A tab that stands as a control: the density's height and padding, the control radius and the label role. The active line
// of the line variant is drawn by ::before (2px), so ::after stays the hit area (`hit-area`).
function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "hit-area inline-flex h-control flex-1 items-center justify-center gap-2 rounded-control border border-transparent px-control type-label whitespace-nowrap text-fg-secondary motion-state group-data-vertical/tabs:w-full group-data-vertical/tabs:flex-none group-data-vertical/tabs:justify-start not-disabled:not-aria-disabled:hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-disabled aria-disabled:cursor-not-allowed aria-disabled:opacity-disabled group-data-[variant=default]/tabs-list:data-active:shadow-1 group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon-slot",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-surface-raised data-active:text-fg-primary",
        "before:absolute before:bg-fg-primary before:opacity-0 before:motion-state group-data-horizontal/tabs:before:inset-x-0 group-data-horizontal/tabs:before:bottom-0 group-data-horizontal/tabs:before:h-indicator group-data-vertical/tabs:before:inset-y-0 group-data-vertical/tabs:before:right-0 group-data-vertical/tabs:before:w-indicator group-data-[variant=line]/tabs-list:data-active:before:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 type-body-sm", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
