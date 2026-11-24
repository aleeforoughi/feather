import * as React from "react"
import { cn } from "../cn"
import { clock } from "../core/clock"
import { honestProgress } from "../core/loader"
import { prefersReducedMotion, sequenceCap } from "../core/motion"
import { sound } from "../core/sound"

export interface LoaderProps {
  /** "counter": a full-screen percentage that lifts off with a curved wipe. "dock": a thin bar fills along a stop-and-go curve, then moves up into the element marked [data-loader-dock] (the site header) and hands over to it. */
  variant?: "counter" | "dock"
  /** The accessible name: "Loading Studio of One". */
  label: string
  /** More readiness to wait for; fonts (document.fonts.ready) and decode() of the images in the first viewport are always included. */
  tasks?: ReadonlyArray<PromiseLike<unknown>>
  /** At the end, ask "Sound on" / "Sound off" before leaving (muted is the default and the first focus). Sets the `sound` preference. */
  sound?: boolean
  soundOnLabel?: string
  soundOffLabel?: string
  /** Passed to honestProgress. */
  minimum?: { first: number; returning: number }
  /** Passed to honestProgress. */
  cap?: number
  onDone?(): void
  className?: string
}

type LoaderState = "loading" | "asking" | "leaving"

const BUTTON =
  "inline-flex min-h-12 min-w-12 items-center justify-center rounded-control border border-line-primary bg-surface-base px-4 type-label text-fg-primary focus-ring not-disabled:hover:bg-surface-hover motion-hover-out"

/** The house curves, read from the theme (WAAPI does not resolve var() in an easing). */
function curve(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v.startsWith("cubic-bezier(") ? v : fallback
}

/** Stop and go: the bar moves, rests, moves again. Monotone, 0 to 0, 1 to 1, three plateaus. */
export function stopAndGo(progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  if (p >= 1) return 1
  const steps = 3
  const i = Math.floor(p * steps)
  const f = p * steps - i
  return (i + f * f * (3 - 2 * f)) / steps
}

/** Fonts, and the first viewport's images decoded. */
function pageTasks(overlay: Element): Array<PromiseLike<unknown>> {
  const out: Array<PromiseLike<unknown>> = []
  if (typeof document === "undefined") return out
  const fonts = (document as Document & { fonts?: { ready?: PromiseLike<unknown> } }).fonts
  if (fonts?.ready) out.push(fonts.ready)
  for (const img of Array.from(document.images)) {
    if (overlay.contains(img) || typeof img.decode !== "function") continue
    if (img.getBoundingClientRect().top >= window.innerHeight) continue
    if (img.complete && img.naturalWidth > 0) continue
    out.push(img.decode())
  }
  return out
}

/** Makes everything but the overlay's own path inert and stops the page scrolling; returns the restore. */
function lockPage(overlay: HTMLElement): () => void {
  const html = document.documentElement
  const overflow = html.style.overflow
  html.style.overflow = "hidden"
  const added: Element[] = []
  let node: Element = overlay
  while (node.parentElement && node !== document.body) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling === node || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(sibling.tagName) || sibling.hasAttribute("inert")) continue
      sibling.setAttribute("inert", "")
      added.push(sibling)
    }
    node = node.parentElement
  }
  return () => {
    html.style.overflow = overflow
    for (const el of added) el.removeAttribute("inert")
  }
}

/**
 * Loader: honest loading. The overlay is in the server HTML so there is no flash of the page, and it is hidden
 * without script and under reduced motion. It shows how much is really ready (never backwards), keeps the page inert
 * and still while it waits, optionally asks about sound, and leaves in one calm move: a curved wipe (counter) or the
 * bar travelling into the header (dock).
 */
