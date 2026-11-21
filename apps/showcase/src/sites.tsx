// Three reference brands from one page schema (W4): the same feather.page/0 document, rendered in Studio, Portrait
// and Seed. Only the tokens change. The model is off: the starters play the prepared scenes.
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { FeatherPage, validatePage } from "@aleeforoughi/feather-page"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import doc from "../../../packages/page/examples/studio-of-one.page.json"
import "./sites.css"

const BRANDS: Record<string, { dark: boolean; tokens: unknown }> = { studio, portrait, seed }
const name = new URLSearchParams(location.search).get("brand") ?? "studio"
const brand = BRANDS[name] ?? studio
document.documentElement.classList.toggle("dark", brand.dark)
document.documentElement.dataset.brand = name

const result = validatePage(doc)
if (!result.ok) throw new Error(result.issues.map((i) => `${i.path} ${i.code}`).join("\n"))

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <nav aria-label="Brands" data-slot="brand-switch" className="flex justify-center gap-4 bg-surface-base p-2 type-caption text-fg-secondary">
      {Object.keys(BRANDS).map((b) => (
        <a key={b} href={`?brand=${b}`} aria-current={b === name ? "page" : undefined} className="underline-offset-4 aria-[current=page]:text-fg-primary aria-[current=page]:underline">
          {b}
        </a>
      ))}
    </nav>
    <FeatherPage page={result.page} tokens={brand.tokens as BrandTokens} />
  </StrictMode>
)
