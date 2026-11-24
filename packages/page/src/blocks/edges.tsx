// The page edges that are blocks of their own (feather.page/1): the footer and the 404. The nav and the loader are
// @aleeforoughi/feather-expression's OverlayMenu and Loader, placed by FeatherPage. The 2026 award winners finish the
// footer and the 404 as scenes (Qooler file 27 section 6: 32 and 45 of 492 sites name them); here every link stays
// plain text, and the reveal footer can never hide a focused link.
import * as React from "react"
import { DisplayTitle, Section } from "@aleeforoughi/feather-expression"
import type { FooterEdge, NotFoundEdge } from "../core/types"
import { BUTTON_PRIMARY, join } from "./shared"

export interface FooterProps {
  footer: FooterEdge
  /** The wordmark when the footer names none (the page title). */
  name?: string
}

/** Sets the wordmark as large as the footer's width allows: measured once fonts are in, and on resize. Without
 * script it is the largest display size. */
function useFitText(ref: React.RefObject<HTMLElement | null>, text: string) {
  React.useEffect(() => {
    const el = ref.current
    const box = el?.parentElement
    if (!el || !box || typeof ResizeObserver === "undefined") return
    const fit = () => {
      el.style.fontSize = ""
      const natural = el.scrollWidth
      const room = box.clientWidth
      if (natural > 0 && room > 0) el.style.fontSize = `${(parseFloat(getComputedStyle(el).fontSize) * room) / natural}px`
    }
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts
    void fonts?.ready.then(fit)
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    fit()
    return () => ro.disconnect()
  }, [ref, text])
}

/** The page's footer. `reveal` sits behind the page (sticky at the bottom, under `main`) and is uncovered as the
 * page ends; focus moving into it scrolls the page to its end first, so a focused link is never covered. */
export function Footer({ footer, name }: FooterProps) {
  const variant = footer.variant ?? "plain"
  const mark = footer.wordmark ?? name
  const markRef = React.useRef<HTMLParagraphElement>(null)
  useFitText(markRef, variant === "plain" ? "" : (mark ?? ""))
  const onFocus = variant === "reveal" ? () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" as ScrollBehavior }) : undefined
  return (
    <footer
      data-slot="page-footer"
      data-variant={variant}
      onFocus={onFocus}
      className={join("bg-surface-subtle text-fg-primary", variant === "reveal" && "sticky bottom-0 z-0 max-h-svh overflow-y-auto")}
    >
      <div data-slot="page-footer-inner" className="page-grid section-space-m gap-y-12">
        {footer.body ? (
          <p data-slot="page-footer-body" className="col-span-full max-w-prose type-body-lg text-prose text-fg-secondary md:col-span-8">
            {footer.body}
          </p>
        ) : null}
        {footer.links?.length ? (
          <ul data-slot="page-footer-links" role="list" className="col-span-full flex flex-wrap gap-x-8 gap-y-2">
            {footer.links.map((l) => (
              <li key={l.href} data-slot="page-footer-item">
                <a href={l.href} data-slot="page-footer-link" className="inline-flex min-h-12 items-center type-label text-fg-primary underline-offset-4 hover:underline focus-ring">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {variant !== "plain" && mark ? (
          <div data-slot="page-footer-wordmark-box" className="col-span-full overflow-hidden">
            <p ref={markRef} data-slot="page-footer-wordmark" aria-hidden="true" className="w-max whitespace-nowrap type-display-xl text-fg-primary transition-none">
              {mark}
            </p>
          </div>
        ) : null}
        {footer.note ? (
          <p data-slot="page-footer-note" className="col-span-full type-caption text-fg-secondary">
            {footer.note}
          </p>
        ) : null}
      </div>
    </footer>
  )
}

export interface NotFoundProps {
  notFound: NotFoundEdge
}

/** The 404 as a small scene: one h1 that says what happened, the number as display type (decorative), and the way
 * home as the one primary act. */
export function NotFound({ notFound }: NotFoundProps) {
  const variant = notFound.variant ?? "type"
  const home = notFound.home?.[0] ?? { label: "Back to the start", href: "/" }
  return (
    <Section data-block="not-found" data-variant={variant} aria-labelledby="not-found-title" space="xl">
      <div data-slot="not-found" className="col-span-full flex min-h-[60svh] flex-col justify-center gap-8 md:col-span-10">
        {variant === "type" ? (
          <DisplayTitle as="p" size="xl" split="char" aria-hidden="true" data-slot="not-found-number">
            404
          </DisplayTitle>
        ) : null}
        <h1 id="not-found-title" data-slot="not-found-title" className="type-heading-1 text-fg-primary">
          {notFound.title ?? "This page is not here"}
        </h1>
        {notFound.body ? (
          <p data-slot="not-found-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
            {notFound.body}
          </p>
        ) : null}
        <p data-slot="not-found-actions">
          <a href={home.href} data-slot="not-found-home" className={BUTTON_PRIMARY}>
            {home.label}
          </a>
        </p>
      </div>
    </Section>
  )
}
