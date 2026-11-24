import * as React from "react"
import { cn } from "../cn"
import { roleMotion, staggerDelays, staggerStep } from "../core/motion"

export interface OverlayMenuItem {
  label: string
  href: string
  current?: boolean
}

export interface OverlayMenuProps {
  items: OverlayMenuItem[]
  /** The navigation landmark's name and the panel's dialog name (default "Site"). */
  label?: string
  openLabel?: string
  closeLabel?: string
  /** The left side of the bar: usually the wordmark as a link home. */
  brand?: React.ReactNode
  /** Shown in the bar beside the toggle (e.g. a SoundToggle). */
  actions?: React.ReactNode
  /** Extra panel content under the links (contact lines, socials). */
  aside?: React.ReactNode
  className?: string
}

/** The panel opens in ~1.1s and closes in ~0.7s (the winners' values); the links rise 0.7s each, after a short lead. */
const OPEN_MS = 1100
const CLOSE_MS = 700
const LINK_MS = 700
const LINK_LEAD_MS = 300
const EXPO_OUT = "cubic-bezier(0.19, 1, 0.22, 1)"
const ROUTE_EASE = "cubic-bezier(0.625, 0.05, 0, 1)"

const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Sets `inert` on every element outside `root` (the other children of each ancestor, up to the body) and returns
 * the undo, which clears only what this call set. */
function inertOutside(root: HTMLElement): () => void {
  const changed: HTMLElement[] = []
  let node: HTMLElement | null = root
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    for (const sibling of Array.from(parent.children)) {
      if (sibling !== node && sibling instanceof HTMLElement && !sibling.hasAttribute("inert") && sibling.tagName !== "SCRIPT") {
        sibling.setAttribute("inert", "")
        changed.push(sibling)
      }
    }
    node = parent
  }
  return () => changed.forEach((el) => el.removeAttribute("inert"))
}

/**
 * OverlayMenu: a minimal bar whose Menu button opens a full-screen overlay of large links. Without script the
 * toggle is hidden and the panel is a plain list in the flow. Open, it is a modal dialog: focus moves to the first
 * link and is trapped, Escape closes, the rest of the page is inert and does not scroll, and focus returns to the
 * toggle. The page decides whether the bar is sticky or fixed.
 */
