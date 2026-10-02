import type { ReactNode } from "react"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import { TooltipProvider } from "./components/ui/tooltip"

/**
 * What every Feather surface needs once, at its root: color mode (light, dark, system), tooltips and toasts.
 * Data fetching, routing and auth belong to the product, not here.
 */
export function FeatherProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
