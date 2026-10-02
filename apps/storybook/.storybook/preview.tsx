import { useLayoutEffect } from "react"
import type { Decorator, Preview } from "@storybook/react-vite"
import "./preview.css"
import "@aleeforoughi/feather-tokens/fonts/sora.css"
import "@aleeforoughi/feather-tokens/fonts/inter.css"
import "@aleeforoughi/feather-tokens/fonts/fraunces.css"
import "@aleeforoughi/feather-tokens/fonts/dm-sans.css"
import { buildTheme, type BrandTokens } from "@aleeforoughi/feather-tokens"
import voidPill from "@aleeforoughi/feather-tokens/themes/void-pill.json"
import paperSharp from "@aleeforoughi/feather-tokens/themes/paper-sharp.json"
// From source, not the package build: the stories import their components from source, and providers must be
// the same module instances as the components that read them.
import { FeatherProvider } from "../../../packages/react/src/provider"

/** Reference themes (@aleeforoughi/feather-tokens/themes): built by the same engine that writes a product's
 * brand.css, and checked by scripts/feather-hygiene.mjs on every Feather release. */
const THEMES: Record<string, { dark: boolean; tokens: BrandTokens } | null> = {
  neutral: null,
  "void-pill": voidPill as { dark: boolean; tokens: BrandTokens },
  "paper-sharp": paperSharp as { dark: boolean; tokens: BrandTokens },
}

const STYLE_ID = "feather-storybook-theme"

function ThemeApplier({ name }: { name: string }) {
  useLayoutEffect(() => {
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
  }, [name])
  return null
}

const withFoundation: Decorator = (Story, context) => (
  <FeatherProvider>
    <ThemeApplier name={String(context.globals.theme ?? "neutral")} />
    <div className="bg-background p-6 text-foreground">
      <Story />
    </div>
  </FeatherProvider>
)

const preview: Preview = {
  decorators: [withFoundation],
  globalTypes: {
    theme: {
      description: "Reference theme (built with the production theme engine)",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        dynamicTitle: true,
        items: [
          { value: "neutral", title: "Neutral" },
          { value: "void-pill", title: "Void Pill (dark)" },
          { value: "paper-sharp", title: "Paper Sharp (light)" },
        ],
      },
    },
  },
  initialGlobals: { theme: "neutral" },
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
}

export default preview
