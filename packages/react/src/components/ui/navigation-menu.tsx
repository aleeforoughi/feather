import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"
import { cn } from "../../lib/cn"
import { ChevronDownIcon } from "lucide-react"
import { Icon } from "./icon"
import { usePortalContainer } from "../../lib/portal-container"

function NavigationMenu({
  align = "start",
  className,
  children,
  ...props
}: NavigationMenuPrimitive.Root.Props &
  Pick<NavigationMenuPrimitive.Positioner.Props, "align">) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={cn(
        "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        className
      )}
      {...props}
    >
      {children}
      <NavigationMenuPositioner align={align} />
    </NavigationMenuPrimitive.Root>
  )
}

function NavigationMenuList({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn(
        "group flex flex-1 list-none items-center justify-center gap-0",
        className
      )}
      {...props}
    />
  )
}

function NavigationMenuItem({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  )
}

// A trigger is a control in the frame: the density's height and padding, the control radius and the label role.
const navigationMenuTriggerStyle = (props?: { className?: string }) =>
  cn(
    "group/navigation-menu-trigger hit-area inline-flex h-control w-max items-center justify-center gap-2 rounded-control px-control type-label text-fg-primary motion-state hover:bg-surface-hover focus:bg-surface-hover disabled:pointer-events-none disabled:opacity-disabled data-popup-open:bg-surface-hover data-open:bg-surface-hover",
    props?.className
  )

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: NavigationMenuPrimitive.Trigger.Props) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      {...props}
    >
      {children}
      <Icon icon={ChevronDownIcon} className="motion-state group-data-popup-open/navigation-menu-trigger:rotate-180 group-data-open/navigation-menu-trigger:rotate-180" aria-hidden="true" />
    </NavigationMenuPrimitive.Trigger>
  )
}

function NavigationMenuContent({
  className,
  ...props
}: NavigationMenuPrimitive.Content.Props) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        "h-full w-auto p-1 motion-popover data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:data-[activation-direction=left]:-translate-x-2 data-starting-style:data-[activation-direction=right]:translate-x-2 data-ending-style:data-[activation-direction=left]:translate-x-2 data-ending-style:data-[activation-direction=right]:-translate-x-2",
        className
      )}
      {...props}
    />
  )
}

function NavigationMenuPositioner({
  className,
  side = "bottom",
  sideOffset = 8,
  align = "start",
  alignOffset = 0,
  ...props
}: NavigationMenuPrimitive.Positioner.Props) {
  const container = usePortalContainer()
  return (
    <NavigationMenuPrimitive.Portal container={container}>
      <NavigationMenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        data-slot="navigation-menu-positioner"
        className={cn(
          "isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) motion-popover [transition-property:top,left,right,bottom] data-instant:transition-none data-[side=bottom]:before:-top-2 data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0",
          className
        )}
        {...props}
      >
        <NavigationMenuPrimitive.Popup data-slot="navigation-menu-popup" className="relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) rounded-card border border-line-secondary bg-popover text-popover-foreground shadow-2 motion-popover [transition-property:opacity,transform,translate,scale,width,height] outline-none data-ending-style:scale-99 data-ending-style:opacity-0 data-starting-style:scale-99 data-starting-style:opacity-0">
          <NavigationMenuPrimitive.Viewport data-slot="navigation-menu-viewport" className="relative size-full overflow-hidden" />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  )
}

function NavigationMenuLink({
  className,
  ...props
}: NavigationMenuPrimitive.Link.Props) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "flex items-center gap-2 rounded-control min-h-control px-3 py-2 type-body-sm text-fg-primary motion-hover hover:bg-surface-hover focus:bg-surface-hover data-active:bg-surface-selected [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function NavigationMenuIndicator({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Icon>) {
  return (
    <NavigationMenuPrimitive.Icon
      data-slot="navigation-menu-indicator"
      className={cn(
        "top-full z-1 flex h-2 items-end justify-center overflow-hidden motion-state data-[state=hidden]:opacity-0",
        className
      )}
      {...props}
    >
      <div data-slot="navigation-menu-indicator-arrow" className="relative top-1/2 size-2 rotate-45 rounded-tl-xs bg-line-secondary shadow-2" />
    </NavigationMenuPrimitive.Icon>
  )
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
  NavigationMenuPositioner,
}
