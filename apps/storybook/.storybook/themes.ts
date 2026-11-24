// The reference brands and the one function that puts a theme on the page. Stories (through the decorator in
// preview.tsx) and docs pages (through the docs container) both call it, so the toolbar's brand switcher restyles
// both the same way.
import { buildTheme, type BrandTokens } from "@aleeforoughi/feather-tokens"
import voidPill from "@aleeforoughi/feather-tokens/themes/void-pill.json"
import paperSharp from "@aleeforoughi/feather-tokens/themes/paper-sharp.json"
import feather from "@aleeforoughi/feather-tokens/themes/feather.json"
import featherDark from "@aleeforoughi/feather-tokens/themes/feather-dark.json"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"

export interface ReferenceBrand {
  dark: boolean
  tokens: BrandTokens
}

/** Reference themes (@aleeforoughi/feather-tokens/themes): built by the same engine that writes a product's
 * brand.css, and checked by scripts/feather-hygiene.mjs on every Feather release. */
export const THEMES: Record<string, ReferenceBrand> = {
  feather: feather as ReferenceBrand,
  "feather-dark": featherDark as ReferenceBrand,
  "paper-sharp": paperSharp as ReferenceBrand,
  "void-pill": voidPill as ReferenceBrand,
  // feather-tokens/3 brands: the website layer's three reference routes.
  studio: studio as ReferenceBrand,
  portrait: portrait as ReferenceBrand,
  seed: seed as ReferenceBrand,
}

/** The toolbar's entries, in the order the sidebar and the docs name the brands. */
export const THEME_ITEMS = [
  { value: "feather", title: "Feather (default)" },
  { value: "feather-dark", title: "Feather dark" },
  { value: "paper-sharp", title: "Paper Sharp (light)" },
  { value: "void-pill", title: "Void Pill (dark)" },
  { value: "studio", title: "Studio (/4, dark, cinematic)" },
  { value: "portrait", title: "Portrait (/4, paper)" },
  { value: "seed", title: "Seed (/4, glass)" },
]

export const STYLE_ID = "feather-storybook-theme"
/** Fired on window after a theme is applied, so a docs page that reads computed values can read them again. */
export const THEME_EVENT = "feather-theme-applied"

/** Applies the named reference brand (or the bare foundation for an unknown name): its CSS in one style tag, and the
 * `dark` class for a dark one. */
export function applyTheme(name: string) {
  const theme = THEMES[name] ?? null
  document.getElementById(STYLE_ID)?.remove()
  if (theme) {
    const built = buildTheme(theme.tokens)
    if (built.ok) {
      const style = document.createElement("style")
      style.id = STYLE_ID
      style.textContent = built.css
      document.head.appendChild(style)
    } else {
      console.error("Theme failed:", built.problems)
    }
  }
  document.documentElement.classList.toggle("dark", theme?.dark ?? false)
  window.dispatchEvent(new Event(THEME_EVENT))
}
