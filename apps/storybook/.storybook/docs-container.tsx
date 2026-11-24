// Docs pages (MDX) are not stories, so the story decorator never runs for them. This container wraps every docs page
// in Feather's provider and applies the toolbar's brand, so a page that reads the theme (Tokens, Motion, Loudness)
// follows the brand switcher exactly as a story does.
import { useEffect, type ComponentProps } from "react"
import { DocsContainer } from "@storybook/addon-docs/blocks"
import { GLOBALS_UPDATED } from "storybook/internal/core-events"
import { FeatherProvider } from "../../../packages/react/src/provider"
import { applyTheme } from "./themes"

type Props = ComponentProps<typeof DocsContainer>
type Globals = { theme?: unknown }
type Channel = { on: (event: string, fn: (payload: unknown) => void) => void; off: (event: string, fn: (payload: unknown) => void) => void }

const fromUrl = () => {
  // The manager passes the current globals on the iframe URL: "?globals=theme:studio".
  const raw = new URLSearchParams(window.location.search).get("globals") ?? ""
  return /(?:^|;)theme:([a-z0-9-]+)/.exec(raw)?.[1]
}

export function FeatherDocsContainer({ children, context, ...props }: Props) {
  useEffect(() => {
    const store = (context as unknown as { store?: { userGlobals?: { get?: () => Globals } } }).store
    const current = store?.userGlobals?.get?.()?.theme
    applyTheme(String(current ?? fromUrl() ?? "feather"))
    const channel = (context as unknown as { channel?: Channel }).channel
    const onGlobals = (payload: unknown) => {
      const p = payload as { userGlobals?: Globals; globals?: Globals }
      const theme = p?.userGlobals?.theme ?? p?.globals?.theme
      if (typeof theme === "string") applyTheme(theme)
    }
    channel?.on(GLOBALS_UPDATED, onGlobals)
    return () => channel?.off(GLOBALS_UPDATED, onGlobals)
  }, [context])
  return (
    <DocsContainer context={context} {...props}>
      <FeatherProvider>{children}</FeatherProvider>
    </DocsContainer>
  )
}
