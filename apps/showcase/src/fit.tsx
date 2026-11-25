// The fit page (e2e/fit.spec.ts): every hero, numbers, statement, case and timeline variant, at loudness 0 and 3, set
// in stress copy — German compounds, titles of 60 characters and more, long units and word values — so the gate can
// prove that display type never runs past its box, never overlaps the copy around it and never breaks inside a word
// that would fit. One page per brand; each document is a complete FeatherPage in its own `lang`.
//   ?brand=studio|portrait|seed   the brand
import { StrictMode } from "react"
import { FeatherPage, mountPage } from "@aleeforoughi/feather-page"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import { fitDocuments } from "./fit-pages"
import "./sites.css"

const BRANDS: Record<string, { dark: boolean; tokens: unknown }> = { studio, portrait, seed }
const name = new URLSearchParams(location.search).get("brand") ?? "studio"
const brand = BRANDS[name] ?? studio
document.documentElement.classList.toggle("dark", brand.dark)
document.documentElement.dataset.brand = name

const tokens = brand.tokens as BrandTokens
mountPage(
  document.getElementById("root")!,
  <StrictMode>
    {fitDocuments().map(({ key, page }) => (
      <div key={key} data-fit-doc={key} lang={page.lang}>
        <FeatherPage page={page} tokens={tokens} />
      </div>
    ))}
  </StrictMode>
)
