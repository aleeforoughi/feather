import * as React from "react"
import { clock } from "../core/clock"
import { reveal, revealKeyframes } from "../core/reveal"
import { prefersReducedMotion, revealDistance, roleMotion, staggerDelays, staggerStep } from "../core/motion"
import { fontsReady, groupLines, splitChars, splitWords } from "../core/split"
import { isLongRun } from "../core/fit"
import {
  BLINK_MS,
  PRESETS,
  blinkFrames,
  createScramble,
  effectDelays,
  effectFrames,
  effectUnit,
  resolveEffect,
  skewAllowed,
  swapInterval,
  swapNext,
  swapParts,
  SWAP_MS,
  type DisplayEffect,
  type EffectUnit,
} from "../core/text"
import { isHidden } from "../core/visibility"
import { allows } from "../core/loudness"
import { useMergedRef, useReducedMotion } from "../hooks"
import { useDeclaredLoudness } from "./loudness"
import { cn } from "../cn"
import { FitText, fitStyle } from "./fit-text"

export type DisplaySize = "xl" | "l" | "m" | "s"
export type DisplaySplit = "line" | "word" | "char" | "none"
export type { DisplayEffect }

const SIZE: Record<DisplaySize, string> = { xl: "type-display-xl", l: "type-display-l", m: "type-display-m", s: "type-display-s" }

export interface DisplayTitleProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  as?: "h1" | "h2" | "h3" | "p"
  size?: DisplaySize
  /** How the reveal is cut: by rendered line, by word, by character, or the whole title at once. The default is the
   * effect's own (word for rise, line for mask and oval, character for skew and scramble). */
  split?: DisplaySplit
  /** How the title enters. rise: pieces rise in place (the default). mask: pieces rise from behind a line mask. skew:
   * characters slide and unskew (992px and up, else mask). oval: each line opens through a growing ellipse (the one
   * long reveal). blink: a film-cut flicker. scramble: characters cycle and settle left to right. swap: one word in
   * the sentence changes in a masked swap (see `words`). */
  effect?: DisplayEffect
  /** swap only: the words that cycle. The sentence marks the place with `{word}`; without it the words follow the text.
   * The accessible name is the sentence with the first word. */
  words?: string[]
  /** swap only: ms between swaps (default 2400, never under 1200). */
  interval?: number
  /** swap only: true holds the cycle (a host's pause control sets it). It also holds on hover, on focus within, while
   * the title is off screen and while the tab is hidden. */
  paused?: boolean
  /** enter (default): plays as the title enters the viewport. load: plays on mount. */
  trigger?: "enter" | "load"
  /** The title. Plain text: it is split, so it cannot hold markup. */
  children: string
}

const inView = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < (window.innerHeight || 0) && r.right > 0 && r.left < (window.innerWidth || 0)
}

/** The viewport width, tracked: skew plays only from 992px up. */
function useViewportWidth(): number {
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    const read = () => setWidth(window.innerWidth || 0)
    read()
    window.addEventListener("resize", read)
    return () => window.removeEventListener("resize", read)
  }, [])
  return width
}

const MASK_PAD = "py-1 -my-1"

/**
 * DisplayTitle: display type that enters by line, word or character (the reveal role), in one of seven effects. The
 * real text is in the DOM for screen readers (a visually hidden copy) and the visual pieces are aria-hidden. Lines are
 * measured only after the fonts have loaded, and only when the title enters. Everything ends within the sequence cap
 * (oval within its own 1.8s). A title already in view at mount never starts at opacity 0, so it stays LCP-safe. With
 * no script the server markup is the plain title; under reduced motion it stays plain (a 150ms fade where the theme
 * says so; scramble and swap show their final text at once).
 *
 * It fits its box (docs/visual-system.md section 14.1): foundation.css caps the size at what fits the column it sits
 * in, a run longer than the measure is written as --fit-chars and set as one unbreakable piece (fit-word), and only a
 * run that cannot fit even at the floor hyphenates. Every piece wraps as a whole word, never inside one.
 */
