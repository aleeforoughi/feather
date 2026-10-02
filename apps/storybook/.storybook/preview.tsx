import "./process-shim"
import { useLayoutEffect } from "react"
import type { Decorator, Preview } from "@storybook/react-vite"
import "../src/index.css"
import "@fontsource-variable/sora"
import "@fontsource-variable/inter"
import "@fontsource-variable/fraunces"
import "@fontsource-variable/dm-sans"
import { buildTheme } from "../scripts/apply-brand.mjs"
import voidPill from "../themes/void-pill.json"
import paperSharp from "../themes/paper-sharp.json"
import { FoundationProviders } from "../src/foundation/providers"

type Tokens = {
  colors: Record<string, string>
  typography: { fontFamily: { display: string; body: string } }
  shape: string
  density: string
  elevation: string
  motion: string
}

/** Reference themes (themes/*.json): built by the same engine that produces src/styles/brand.css in
 * production, and checked by scripts/feather-hygiene.mjs on every Feather release. */
const THEMES: Record<string, { dark: boolean; tokens: Tokens } | null> = {
  neutral: null,
  "void-pill": voidPill,
  "paper-sharp": paperSharp,
}

const STYLE_ID = "qooe-storybook-theme"

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
  <FoundationProviders>
    <ThemeApplier name={String(context.globals.theme ?? "neutral")} />
    <div className="bg-background p-6 text-foreground">
      <Story />
    </div>
  </FoundationProviders>
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
