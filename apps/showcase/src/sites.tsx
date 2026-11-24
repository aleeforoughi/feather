// Three reference brands from one page schema: the same feather.page/1 document, rendered in Studio, Portrait and
// Seed. Only the tokens change. The model is off: the starters play the prepared scenes.
//   ?brand=studio|portrait|seed   the brand
//   ?view=404                     the page's 404 route (PageNotFound)
//   ?loader=counter|dock          adds the page's loader (wave 1 e2e; the budget pages run without one)
//   ?transition=<variant>         how a brand switch arrives (default the page's own `transition`)
// Switching brands is an in-page route change through createTransitions().go(), so every route variant can be seen
// and tested here; a static site built by `feather-page build` uses cross-document View Transitions instead.
import { StrictMode } from "react"
import { createTransitions, type RouteVariant } from "@aleeforoughi/feather-expression"
import { FeatherPage, mountPage, PageNotFound, validatePage, type PageDocument } from "@aleeforoughi/feather-page"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import doc from "../../../packages/page/examples/studio-of-one.page.json"
import "./sites.css"

const BRANDS: Record<string, { dark: boolean; tokens: unknown }> = { studio, portrait, seed }
const params = new URLSearchParams(location.search)
const loader = params.get("loader")

const result = validatePage(loader === "counter" || loader === "dock" ? { ...doc, loader: { variant: loader, label: "Loading the studio of one" } } : doc)
if (!result.ok) throw new Error(result.issues.map((i) => `${i.path} ${i.code}`).join("\n"))
const page: PageDocument = result.page
const variant = (params.get("transition") ?? page.transition ?? "fade") as RouteVariant
const transitions = createTransitions()

function view(name: string) {
  const brand = BRANDS[name] ?? studio
  document.documentElement.classList.toggle("dark", brand.dark)
  document.documentElement.dataset.brand = name
  const tokens = brand.tokens as BrandTokens
  return (
    <StrictMode>
      <nav aria-label="Brands" data-slot="brand-switch" className="flex justify-center gap-4 bg-surface-base p-2 type-caption text-fg-secondary">
        {Object.keys(BRANDS).map((b) => (
          <a key={b} href={`?brand=${b}`} aria-current={b === name ? "page" : undefined} className="underline-offset-4 aria-[current=page]:text-fg-primary aria-[current=page]:underline">
            {b}
          </a>
        ))}
      </nav>
      {params.get("view") === "404" ? <PageNotFound page={page} tokens={tokens} /> : <FeatherPage page={page} tokens={tokens} />}
    </StrictMode>
  )
}

const root = document.getElementById("root")!
const mounted = mountPage(root, view(params.get("brand") ?? "studio"))

// A brand switch is a route change: the URL updates, the old route's listeners are disposed, the new one arrives
// with the chosen variant, and focus lands on its h1. Modified clicks (a new tab) are left to the browser.
root.addEventListener("click", (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('[data-slot="brand-switch"] a')
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  const next = new URL(link.href).searchParams.get("brand") ?? "studio"
  params.set("brand", next)
  history.pushState(null, "", `?${params}`)
  void transitions.go(() => mounted.swap(view(next)), { variant })
})
addEventListener("popstate", () => mounted.swap(view(new URLSearchParams(location.search).get("brand") ?? "studio")))