export const DisplayTitle = React.forwardRef<HTMLElement, DisplayTitleProps>(function DisplayTitle(
  { as: Tag = "h2", size = "l", split, effect: effectProp = "rise", words, interval, paused = false, trigger = "enter", className, style, children: text, ...props },
  forwarded
) {
  const root = React.useRef<HTMLElement>(null)
  const ref = useMergedRef(forwarded, root)
  const motionReduced = useReducedMotion(root)
  const width = useViewportWidth()
  // Loudness, where the page, a block or the brand declares it: every effect but rise needs "kinetic" (2) and falls
  // back to rise; at 0 the title is plain (no reveal). Reduced motion is stronger than any loudness.
  const level = useDeclaredLoudness(root)
  const reduced = motionReduced || (level !== null && !allows(level, "reveal"))
  const asked: DisplayEffect = level !== null && !allows(level, "kinetic") ? "rise" : effectProp
  const swapWords = asked === "swap" && words && words.length > 0 ? words : null
  const requested: DisplayEffect = asked === "swap" && !swapWords ? "rise" : asked
  const effect = resolveEffect(requested, skewAllowed(reduced, width))
  const swap = swapWords ? swapParts(text, swapWords) : null
  const name = swap ? swap.name : text
  const pieced = effect === "mask" || effect === "skew" || effect === "oval"
  const unit: EffectUnit = pieced ? effectUnit(effect, split) : "word"
  const riseSplit = split ?? "word"
  const wordsKey = swapWords?.join("\u0000") ?? ""
  const pausedRef = React.useRef(paused)
  React.useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  React.useEffect(() => {
    const el = root.current
    if (!el) return
    if (reduced) {
      // Quiet (loudness 0): no reveal at all.
      if (!motionReduced) return
      // Reduced motion: no movement. The theme may give a short fade; scramble and swap are static.
      if (effect === "scramble" || effect === "swap" || !prefersReducedMotion(el)) return
      return reveal(el, { role: "reveal", from: "fade" })
    }
    if (effect === "rise") {
      if (riseSplit === "none") return reveal(el, { role: "reveal", from: "rise" })
      if (typeof IntersectionObserver === "undefined") return
    }
    let cancelled = false
    let cleanup = () => {}
    void fontsReady().then(() => {
      if (cancelled) return
      const visual = el.querySelector<HTMLElement>('[data-slot="display-title-visual"]')
      if (effect === "rise") cleanup = play(el, riseSplit as Exclude<DisplaySplit, "none">)
      else if (!visual) return
      else if (effect === "blink") cleanup = playBlink(el, visual, trigger)
      else if (effect === "scramble") cleanup = playScramble(el, visual, trigger)
      else if (effect === "swap") cleanup = playSwap(el, visual, interval, pausedRef)
      else cleanup = playPieces(el, visual, effect, unit, trigger)
    })
    return () => {
      cancelled = true
      cleanup()
    }
  }, [reduced, motionReduced, effect, riseSplit, unit, text, trigger, wordsKey, interval])

  const className_ = cn(SIZE[size], "text-fg-primary", className)
  const variant = effect === "rise" ? riseSplit : effect
  // The longest run the size must fit, the swap's words included (only when one is longer than the measure).
  const fit = fitStyle(text, ...(swapWords ?? []))
  const style_ = fit ? { ...fit, ...style } : style
  const common = { "data-slot": "display-title", "data-variant": variant, "data-split": effect === "rise" ? riseSplit : pieced ? unit : "none", className: className_, ...(style_ ? { style: style_ } : {}), ...props }
  const plain = reduced || (effect === "rise" && riseSplit === "none")
  if (plain) {
    return (
      <Tag ref={ref as React.Ref<never>} {...common}>
        <FitText>{name}</FitText>
      </Tag>
    )
  }
  return (
    <Tag ref={ref as React.Ref<never>} {...common}>
      <span data-slot="display-title-text" className="sr-only">
        {name}
      </span>
      <span key={`${effect}:${unit}:${name}`} data-slot="display-title-visual" aria-hidden="true" suppressHydrationWarning>
        {effect === "rise" ? <Pieces text={text} unit={riseSplit === "char" ? "char" : "word"} mode="rise" /> : null}
        {pieced ? <Pieces text={text} unit={unit} mode={effect as "mask" | "skew" | "oval"} /> : null}
        {effect === "blink" ? text : null}
        {effect === "scramble" ? <Pieces text={text} unit="char" mode="scramble" /> : null}
        {swap && swapWords ? <Swap before={swap.before} after={swap.after} words={swapWords} /> : null}
      </span>
    </Tag>
  )
})

