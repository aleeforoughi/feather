// mountPage: how a host puts a page on screen. A page is long (every section, display titles split into words,
// counters, media), and a plain root.render builds all of it in one blocking task: on a throttled phone that alone
// breaks the 200ms TBT budget (docs/visual-system.md section 14.4). Rendering in a transition lets React yield to
// the main thread every few milliseconds while it builds, so input and paint are never held for long.
import { startTransition, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"

export interface MountedPage {
  /** Renders a new node into the same root (also in a transition). */
  render(node: ReactNode): void
  unmount(): void
}

/** Mounts `node` (a FeatherPage, with any host chrome around it) into `container`, rendered in a transition. */
export function mountPage(container: Element, node: ReactNode): MountedPage {
  const root: Root = createRoot(container)
  const render = (next: ReactNode) => startTransition(() => root.render(next))
  render(node)
  return { render, unmount: () => root.unmount() }
}
