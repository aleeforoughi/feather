import * as React from "react"
import { cn } from "../cn"
import { connectScroll, scrub, type LenisLike, type ScrollEngine } from "../core/scroll"

export interface ScrollContextValue {
  /** What is actually running: "lenis" only when smoothing is on. */
  kind: "native" | "css" | "lenis"
  lenis: LenisLike | null
}

const ScrollContext = React.createContext<ScrollContextValue>({ kind: "native", lenis: null })

export interface ScrollProviderProps {
  engine?: ScrollEngine
  children?: React.ReactNode
}

/** ScrollProvider: owns the page's one scroll connection. Mount it once, high in the tree. */
export function ScrollProvider({ engine = { kind: "native" }, children }: ScrollProviderProps) {
  const [value, setValue] = React.useState<ScrollContextValue>({ kind: engine.kind === "lenis" ? "native" : engine.kind, lenis: null })
  const create = engine.kind === "lenis" ? engine.create : null
  const gsap = engine.kind === "lenis" ? engine.gsap : undefined
  const kind = engine.kind
  React.useEffect(() => {
    const connection = connectScroll(kind === "lenis" && create ? { kind, create, gsap } : { kind: kind === "css" ? "css" : "native" })
    // The connection exists only after mount (it touches the DOM and the clock), so its result is synced here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue({ kind: connection.kind, lenis: connection.lenis })
    return () => {
      connection.disconnect()
      setValue({ kind: "native", lenis: null })
    }
  }, [kind, create, gsap])
  return <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>
}

/** The scroll engine in use. Outside a provider: native scrolling. */
export function useScroll(): ScrollContextValue {
  return React.useContext(ScrollContext)
}

/** ScrollProgress: a thin decorative bar that fills as the page scrolls. */
export const ScrollProgress = React.forwardRef<HTMLDivElement, Omit<React.HTMLAttributes<HTMLDivElement>, "children">>(function ScrollProgress({ className, style, ...props }, forwarded) {
  const bar = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const el = bar.current
    if (!el) return
    return scrub(
      document.documentElement,
      (p) => {
        el.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`
      },
      { scrub: 0.3, pinned: true },
    )
  }, [])
  const set = (node: HTMLDivElement | null) => {
    bar.current = node
    if (typeof forwarded === "function") forwarded(node)
    else if (forwarded) forwarded.current = node
  }
  return <div ref={set} data-slot="scroll-progress" aria-hidden="true" className={cn("pointer-events-none fixed inset-x-0 top-0 z-10 h-1 bg-surface-inverse", className)} style={{ clipPath: "inset(0 100% 0 0)", ...style }} {...props} />
})