type PieceMode = "rise" | "mask" | "skew" | "oval" | "scramble"

/** The split pieces. Words are always inline-block and unbreakable; characters sit inside their word. A word longer
 * than the measure is a fit-word: still whole while it fits, it hyphenates only when it cannot fit even at the floor.
 * A mask effect puts the moving part (an `inner`) inside a clipping piece; `data-mask` marks what is released when it
 * finishes. */
function Pieces({ text, unit, mode }: { text: string; unit: EffectUnit | "word" | "char"; mode: PieceMode }) {
  const masked = mode === "mask"
  return (
    <>
      {splitWords(text).map((word, i) => {
        if (/^\s+$/.test(word)) return word
        const whole = isLongRun(word) ? "fit-word" : "inline-block whitespace-nowrap"
        if (unit === "char") {
          return (
            <span key={i} data-slot="display-title-piece" data-piece="word" className={whole}>
              {splitChars(word).map((ch, j) =>
                mode === "mask" || mode === "skew" ? (
                  <span key={j} data-slot="display-title-piece" data-piece="char" data-mask={masked ? "" : undefined} className={cn("inline-block align-top", masked && `overflow-hidden ${MASK_PAD}`)}>
                    <span data-slot="display-title-piece" data-piece="inner" className="inline-block">
                      {ch}
                    </span>
                  </span>
                ) : (
                  <span key={j} data-slot="display-title-piece" data-piece="char" className="inline-block">
                    {ch}
                  </span>
                )
              )}
            </span>
          )
        }
        if (unit === "word" && (mode === "mask" || mode === "skew")) {
          return (
            <span key={i} data-slot="display-title-piece" data-piece="word" data-mask={masked ? "" : undefined} className={cn(whole, "align-top", masked && `overflow-hidden ${MASK_PAD}`)}>
              <span data-slot="display-title-piece" data-piece="inner" className={isLongRun(word) ? "fit-word" : "inline-block"}>
                {word}
              </span>
            </span>
          )
        }
        return (
          <span key={i} data-slot="display-title-piece" data-piece="word" className={whole}>
            {word}
          </span>
        )
      })}
    </>
  )
}

/** The swap sentence: before, a slot where every word is stacked in one grid cell (so the slot is as wide as the widest
 * word and the sentence never jumps), after. Only the active word is inside the mask. */
function Swap({ before, after, words }: { before: string; after: string; words: string[] }) {
  return (
    <>
      <FitText>{before}</FitText>
      <span data-slot="display-title-swap" className={cn("inline-grid max-w-full overflow-hidden align-bottom", MASK_PAD)}>
        {words.map((w, i) => (
          <span key={i} data-slot="display-title-piece" data-piece="swap-word" data-state={i === 0 ? "active" : "idle"} className={isLongRun(w) ? "fit-word" : undefined} style={{ gridArea: "1 / 1", transform: i === 0 ? undefined : "translateY(110%)" }}>
            {w}
          </span>
        ))}
      </span>
      <FitText>{after}</FitText>
    </>
  )
}

// ---- the effects -------------------------------------------------------------------------------------------------

/** Arms the entry: calls `go` when the title enters (at once for `load`, or where there is no IntersectionObserver
 * and the trigger is load). Returns `visible` (in view when armed: nothing is hidden) and the disposer. A title that
 * is not in view is hidden at the visual layer until it enters. */
function armEntry(el: HTMLElement, visual: HTMLElement, trigger: "enter" | "load", go: (visible: boolean) => void): () => void {
  if (trigger === "load") {
    go(true)
    return () => {}
  }
  if (typeof IntersectionObserver === "undefined") return () => {}
  const visible = inView(el)
  if (!visible) visual.style.opacity = "0"
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      observer.disconnect()
      go(visible)
    },
    { threshold: 0.15 }
  )
  observer.observe(el)
  return () => {
    observer.disconnect()
    visual.style.opacity = ""
  }
}

