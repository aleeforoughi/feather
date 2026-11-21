import * as React from "react"
import { cn } from "../cn"
import { createTransitions, PERSISTENT_SLOT, type Transitions } from "../core/transition"

const TransitionContext = React.createContext<Transitions | null>(null)

export interface TransitionProviderProps {
  children?: React.ReactNode
}

/** TransitionProvider: one set of page transitions for the app (View Transitions plus Taxi-style cleanup). */
export function TransitionProvider({ children }: TransitionProviderProps) {
  const transitions = React.useMemo(() => createTransitions(), [])
  return <TransitionContext.Provider value={transitions}>{children}</TransitionContext.Provider>
}

/** `go(update)` runs a route change in a view transition; `onLeave(dispose)` registers cleanup for the next one. */
export function useTransitions(): Transitions {
  const t = React.useContext(TransitionContext)
  if (!t) throw new Error("useTransitions must be used inside a TransitionProvider")
  return t
}

export interface PersistentSlotProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The World canvas, or anything that must survive route changes. */
  children?: React.ReactNode
}

/** PersistentSlot: a fixed full-viewport layer behind the content. Its view-transition-name keeps it out of every
 * page transition. Decorative: hidden from assistive technology. */
export const PersistentSlot = React.forwardRef<HTMLDivElement, PersistentSlotProps>(function PersistentSlot({ children, className, style, ...props }, ref) {
  return (
    <div ref={ref} data-slot="persistent-slot" aria-hidden="true" className={cn("pointer-events-none fixed inset-0 -z-10", className)} style={{ viewTransitionName: PERSISTENT_SLOT, ...style }} {...props}>
      {children}
    </div>
  )
})
