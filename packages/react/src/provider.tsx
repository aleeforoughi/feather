import type { ReactNode } from "react"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import { TooltipProvider } from "./components/ui/tooltip"
import { FeatherPortalProvider } from "./lib/portal-container"

/**
 * What every Feather surface needs once, at its root: color mode (light, dark, system), tooltips and toasts.
 * Data fetching, routing and auth belong to the product, not here.
 *
 * `portalContainer` is where popups (select, menus, popover, tooltip, dialog, sheet) are rendered. Omit it and they
 * go to document.body, as Base UI does. Pass an element to keep them inside a scoped subtree.
 */
export function FeatherProvider({ children, portalContainer }: { children: ReactNode; portalContainer?: HTMLElement | null }) {
  return (
    <ThemeProvider>
      <FeatherPortalProvider container={portalContainer}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </FeatherPortalProvider>
    </ThemeProvider>
  )
}