export function OverlayMenu({ items, label = "Site", openLabel = "Menu", closeLabel = "Close", brand, actions, aside, className }: OverlayMenuProps) {
  const panelId = React.useId()
  const root = React.useRef<HTMLElement>(null)
  const toggle = React.useRef<HTMLButtonElement>(null)
  const panel = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  /** The panel stays visible while it closes (the close animation), so this trails `open`. */
  const [shown, setShown] = React.useState(false)
  const token = React.useRef(0)
  const wasOpen = React.useRef(false)

  const state = open ? "open" : "closed"

  const close = React.useCallback(() => setOpen(false), [])

  // Lock the page while open.
  React.useEffect(() => {
    if (!open || !root.current) return
    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = "hidden"
    const restoreInert = inertOutside(root.current)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      restoreInert()
      html.style.overflow = previous
    }
  }, [open])

  // Make the panel visible in the same commit that opens it; hide it after the close motion.
  useIsoLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const run = ++token.current
    el.getAnimations?.().forEach((a) => a.cancel())
    const links = Array.from(el.querySelectorAll<HTMLElement>('[data-slot="overlay-menu-link"]'))
    links.forEach((l) => l.getAnimations?.().forEach((a) => a.cancel()))
    const canAnimate = typeof el.animate === "function"
    const motion = roleMotion("scene", el)

    if (open) {
      wasOpen.current = true
      setShown(true)
      links[0]?.focus()
      if (!canAnimate || motion.mode === "none") return
      if (motion.mode === "fade") {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: motion.duration, easing: "linear", fill: "backwards" })
        return
      }
      el.animate([{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0)" }], { duration: OPEN_MS, easing: ROUTE_EASE, fill: "backwards" })
      const delays = staggerDelays(links.length, Math.max(staggerStep("block", el) - 20, 0) || 80, LINK_MS, 1200 - LINK_LEAD_MS)
      links.forEach((link, i) => {
        link.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], { duration: LINK_MS, delay: LINK_LEAD_MS + (delays[i] ?? 0), easing: EXPO_OUT, fill: "backwards" })
      })
      return
    }

    if (!wasOpen.current) return
    wasOpen.current = false
    toggle.current?.focus()
    if (!canAnimate || motion.mode === "none") {
      setShown(false)
      return
    }
    const animation =
      motion.mode === "fade"
        ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: motion.duration, easing: "linear", fill: "forwards" })
        : el.animate([{ clipPath: "inset(0)" }, { clipPath: "inset(0 0 100% 0)" }], { duration: CLOSE_MS, easing: ROUTE_EASE, fill: "forwards" })
    const done = () => {
      if (token.current === run) setShown(false)
    }
    animation.finished.then(done, () => {})
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || e.key !== "Tab") return
    // Every control of the open menu, in reading order: the bar (brand, actions, toggle) and the panel.
    const stops = root.current ? Array.from(root.current.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
    if (stops.length === 0) return
    const index = stops.indexOf(document.activeElement as HTMLElement)
    const next = e.shiftKey ? (index <= 0 ? stops.length - 1 : index - 1) : index === -1 || index === stops.length - 1 ? 0 : index + 1
    e.preventDefault()
    stops[next]?.focus()
  }

  return (
    <header ref={root} data-slot="overlay-menu" data-state={state} data-loader-dock="" className={cn("relative w-full", className)} onKeyDown={onKeyDown}>
      <div data-slot="overlay-menu-bar" className="relative z-[60] flex min-h-16 items-center justify-between gap-4">
        <div data-slot="overlay-menu-brand" className="flex min-h-12 items-center">
          {brand}
        </div>
        <div data-slot="overlay-menu-actions" className="flex items-center gap-2">
          {actions}
          <button
            ref={toggle}
            type="button"
            data-slot="overlay-menu-toggle"
            data-state={state}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex min-h-12 min-w-12 items-center justify-center gap-3 rounded-control px-2 type-label text-fg-primary focus-ring noscript:hidden"
            onClick={() => setOpen((o) => !o)}
          >
            <span data-slot="overlay-menu-toggle-label">{open ? closeLabel : openLabel}</span>
            <span aria-hidden="true" data-slot="overlay-menu-icon" className="relative block size-4">
              <span data-slot="overlay-menu-line" data-state={state} className="absolute inset-x-0 top-1 block motion-switch data-[state=open]:translate-y-1">
                <span data-slot="overlay-menu-stroke" data-state={state} className="block h-px bg-current motion-state data-[state=open]:rotate-45" />
              </span>
              <span data-slot="overlay-menu-line" data-state={state} className="absolute inset-x-0 top-3 block motion-switch data-[state=open]:-translate-y-1">
                <span data-slot="overlay-menu-stroke" data-state={state} className="block h-px bg-current motion-state data-[state=open]:-rotate-45" />
              </span>
            </span>
          </button>
        </div>
      </div>
      <div
        ref={panel}
        id={panelId}
        data-slot="overlay-menu-panel"
        data-state={state}
        data-visible={shown || open ? "true" : "false"}
        {...(open ? { role: "dialog", "aria-modal": true, "aria-label": label } : {})}
        className="fixed inset-0 z-50 flex flex-col justify-between gap-8 overflow-y-auto bg-surface-base pb-8 pt-24 text-fg-primary scripting:data-[visible=false]:invisible noscript:static noscript:inset-auto noscript:z-auto noscript:overflow-visible noscript:p-0"
      >
        <nav data-slot="overlay-menu-nav" aria-label={label} className="page-inset">
          <ul data-slot="overlay-menu-list" className="flex flex-col">
            {items.map((item) => (
              <li key={item.href + item.label} data-slot="overlay-menu-item" className="overflow-hidden">
                <a
                  href={item.href}
                  data-slot="overlay-menu-link"
                  data-state={item.current ? "current" : undefined}
                  aria-current={item.current ? "page" : undefined}
                  className="block min-h-12 py-1 type-display-m text-fg-primary focus-ring not-data-[state=current]:text-fg-secondary not-data-[state=current]:hover:text-fg-primary"
                  onClick={close}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {aside ? (
          <div data-slot="overlay-menu-aside" className="page-inset type-body text-fg-secondary">
            {aside}
          </div>
        ) : null}
      </div>
    </header>
  )
}