const settled = (animations: Animation[]) => Promise.allSettled(animations.map((a) => a.finished ?? Promise.resolve()))

/** Wraps the words of the visual layer in one block per rendered line (a clipping line, and an inner that moves). */
function wrapLines(visual: HTMLElement, clip: boolean): void {
  const words = Array.from(visual.children).filter((c): c is HTMLElement => c instanceof HTMLElement && c.dataset.piece === "word")
  for (const group of groupLines(words)) {
    const line = document.createElement("span")
    line.setAttribute("data-slot", "display-title-piece")
    line.setAttribute("data-piece", "line")
    line.className = cn("block", clip && `overflow-hidden ${MASK_PAD}`)
    const inner = document.createElement("span")
    inner.setAttribute("data-slot", "display-title-piece")
    inner.setAttribute("data-piece", "inner")
    inner.className = "block"
    line.appendChild(inner)
    const first = group[0]
    const last = group[group.length - 1]
    visual.insertBefore(line, first)
    for (let n: ChildNode | null = first; n; ) {
      const next: ChildNode | null = n.nextSibling
      inner.appendChild(n)
      if (n === last) break
      n = next
    }
  }
}

/** Puts the words back where they were: the natural flow, so a later resize reflows by itself. */
function unwrapLines(visual: HTMLElement): void {
  for (const line of Array.from(visual.querySelectorAll<HTMLElement>('[data-piece="line"]'))) {
    const inner = line.firstElementChild
    while (inner?.firstChild) visual.insertBefore(inner.firstChild, line)
    line.remove()
  }
}

