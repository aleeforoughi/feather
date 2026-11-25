// Page and section transitions (the scene role) with View Transitions, and Taxi-style cleanup: everything a route
// registered is disposed before the next one renders. A persistent slot (the World canvas) carries a fixed
// view-transition-name so it is never torn down. Without View Transitions, or under reduced motion, the update runs at
// once: the content always arrives, only the motion is optional.
import { prefersReducedMotion } from "./motion"

/** How a route arrives. `view`: the old page recedes while the new one wipes up. `push`: the old page drifts up
 * under a veil while the new one rises. `slide`: the old page stays as a dimmed, receding layer while the new one
 * slides up over it. `sheets`: the new page rises as a sheet tilted -4deg while the old one recedes. `circle`: the new
 * page opens as a circle from the last click or tap (the centre after a key press). `columns`: four columns cover the page and lift off the new one. `fade`: the
 * browser's own cross-fade. `none`: an instant swap. Every variant is instant under reduced motion, and `view`,
 * `push` and `fade` are instant where View Transitions are not supported; the content always arrives. */
export type RouteVariant = "none" | "fade" | "view" | "push" | "slide" | "sheets" | "circle" | "columns"

/** A pointer press counts as the origin of a route change for this long (ms); after it, the origin is the centre. */
export const POINTER_WINDOW = 1000

export interface GoOptions {
  variant?: RouteVariant
  /** After the swap: scroll to the top, move focus to the new page's h1 and announce its title (default true). */
  arrive?: boolean
}

/** The column curtain (Qooler file 27 section 7): four columns, a 0.06s stagger, each leg within the 1.2s cap. */
export const CURTAIN = { columns: 4, stagger: 60, leg: 1020 } as const

/** Moves focus to the new page's first h1 (made focusable for this) and says its title to screen readers. */
export function arrive(root: ParentNode = document): void {
  if (typeof document === "undefined" || typeof root?.querySelectorAll !== "function") return
  window.scrollTo?.({ top: 0, left: 0, behavior: "instant" as ScrollBehavior })
  // The first h1 that is rendered: a hidden one (a template, an inactive view) can neither take focus nor be the
  // page the person arrived on.
  const heading = Array.from(root.querySelectorAll<HTMLElement>("h1")).find((h) => (typeof h.checkVisibility === "function" ? h.checkVisibility() : true)) ?? null
  if (heading) {
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1")
    heading.focus({ preventScroll: true })
  }
  let live = document.querySelector<HTMLElement>('[data-slot="route-announcer"]')
  if (!live) {
    live = document.createElement("div")
    live.setAttribute("data-slot", "route-announcer")
    live.setAttribute("aria-live", "polite")
    live.setAttribute("aria-atomic", "true")
    live.className = "sr-only"
    document.body.append(live)
  }
  live.textContent = heading?.textContent?.trim() || document.title
}

/** Covers the page with the column curtain; resolves when it is closed. The returned `lift` opens it again. */
async function curtain(): Promise<() => Promise<void>> {
  const layer = document.createElement("div")
  layer.setAttribute("data-slot", "route-curtain")
  layer.setAttribute("aria-hidden", "true")
  layer.style.cssText = "position:fixed;inset:0;display:flex;z-index:2147483000;pointer-events:none"
  const columns = Array.from({ length: CURTAIN.columns }, () => {
    const c = document.createElement("span")
    c.style.cssText = "flex:1;height:100%;background:var(--color-surface-inverse, #111);transform:scaleY(0);transform-origin:bottom"
    layer.append(c)
    return c
  })
  document.body.append(layer)
  const run = (from: number, to: number, origin: string) =>
    Promise.all(
      columns.map((c, i) => {
        c.style.transformOrigin = origin
        const a = c.animate?.([{ transform: `scaleY(${from})` }, { transform: `scaleY(${to})` }], { duration: CURTAIN.leg, delay: i * CURTAIN.stagger, easing: "cubic-bezier(0.625, 0.05, 0, 1)", fill: "both" })
        return a ? a.finished.catch(() => undefined) : Promise.resolve()
      })
    )
  await run(0, 1, "bottom")
  return async () => {
    await run(1, 0, "top")
    layer.remove()
  }
}

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void>; updateCallbackDone: Promise<void> } }

/** The view-transition-name the persistent World slot keeps across routes. */
export const PERSISTENT_SLOT = "feather-world"

export interface Transitions {
  /** Registers something to dispose on the next route change (a listener, a timeline, a GPU resource). */
  onLeave(dispose: () => void): () => void
  /** Disposes what the current route registered, then runs the update inside the route transition. */
  go(update: () => void | Promise<void>, options?: GoOptions): Promise<void>
  /** How many disposers wait for the next route change. */
  readonly pending: number
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now())

export function createTransitions(doc: ViewTransitionDocument | undefined = typeof document === "undefined" ? undefined : (document as ViewTransitionDocument)): Transitions {
  const disposers = new Set<() => void>()
  const leave = () => {
    for (const d of [...disposers]) {
      disposers.delete(d)
      try {
        d()
      } catch {
        // A disposer that throws must not keep the next route from rendering.
      }
    }
  }
  // The last pointer press, for the circle variant. Passive, and never removed: it is one listener per document.
  let pointer: { x: number; y: number; at: number } | null = null
  doc?.addEventListener?.(
    "pointerdown",
    (e) => {
      const { clientX, clientY } = e as PointerEvent
      pointer = { x: clientX, y: clientY, at: now() }
    },
    { passive: true, capture: true }
  )
  return {
    onLeave(dispose) {
      disposers.add(dispose)
      return () => disposers.delete(dispose)
    },
    async go(update, { variant = "fade", arrive: land = true } = {}) {
      leave()
      const done = () => {
        if (land && doc) arrive(doc)
      }
      if (variant === "none" || !doc || prefersReducedMotion()) {
        await update()
        done()
        return
      }
      if (variant === "columns") {
        const lift = await curtain()
        await update()
        done()
        await lift()
        return
      }
      if (!doc.startViewTransition) {
        await update()
        done()
        return
      }
      const html = doc.documentElement
      if (variant !== "fade") html?.setAttribute("data-route-transition", variant)
      const origin = variant === "circle" ? (pointer && now() - pointer.at <= POINTER_WINDOW ? pointer : null) : undefined
      if (origin !== undefined) {
        html?.style?.setProperty("--route-x", origin ? `${origin.x}px` : "50%")
        html?.style?.setProperty("--route-y", origin ? `${origin.y}px` : "50%")
      }
      const transition = doc.startViewTransition(update)
      const clear = () => {
        html?.removeAttribute("data-route-transition")
        if (origin !== undefined) {
          html?.style?.removeProperty("--route-x")
          html?.style?.removeProperty("--route-y")
        }
      }
      try {
        await transition.updateCallbackDone
      } catch (e) {
        clear()
        throw e
      }
      done()
      if (transition.finished) void transition.finished.finally(clear)
      else clear()
    },
    get pending() {
      return disposers.size
    },
  }
}
