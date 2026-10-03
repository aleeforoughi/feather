// The reference themes, applied as apps/storybook/.storybook/preview.tsx does: the production theme engine builds the
// CSS, and the page's `dark` class follows the theme.
import { buildTheme, type BrandTokens } from "@aleeforoughi/feather-tokens"
import voidPill from "@aleeforoughi/feather-tokens/themes/void-pill.json"
import paperSharp from "@aleeforoughi/feather-tokens/themes/paper-sharp.json"

export const THEME_NAMES = ["paper-sharp", "void-pill", "neutral"] as const
export type ThemeName = (typeof THEME_NAMES)[number]

const THEMES: Record<ThemeName, { dark: boolean; tokens: BrandTokens } | null> = {
  neutral: null,
  "void-pill": voidPill as { dark: boolean; tokens: BrandTokens },
  "paper-sharp": paperSharp as { dark: boolean; tokens: BrandTokens },
}

const STYLE_ID = "feather-playground-theme"

export function applyTheme(name: ThemeName) {
  const theme = THEMES[name]
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
}
