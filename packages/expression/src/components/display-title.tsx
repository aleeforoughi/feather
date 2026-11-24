import * as React from "react"
import { reveal, revealKeyframes } from "../core/reveal"
import { revealDistance, roleMotion, staggerDelays, staggerStep } from "../core/motion"
import { fontsReady, groupLines, splitChars, splitWords } from "../core/split"
import { useMergedRef, useReducedMotion } from "../hooks"
import { cn } from "../cn"

export type DisplaySize = "xl" | "l" | "m" | "s"
export type DisplaySplit = "line" | "word" | "char" | "none"

const SIZE: Record<DisplaySize, string> = { xl: "type-display-xl", l: "type-display-l", m: "type-display-m", s: "type-display-s" }

export interface DisplayTitleProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  as?: "h1" | "h2" | "h3" | "p"
  size?: DisplaySize
  /** How the reveal is cut: by rendered line, by word, by character, or the whole title at once. */
  split?: DisplaySplit
  /** The title. Plain text: it is split, so it cannot hold markup. */
  children: string
}

const inView = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < (window.innerHeight || 0) && r.right > 0 && r.left < (window.innerWidth || 0)
}

/**
 * DisplayTitle: display type that reveals by line, word or character (the reveal role). The real text is in the DOM
 * for screen readers (a visually hidden copy) and the split pieces are aria-hidden. Lines are measured only after the
 * fonts have loaded. Everything ends within the sequence cap, whatever the length. A title already in view at mount
 * never starts at opacity 0 (it rises in place), so it stays LCP-safe. Under reduced motion it is plain text.
 */
export const DisplayTitle = React.forwardRef<HTMLElement, DisplayTitleProps>(function DisplayTitle({ as: Tag = "h2", size = "l", split = "word", className, children: text, ...props }, forwarded) {
  const root = React.useRef<HTMLElement>(null)
  const ref = useMergedRef(forwarded, root)
  const reduced = useReducedMotion(root)
  const pieces = split !== "none" && !reduced

  React.useEffect(() => {
    const el = root.current
    if (!el || reduced) return
    if (split === "none") return reveal(el, { role: "reveal", from: "rise" })
    if (typeof IntersectionObserver === "undefined") return
    let cancelled = false
    let cleanup = () => {}
    void fontsReady().then(() => {
      if (cancelled) return
      cleanup = play(el, split)
    })
    return () => {
      cancelled = true
      cleanup()
    }
  }, [reduced, split, text])

  const className_ = cn(SIZE[size], "text-fg-primary", className)
  if (!pieces) {
    return (
      <Tag ref={ref as React.Ref<never>} data-slot="display-title" data-variant={split} className={className_} {...props}>
        {text}
      </Tag>
    )
  }
  return (
    <Tag ref={ref as React.Ref<never>} data-slot="display-title" data-variant={split} className={className_} {...props}>
      <span data-slot="display-title-text" className="sr-only">
        {text}
      </span>
      <span data-slot="display-title-visual" aria-hidden="true">
        {splitWords(text).map((word, i) =>
          /^\s+$/.test(word) ? (
            word
          ) : (
            <span key={i} data-slot="display-title-piece" data-piece="word" className="inline-block whitespace-nowrap">
              {split === "char"
                ? splitChars(word).map((ch, j) => (
                    <span key={j} data-slot="display-title-piece" data-piece="char" className="inline-block">
                      {ch}
                    </span>
                  ))
                : word}
            </span>
          )
        )}
      </span>
    </Tag>
  )
})

/** Plays the sequence on the pieces of `el` once it enters; returns the cleanup. */
function play(el: HTMLElement, split: Exclude<DisplaySplit, "none">): () => void {
  const selector = split === "char" ? '[data-piece="char"]' : '[data-piece="word"]'
  const nodes = Array.from(el.querySelectorAll<HTMLElement>(selector))
  if (nodes.length === 0) return () => {}
  const motion = roleMotion("reveal", el)
  if (motion.mode === "none") return () => {}

  // Each node's slot in the sequence: its line (line mode) or its own index.
  let slots: number[]
  let step: number
  if (split === "line") {
    const lines = groupLines(nodes)
    slots = nodes.map((n) => lines.findIndex((l) => l.includes(n)))
    step = staggerStep("block", el)
  } else {
    slots = nodes.map((_, i) => i)
    // Characters step finer than words so a long title does not drag; the cap still bounds it.
    step = split === "char" ? Math.max(8, Math.round(staggerStep("word", el) / 4)) : staggerStep("word", el)
  }
  const count = Math.max(...slots) + 1
  const delays = staggerDelays(count, step, motion.duration)
  const visible = inView(el)
  const frames = revealKeyframes("rise", revealDistance(el), motion.mode, visible)
  if (!frames) return () => {}

  const animations: Animation[] = []
  const hide = () => {
    if (!visible) for (const n of nodes) n.style.opacity = "0"
  }
  const show = () => {
    nodes.forEach((n, i) => {
      n.style.opacity = ""
      if (typeof n.animate === "function") animations.push(n.animate(frames, { duration: motion.duration, delay: delays[slots[i]] ?? 0, easing: motion.easing, fill: "backwards" }))
    })
  }
  hide()
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        show()
        observer.disconnect()
      }
    },
    { threshold: 0.15 }
  )
  observer.observe(el)
  return () => {
    observer.disconnect()
    for (const a of animations) a.cancel()
    for (const n of nodes) n.style.opacity = ""
  }
}