export const Loader = React.forwardRef<HTMLDivElement, LoaderProps>(function Loader(
  { variant = "counter", label, tasks, sound: askSound = false, soundOnLabel = "Sound on", soundOffLabel = "Sound off", minimum, cap, onDone, className },
  forwarded,
) {
  const root = React.useRef<HTMLDivElement | null>(null)
  const number = React.useRef<HTMLSpanElement>(null)
  const track = React.useRef<HTMLDivElement>(null)
  const fill = React.useRef<HTMLDivElement>(null)
  const backdrop = React.useRef<HTMLDivElement>(null)
  const offButton = React.useRef<HTMLButtonElement>(null)
  const [state, setState] = React.useState<LoaderState>("loading")
  const [gone, setGone] = React.useState(false)
  const [milestone, setMilestone] = React.useState(0)
  const doneRef = React.useRef(onDone)
  doneRef.current = onDone
  const leaving = React.useRef(false)
  const tasksRef = React.useRef(tasks)
  const optionsRef = React.useRef({ minimum, cap })

  const setRoot = React.useCallback(
    (el: HTMLDivElement | null) => {
      root.current = el
      if (typeof forwarded === "function") forwarded(el)
      else if (forwarded) (forwarded as { current: HTMLDivElement | null }).current = el
    },
    [forwarded],
  )

  const finish = React.useCallback(() => {
    setGone(true)
    doneRef.current?.()
  }, [])

  const leave = React.useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    setState("leaving")
    const el = root.current
    if (!el || typeof el.animate !== "function") return finish()
    const wipe = curve("--ease-wipe", "cubic-bezier(0.76, 0, 0.24, 1)")
    const lift = () => {
      const a = el.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }], { duration: Math.min(sequenceCap(el), 1000), easing: wipe, fill: "forwards" })
      a.onfinish = finish
      a.oncancel = finish
    }
    const dock = variant === "dock" ? document.querySelector<HTMLElement>("[data-loader-dock]") : null
    const bar = track.current
    const back = backdrop.current
    if (!dock || !bar || !back) return lift()
    const from = bar.getBoundingClientRect()
    const to = dock.getBoundingClientRect()
    if (from.width === 0) return lift()
    const dx = to.left - from.left
    const dy = to.bottom - from.top - from.height
    const sx = to.width / from.width
    const route = curve("--ease-route", "cubic-bezier(0.625, 0.05, 0, 1)")
    bar.style.transformOrigin = "0 0"
    const travel = bar.animate([{ transform: "translate(0px, 0px) scale(1, 1)" }, { transform: `translate(${dx}px, ${dy}px) scale(${sx}, 1)` }], { duration: 900, easing: route, fill: "forwards" })
    const fade = back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 600, easing: "linear", fill: "forwards" })
    void fade
    travel.onfinish = finish
    travel.oncancel = finish
  }, [finish, variant])

  // Reduced motion: no loader at all.
  React.useEffect(() => {
    if (prefersReducedMotion(root.current)) {
      setGone(true)
      doneRef.current?.()
    }
  }, [])

  // Inert page and no scroll while it shows.
  React.useEffect(() => {
    const el = root.current
    if (gone || !el || prefersReducedMotion(el)) return
    return lockPage(el)
  }, [gone])

  // The progress.
  React.useEffect(() => {
    const el = root.current
    if (gone || !el || prefersReducedMotion(el)) return
    let target = 0
    let shown = 0
    let ready = false
    let ended = false
    let last = 0
    const paint = () => {
      if (number.current) number.current.textContent = String(Math.round(shown * 100))
      if (fill.current) fill.current.style.transform = `scaleX(${Math.max(0.001, stopAndGo(shown))})`
      const m = shown >= 1 ? 100 : shown >= 0.5 ? 50 : 0
      if (m !== last) {
        last = m
        setMilestone(m)
      }
    }
    const progress = honestProgress({
      tasks: [...pageTasks(el), ...(tasksRef.current ?? [])],
      ...optionsRef.current,
      onProgress: (p) => {
        target = Math.max(target, p)
      },
      onDone: () => {
        ready = true
        target = 1
      },
    })
    const stop = clock.add((_time, delta) => {
      if (ended) return
      shown = Math.max(shown, shown + (target - shown) * (1 - Math.exp(-delta / (ready ? 60 : 120))))
      if (ready && shown >= 0.995) shown = 1
      paint()
      if (shown >= 1) {
        ended = true
        stop()
        if (askSound) setState("asking")
        else leave()
      }
    })
    return () => {
      ended = true
      progress.cancel()
      stop()
    }
  }, [gone, askSound, leave])

  React.useEffect(() => {
    if (state === "asking") offButton.current?.focus()
  }, [state])

  const choose = (choice: "on" | "off") => {
    sound.set(choice)
    leave()
  }

  if (gone) return null

  const spoken = milestone >= 100 ? `Loading, 100%` : milestone >= 50 ? "Loading, 50%" : "Loading"

  return (
    <div
      ref={setRoot}
      data-slot="loader"
      data-variant={variant}
      data-state={state}
      role="status"
      aria-label={label}
      className={cn("fixed inset-0 z-50 flex items-center justify-center noscript:hidden motion-reduce:hidden", className)}
    >
      <div ref={backdrop} data-slot="loader-backdrop" aria-hidden="true" className="absolute inset-0 bg-surface-base" />
      <span data-slot="loader-status" className="sr-only">
        {spoken}
      </span>
      {variant === "counter" ? (
        <div data-slot="loader-stage" className="relative flex flex-col items-center gap-8" data-state={state}>
          {state === "asking" ? null : (
            <span aria-hidden="true" data-slot="loader-number" className="type-display-xl numeric text-fg-primary">
              <span ref={number}>0</span>
              <span>%</span>
            </span>
          )}
        </div>
      ) : (
        <div ref={track} data-slot="loader-bar" aria-hidden="true" className="absolute inset-x-6 top-1/2 overflow-hidden"
          style={{ height: 2 }}>
          <div ref={fill} data-slot="loader-fill" className="h-full w-full origin-left bg-fg-primary" style={{ transform: "scaleX(0.001)" }} />
        </div>
      )}
      {state === "asking" ? (
        <div data-slot="loader-sound" role="group" aria-label="Sound" className={cn("flex gap-3", variant === "dock" ? "absolute inset-x-0 top-1/2 mt-8 justify-center" : "relative")}>
          <button ref={offButton} type="button" data-slot="loader-sound-off" className={BUTTON} onClick={() => choose("off")}>
            {soundOffLabel}
          </button>
          <button type="button" data-slot="loader-sound-on" className={BUTTON} onClick={() => choose("on")}>
            {soundOnLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
})
