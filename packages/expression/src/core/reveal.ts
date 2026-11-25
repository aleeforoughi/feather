// The reveal role: text and blocks entering on scroll (docs/visual-system.md section 14.2). LCP-safe: what is already
// in view when the page loads is never hidden (it rises in place, at full opacity), so the largest paint is never
// delayed; only what enters later starts hidden. HTML first: with no IntersectionObserver or no script, everything
// is simply shown. Animations are WAAPI, which the browser runs off the clock, and interruptible.
import { revealDistance, roleMotion, type ExpressionRole } from "./motion"
import { guardEntrance } from "./visibility"

export type RevealFrom = "rise" | "mask" | "fade"

export interface RevealOptions {
  role?: Extract<ExpressionRole, "reveal" | "media" | "scene">
  from?: RevealFrom
  /** ms before this element starts (a stagger position). */
  delay?: number
  /** Reveal once (the default) or every time it enters. */
  once?: boolean
  /** IntersectionObserver threshold. */
  threshold?: number
  /** Called when the element has been revealed (or shown at once). */
  onReveal?: () => void
}

type Frame = Keyframe & { transform?: string; clipPath?: string; opacity?: number }

/** The keyframes of a reveal. `visible` (already in view at mount) keeps full opacity: LCP-safe. */
export function revealKeyframes(from: RevealFrom, distance: number, mode: "full" | "fade" | "none", visible: boolean): Frame[] | null {
  if (mode === "none") return null
  if (mode === "fade") return visible ? null : [{ opacity: 0 }, { opacity: 1 }]
  const start: Frame = visible ? {} : { opacity: 0 }
  if (from === "rise") start.transform = `translateY(${distance}px)`
  if (from === "mask") start.clipPath = "inset(0 0 100% 0)"
  if (from === "fade" && visible) return null
  const end: Frame = { opacity: 1, transform: "none", clipPath: "inset(0 0 0% 0)" }
  if (from !== "mask") delete end.clipPath
  if (from !== "rise") delete end.transform
  return [start, end]
}

const inView = (el: Element) => {
  if (typeof window === "undefined") return true
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < (window.innerHeight || 0) && r.right > 0 && r.left < (window.innerWidth || 0)
}

/** Reveals an element as it enters the viewport. Returns the cleanup, which restores the element as it was. */
export function reveal(el: HTMLElement, options: RevealOptions = {}): () => void {
  const { role = "reveal", from = "rise", delay = 0, once = true, threshold = 0.15, onReveal } = options
  const motion = roleMotion(role, el)
  const done = () => onReveal?.()
  if (typeof IntersectionObserver === "undefined" || motion.mode === "none") {
    done()
    return () => {}
  }
  const visibleAtMount = inView(el)
  const frames = revealKeyframes(from, revealDistance(el), motion.mode, visibleAtMount)
  if (!frames) {
    done()
    return () => {}
  }
  const previous = el.style.opacity
  let animation: Animation | null = null
  const hide = () => {
    if (!visibleAtMount) el.style.opacity = "0"
  }
  const play = () => {
    animation?.cancel()
    animation = typeof el.animate === "function" ? el.animate(frames, { duration: motion.duration, delay, easing: motion.easing, fill: "backwards" }) : null
    el.style.opacity = previous
    done()
  }
  hide()
  // No frames (a hidden tab, a capture that draws none): the end state, never content held hidden.
  const stalled = () => {
    observer.disconnect()
    if (animation) animation.finish()
    else {
      el.style.opacity = previous
      done()
    }
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          play()
          unguard()
          unguard = guardEntrance(stalled)
          if (once) observer.disconnect()
        } else if (!once) hide()
      }
    },
    { threshold }
  )
  observer.observe(el)
  let unguard = guardEntrance(stalled)
  return () => {
    unguard()
    observer.disconnect()
    animation?.cancel()
    el.style.opacity = previous
  }
}
