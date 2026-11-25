import { useLayoutEffect } from "react"
import type { Decorator, Preview } from "@storybook/react-vite"
import "./preview.css"
import "@aleeforoughi/feather-tokens/fonts/sora.css"
import "@aleeforoughi/feather-tokens/fonts/inter.css"
import "@aleeforoughi/feather-tokens/fonts/fraunces.css"
import "@aleeforoughi/feather-tokens/fonts/dm-sans.css"
import "@aleeforoughi/feather-tokens/fonts/jetbrains-mono.css"
import { applyTheme, THEME_ITEMS } from "./themes"
import "@aleeforoughi/feather-tokens/fonts/space-grotesk.css"
// From source, not the package build: the stories import their components from source, and providers must be
// the same module instances as the components that read them.
import { featherTheme } from "./feather-theme"
import { FeatherProvider } from "../../../packages/react/src/provider"
import { FeatherDocsContainer } from "./docs-container"

function ThemeApplier({ name }: { name: string }) {
  useLayoutEffect(() => applyTheme(name), [name])
  return null
}

const withFoundation: Decorator = (Story, context) => (
  <FeatherProvider>
    <ThemeApplier name={String(context.globals.theme ?? "feather")} />
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
        items: THEME_ITEMS,
      },
    },
  },
  initialGlobals: { theme: "feather" },
  parameters: {
    layout: "centered",
    // Docs pages in the default theme's font.
    docs: { theme: featherTheme, container: FeatherDocsContainer },
    options: {
      // Sidebar order. Story titles are unchanged (visual baselines are keyed by story id): only the order moves.
      storySort: {
        method: "",
        order: [
          "Foundations",
          ["Introduction", "Tokens", "Motion", "Loudness", "Three tiers", "Accessibility floor", "Theme builder"],
          "Atoms",
          "Molecules",
          "Organisms",
          "Experiences",
          "Website",
          "Living",
          "Pages",
        ],
      },
    },
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
