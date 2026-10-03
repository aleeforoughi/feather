import { createRoot } from "react-dom/client"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { validate, validateReply } from "@aleeforoughi/feather-intent"
import { FeatherExperience } from "@aleeforoughi/feather-manifest-web"
import { FeatherPortalProvider, TooltipProvider } from "@aleeforoughi/feather-react"
import { acquireThemeStyle, releaseThemeStyle, resolveTheme, type ResolvedTheme } from "./theme.ts"
import type { FeatherView, MountOptions } from "./types.ts"

export { validate, validateReply }

const ROOT_CLASS = "feather-root"
const NO_CONTEXT: RenderContext = {}

// What the views share: the stylesheet and the one portal host. Both go away with the last view.
let views = 0
let portalHost: HTMLElement | null = null
let stylesheet: { link: HTMLLinkElement; loaded: Promise<void> } | null = null
let counter = 0

function ensureStylesheet(href: string | false | undefined): Promise<void> {
  if (href === false) return Promise.resolve()
  if (stylesheet) return stylesheet.loaded
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = href ?? new URL(/* @vite-ignore */ "./feather-embed.css", import.meta.url).href
  link.setAttribute("data-feather-embed-css", "")
  // A stylesheet that fails to load still lets Feather render, unstyled; the page is not held up by it.
  const loaded = new Promise<void>((resolve) => {
    link.addEventListener("load", () => resolve(), { once: true })
    link.addEventListener("error", () => resolve(), { once: true })
  })
  document.head.appendChild(link)
  stylesheet = { link, loaded }
  return loaded
}

// Base UI locks the page's scroll while a modal popup is open (inline `overflow` on <html> and <body>) and gives it back
// on close, but leaves an empty `style=""` behind where there was none. The attribute is removed again, so the page's own
// markup is as it was; the observer outlives the last view by a moment, for a popup that closes while it unmounts.
let hostStyle: { observer: MutationObserver; had: Map<HTMLElement, boolean>; release?: ReturnType<typeof setTimeout> } | null = null

function watchHostStyle() {
  if (hostStyle) {
    clearTimeout(hostStyle.release)
    return
  }
  const had = new Map<HTMLElement, boolean>([
    [document.documentElement, document.documentElement.hasAttribute("style")],
    [document.body, document.body.hasAttribute("style")],
  ])
  const clean = () => {
    for (const [el, was] of had) if (!was && el.getAttribute("style") === "") el.removeAttribute("style")
  }
  const observer = new MutationObserver(clean)
  for (const el of had.keys()) observer.observe(el, { attributes: true, attributeFilter: ["style"] })
  hostStyle = { observer, had }
}

function unwatchHostStyle() {
  const watch = hostStyle
  if (!watch) return
  watch.release = setTimeout(() => {
    watch.observer.disconnect()
    for (const [el, was] of watch.had) if (!was && el.getAttribute("style") === "") el.removeAttribute("style")
    if (hostStyle === watch) hostStyle = null
  }, 250)
}

function ensurePortalHost(): HTMLElement {
  if (!portalHost) {
    portalHost = document.createElement("div")
    portalHost.className = ROOT_CLASS
    portalHost.setAttribute("data-feather-portal", "")
    document.body.appendChild(portalHost)
  }
  return portalHost
}

function rootFor(theme: ResolvedTheme): HTMLElement {
  const el = document.createElement("div")
  el.className = theme.dark ? `${ROOT_CLASS} dark` : ROOT_CLASS
  el.setAttribute("data-feather-theme", theme.id)
  return el
}

/**
 * Renders `experience` in `element` and returns the view. Everything Feather draws is inside one `.feather-root`
 * element created in `element`, plus popups in one portal host at the end of the body; the page's own elements, styles
 * and custom properties are not touched.
 */
export function mount(element: HTMLElement, experience: unknown, options: MountOptions = {}): FeatherView {
  if (typeof document === "undefined" || !(element instanceof HTMLElement)) throw new TypeError("feather-embed: mount needs an HTMLElement in a browser")
  const theme = resolveTheme(options.theme)
  views++
  watchHostStyle()
  acquireThemeStyle(theme)
  const loaded = ensureStylesheet(options.css)

  const root = rootFor(theme)
  root.setAttribute("data-feather", "")
  const portal = rootFor(theme)
  portal.setAttribute("data-feather-portal-view", "")
  element.appendChild(root)
  ensurePortalHost().appendChild(portal)

  const react = createRoot(root, { identifierPrefix: `feather${++counter}-` })
  let current = experience
  let context = options.context ?? NO_CONTEXT
  let live = true

  const render = () => {
    if (!live) return
    react.render(
      <FeatherPortalProvider container={portal}>
        <TooltipProvider>
          <FeatherExperience experience={current} context={context} onReply={(reply) => options.onReply?.(reply)} onIssues={(issues) => options.onIssues?.(issues)} autoFocus={options.autoFocus ?? false} />
        </TooltipProvider>
      </FeatherPortalProvider>,
    )
  }
  const ready = loaded.then(render)

  return {
    root,
    ready,
    update(next, nextContext) {
      if (!live) return
      current = next
      if (nextContext !== undefined) context = nextContext
      void ready.then(render)
    },
    unmount() {
      if (!live) return
      live = false
      react.unmount()
      root.remove()
      portal.remove()
      releaseThemeStyle(theme)
      if (--views === 0) {
        unwatchHostStyle()
        portalHost?.remove()
        portalHost = null
        stylesheet?.link.remove()
        stylesheet = null
      }
    },
  }
}
