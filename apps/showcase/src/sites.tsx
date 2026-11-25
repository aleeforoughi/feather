// Three reference brands from one page schema: the same feather.page/1 document, rendered in Studio, Portrait and
// Seed. Only the tokens change. The model is off: the starters play the prepared scenes.
//   ?brand=studio|portrait|seed   the brand
//   ?page=loud                    the loud reference page (loudness 3, the expressive variants); default the reference page
//   ?page=media                   the media reference page (loudness 2: gallery, comparison, story, testimonials, the
//                                 wheel, journal, the toggle offer and the form)
//   ?page=flows                   the product-flows page (wave 5): quiz, calculator, charts, booking, podcast, places, the
//                                 work's view switch and the colour scheme toggle (each brand with its other colour set)
//   ?template=<name>              one of the six page templates (wave 5: launch, studio, editorial, service, product,
//                                 creator), each with its own layout; overrides ?page
//   ?view=404                     the page's 404 route (PageNotFound)
//   ?loader=counter|dock          adds the page's loader (wave 1 e2e; the budget pages run without one)
//   ?sound=1                      adds an ambient bed (the nav's toggle) and the loader's sound choice
//   ?transition=<variant>         how a brand switch arrives (default the page's own `transition`)
//   ?hero=poster                  the loud page's hero scene at quality poster (the scene e2e, so a software-rendered
//                                 shader does not run while it inspects the model further down)
// Switching brands is an in-page route change through createTransitions().go(), so every route variant can be seen
// and tested here; a static site built by `feather-page build` uses cross-document View Transitions instead.
import { StrictMode } from "react"
import { createTransitions, type RouteVariant } from "@aleeforoughi/feather-expression"
import { FeatherPage, mountPage, PageNotFound, validatePage, type PageDocument } from "@aleeforoughi/feather-page"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import reference from "../../../packages/page/examples/studio-of-one.page.json"
import loud from "../../../packages/page/examples/studio-of-one-loud.page.json"
import media from "../../../packages/page/examples/studio-of-one-media.page.json"
import flows from "../../../packages/page/examples/studio-of-one-flows.page.json"
import launch from "../../../packages/page/templates/launch.page.json"
import studioTemplate from "../../../packages/page/templates/studio.page.json"
import editorial from "../../../packages/page/templates/editorial.page.json"
import service from "../../../packages/page/templates/service.page.json"
import product from "../../../packages/page/templates/product.page.json"
import creator from "../../../packages/page/templates/creator.page.json"
import schemes from "./schemes.json"
import "./sites.css"

const BRANDS: Record<string, { dark: boolean; tokens: unknown }> = { studio, portrait, seed }
const params = new URLSearchParams(location.search)
const loader = params.get("loader")
const pageParam = params.get("page")
const TEMPLATES: Record<string, unknown> = { launch, studio: studioTemplate, editorial, service, product, creator }
const template = params.get("template")
if (template !== null && !TEMPLATES[template]) throw new Error(`?template=${template}: the templates are ${Object.keys(TEMPLATES).join(", ")}`)
const doc = (template ? TEMPLATES[template] : pageParam === "loud" ? loud : pageParam === "flows" ? flows : pageParam === "media" ? media : reference) as typeof reference

const withSound = params.get("sound") === "1"
const heroPoster = (sections: typeof doc.sections) => sections.map((b, i) => (i === 0 && "scene" in b && b.scene ? { ...b, scene: { ...b.scene, quality: "poster" } } : b))
const result = validatePage({
  ...doc,
  ...(params.get("hero") === "poster" ? { sections: heroPoster(doc.sections) } : {}),
  ...(loader === "counter" || loader === "dock" ? { loader: { variant: loader, label: "Loading the studio of one", ...(withSound ? { sound: true } : {}) } } : {}),
  ...(withSound ? { sound: { bed: "media/bed.mp3" } } : {}),
})
if (!result.ok) throw new Error(result.issues.map((i) => `${i.path} ${i.code}`).join("\n"))
const page: PageDocument = result.page
const variant = (params.get("transition") ?? page.transition ?? "fade") as RouteVariant
const transitions = createTransitions()

/** A page with a colour scheme toggle takes the brand's own other set (each reference brand has one scheme). */
const SCHEMES = schemes as Record<string, NonNullable<PageDocument["scheme"]>["colors"]>
const forBrand = (name: string): PageDocument => (page.scheme ? { ...page, scheme: { ...page.scheme, colors: SCHEMES[name] ?? page.scheme.colors } } : page)

function view(name: string) {
  const brand = BRANDS[name] ?? studio
  document.documentElement.classList.toggle("dark", brand.dark)
  document.documentElement.dataset.brand = name
  const tokens = brand.tokens as BrandTokens
  const branded = forBrand(name)
  return (
    <StrictMode>
      <nav aria-label="Brands" data-slot="brand-switch" className="flex justify-center gap-4 bg-surface-base p-2 type-caption text-fg-secondary">
        {Object.keys(BRANDS).map((b) => (
          <a key={b} href={`?${new URLSearchParams({ ...Object.fromEntries(params), brand: b })}`} aria-current={b === name ? "page" : undefined} className="underline-offset-4 aria-[current=page]:text-fg-primary aria-[current=page]:underline">
            {b}
          </a>
        ))}
      </nav>
      {params.get("view") === "404" ? <PageNotFound page={branded} tokens={tokens} /> : <FeatherPage page={branded} tokens={tokens} />}
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