/** mask, skew and oval: pieces of one unit, staggered, each ending inside the sequence cap. */
function playPieces(el: HTMLElement, visual: HTMLElement, effect: "mask" | "skew" | "oval", unit: EffectUnit, trigger: "enter" | "load"): () => void {
  const motion = roleMotion("reveal", el)
  if (motion.mode === "none" || typeof visual.animate !== "function") return () => {}
  const preset = PRESETS[effect]
  const easing = preset.easing ?? motion.easing
  const animations: Animation[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let wrapped = false
  let running = false
  let disposed = false

  const release = () => {
    running = false
    for (const m of Array.from(visual.querySelectorAll<HTMLElement>("[data-mask]"))) m.classList.remove("overflow-hidden")
    if (wrapped) unwrapLines(visual)
    wrapped = false
  }
  const onResize = () => {
    clearTimeout(timer)
    // A resize mid-sequence: finish it where it stands and hand the layout back to the browser (no re-measure).
    timer = setTimeout(() => {
      if (!running) return
      for (const a of animations) a.finish?.()
      release()
    }, 150)
  }

  const start = (visible: boolean) => {
    if (disposed) return
    // Lines are measured now, when the title enters and the fonts are in, never before.
    if (unit === "line") {
      wrapLines(visual, effect === "mask")
      wrapped = true
    }
    visual.style.opacity = ""
    const selector = effect === "oval" ? '[data-piece="line"]' : unit === "line" ? '[data-piece="line"] > [data-piece="inner"]' : `[data-piece="${unit}"] > [data-piece="inner"]`
    const nodes = Array.from(visual.querySelectorAll<HTMLElement>(selector))
    const frames = effectFrames(effect, visible)
    const delays = effectDelays(effect, unit, nodes.length)
    nodes.forEach((n, i) => animations.push(n.animate(frames, { duration: preset.duration, delay: delays[i] ?? 0, easing, fill: "backwards" })))
    running = true
    window.addEventListener("resize", onResize)
    void settled(animations).then(() => {
      if (!disposed) release()
      window.removeEventListener("resize", onResize)
    })
  }

  const dispose = armEntry(el, visual, trigger, start)
  return () => {
    disposed = true
    dispose()
    clearTimeout(timer)
    window.removeEventListener("resize", onResize)
    for (const a of animations) a.cancel()
    release()
    visual.style.opacity = ""
  }
}

/** blink: a film-cut flicker of the whole title, then held. */
function playBlink(el: HTMLElement, visual: HTMLElement, trigger: "enter" | "load"): () => void {
  if (roleMotion("reveal", el).mode === "none" || typeof visual.animate !== "function") return () => {}
  let animation: Animation | null = null
  const dispose = armEntry(el, visual, trigger, () => {
    visual.style.opacity = ""
    animation = visual.animate(blinkFrames(), { duration: BLINK_MS, fill: "backwards" })
  })
  return () => {
    dispose()
    animation?.cancel()
    visual.style.opacity = ""
  }
}

/** scramble: the characters cycle and settle left to right, ticked by the one clock. */
function playScramble(el: HTMLElement, visual: HTMLElement, trigger: "enter" | "load"): () => void {
  const chars = Array.from(visual.querySelectorAll<HTMLElement>('[data-piece="char"]'))
  if (chars.length === 0) return () => {}
  const final = chars.map((c) => c.textContent ?? "")
  let cancel = () => {}
  const unlock = () => {
    for (const c of chars) {
      c.style.width = ""
      c.style.textAlign = ""
    }
  }
  const dispose = armEntry(el, visual, trigger, () => {
    // Each cell keeps the width of its final character so the line never jumps while the glyphs change.
    for (const c of chars) {
      const w = c.getBoundingClientRect().width
      if (w > 0) {
        c.style.width = `${w}px`
        c.style.textAlign = "center"
      }
    }
    cancel = createScramble(final.join(""), {
      clock,
      onFrame: (next) => chars.forEach((c, i) => c.textContent !== next[i] && (c.textContent = next[i])),
      onDone: unlock,
    })
    visual.style.opacity = ""
  })
  return () => {
    dispose()
    cancel()
    chars.forEach((c, i) => (c.textContent = final[i]))
    unlock()
    visual.style.opacity = ""
  }
}

/** swap: one word changes inside its mask every `interval`, held on hover, focus, off screen and a hidden tab. */
function playSwap(el: HTMLElement, visual: HTMLElement, interval: number | undefined, pausedRef: React.RefObject<boolean>): () => void {
  const motion = roleMotion("reveal", el)
  const items = Array.from(visual.querySelectorAll<HTMLElement>('[data-piece="swap-word"]'))
  if (motion.mode === "none" || items.length < 2) return () => {}
  const every = swapInterval(interval)
  let index = 0
  let hovered = false
  let focused = false
  let onScreen = typeof IntersectionObserver === "undefined" ? true : inView(el)
  let timer: ReturnType<typeof setTimeout> | undefined

  const go = () => {
    const next = swapNext(index, items.length)
    const out = items[index]
    const into = items[next]
    if (typeof out.animate === "function") {
      out.animate([{ transform: "translateY(0)" }, { transform: "translateY(-110%)" }], { duration: SWAP_MS, easing: motion.easing })
      into.animate([{ transform: "translateY(110%)" }, { transform: "translateY(0)" }], { duration: SWAP_MS, easing: motion.easing })
    }
    out.style.transform = "translateY(110%)"
    out.dataset.state = "idle"
    into.style.transform = "none"
    into.dataset.state = "active"
    index = next
  }
  const loop = () => {
    timer = setTimeout(() => {
      if (!pausedRef.current && !hovered && !focused && onScreen && !isHidden()) go()
      loop()
    }, every)
  }
  const on = (type: string, fn: () => void) => el.addEventListener(type, fn)
  const enter = () => (hovered = true)
  const leave = () => (hovered = false)
  const focusIn = () => (focused = true)
  const focusOut = () => (focused = false)
  on("pointerenter", enter)
  on("pointerleave", leave)
  on("focusin", focusIn)
  on("focusout", focusOut)
  let observer: IntersectionObserver | null = null
  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver((entries) => entries.forEach((e) => (onScreen = e.isIntersecting)), { threshold: 0.15 })
    observer.observe(el)
  }
  loop()
  return () => {
    clearTimeout(timer)
    observer?.disconnect()
    el.removeEventListener("pointerenter", enter)
    el.removeEventListener("pointerleave", leave)
    el.removeEventListener("focusin", focusIn)
    el.removeEventListener("focusout", focusOut)
    items.forEach((n, i) => {
      n.style.transform = i === 0 ? "" : "translateY(110%)"
      n.dataset.state = i === 0 ? "active" : "idle"
    })
  }
}

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
