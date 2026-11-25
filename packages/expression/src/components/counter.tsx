import * as React from "react"
import { cn } from "../cn"
import { useReducedMotion } from "../hooks"
import { countTo, formatCount } from "../core/counter"
import { useLocale } from "./locale"

const NBSP = " "

export interface CounterProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The final value. */
  value: number
  from?: number
  /** ms; kept within 600 to 1200. */
  duration?: number
  /** A unit after the number, joined with a non-breaking space ("%", "ms", "years"). */
  unit?: string
  /** The locale the number is written in; by default the nearest LocaleProvider's (a page's `lang`), else "en". */
  locale?: string
}

/**
 * Counter: a number that counts up as it enters the viewport. Tabular figures and fixed decimals keep its width
 * still. Assistive technology reads the final value; the tween is hidden from it. Under reduced motion, and with no
 * IntersectionObserver, the final value is simply there.
 */
export const Counter = React.forwardRef<HTMLSpanElement, CounterProps>(function Counter({ value, from = 0, duration = 900, unit, locale: own, className, style, ...props }, forwarded) {
  const inherited = useLocale()
  const locale = own ?? inherited
  const root = React.useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion(root)
  const final = formatCount(value, value, locale)
  const [text, setText] = React.useState(final)
  const [state, setState] = React.useState<"idle" | "counting" | "done">("done")

  React.useEffect(() => {
    const el = root.current
    if (!el || reduced || typeof IntersectionObserver === "undefined") {
      setText(final)
      setState("done")
      return
    }
    setText(formatCount(from, value, locale))
    setState("idle")
    let cancel: (() => void) | null = null
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      setState("counting")
      cancel = countTo({
        from,
        to: value,
        duration,
        element: el,
        onUpdate: (v) => setText(formatCount(v, value, locale)),
        onDone: () => setState("done"),
      })
    })
    io.observe(el)
    return () => {
      io.disconnect()
      cancel?.()
    }
  }, [reduced, value, from, duration, locale, final])

  const set = (node: HTMLSpanElement | null) => {
    root.current = node
    if (typeof forwarded === "function") forwarded(node)
    else if (forwarded) forwarded.current = node
  }
  return (
    <span ref={set} data-slot="counter" data-state={state} className={cn("numeric inline-block", className)} style={{ minInlineSize: `${final.length}ch`, ...style }} {...props}>
      <span data-slot="counter-value" aria-hidden="true">
        {text}
        {unit ? NBSP + unit : null}
      </span>
      <span data-slot="counter-final" className="sr-only">
        {final}
        {unit ? NBSP + unit : null}
      </span>
    </span>
  )
})
