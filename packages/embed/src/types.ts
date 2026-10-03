import type { RenderContext } from "@aleeforoughi/feather-context"
import type { Issue, ReplyEvent } from "@aleeforoughi/feather-intent"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"

/** A reference theme by name, or a brand's `feather-tokens/2` tokens. */
export type ThemeInput = "feather" | "feather-dark" | BrandTokens

export interface MountOptions {
  /** Who it is rendered for, and where (persona, capability, device, brand). Optional: the composer's defaults apply. */
  context?: RenderContext
  /** `"feather"` (default), `"feather-dark"`, or a `feather-tokens/2` brand tokens object. Applies inside Feather's roots only. */
  theme?: ThemeInput
  /** Receives the validated reply `{ experience, node, act, value? }` each time the person acts. */
  onReply?: (reply: ReplyEvent) => void
  /** Called with the validator's issues when the IR is invalid. Nothing is rendered then. */
  onIssues?: (issues: Issue[]) => void
  /** Move focus to the experience's focus node when it appears (default false: an embed never takes focus from the page). */
  autoFocus?: boolean
  /** Where the stylesheet is: a URL, or `false` when the page links `feather-embed.css` itself. Default: next to the script. */
  css?: string | false
}

export interface FeatherView {
  /** Renders a new experience (and optionally a new context) in place of the current one. */
  update(experience: unknown, context?: RenderContext): void
  /** Removes everything this view added to the page. Safe to call twice. */
  unmount(): void
  /** The element Feather renders in (a `.feather-root` inside the host element). */
  readonly root: HTMLElement
  /** Resolves when the stylesheet has loaded and the first render has been handed to React. */
  readonly ready: Promise<void>
}
