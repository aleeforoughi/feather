// feather-page-runtime.js: the browser runtime of a Feather page, as the release ships it. A static page built by
// `feather-page build --runtime` carries its document and brand as JSON and this module; the runtime hydrates the
// server markup, so the motion, the loader, the menu and the Living Page come alive without a re-render. It also
// mounts a page document into any element (`mount`), for a host that renders on the client only. Its styles are
// feather-page.css, released beside it.
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { FeatherPage, mountPage, PageNotFound, PreparedPage, validatePage, type MountedPage, type PageDocument } from "@aleeforoughi/feather-page"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"

export { validatePage }

export interface RuntimeOptions {
  /** The brand's tokens, when the document's `brand` is a path the browser cannot read. */
  tokens?: BrandTokens
  /** Render the page's 404 instead of the page. */
  notFound?: boolean
  /** Render one prepared scene as its route (its intent), with links to the others under `base`. */
  intent?: string
  base?: string
}

const checked = (doc: unknown): PageDocument => {
  const r = validatePage(doc)
  if (!r.ok) throw new Error(`Not a valid feather.page document:\n${r.issues.map((i) => `- ${i.path || "/"} ${i.code}: ${i.message}`).join("\n")}`)
  return r.page
}
const element = (page: PageDocument, { tokens, notFound, intent, base = "/" }: RuntimeOptions) => (
  <StrictMode>
    {notFound ? (
      <PageNotFound page={page} tokens={tokens} />
    ) : intent ? (
      <PreparedPage page={page} intent={intent} tokens={tokens} href={(i) => `${base.endsWith("/") ? base : `${base}/`}${i}`} />
    ) : (
      <FeatherPage page={page} tokens={tokens} />
    )}
  </StrictMode>
)

/** Mounts a page document into a container (client rendering, in a transition: see mountPage). */
export function mount(container: Element, doc: unknown, options: RuntimeOptions = {}): MountedPage {
  return mountPage(container, element(checked(doc), options))
}

/** Hydrates server markup that `feather-page build --runtime` wrote: the same document, the same brand. */
export function hydrate(container: Element, doc: unknown, options: RuntimeOptions = {}): void {
  hydrateRoot(container, element(checked(doc), options))
}

// A built page boots itself: <div data-feather-page-root> with a sibling <script type="application/json" data-feather-page>.
if (typeof document !== "undefined") {
  const root = document.querySelector("[data-feather-page-root]")
  const data = document.querySelector('script[type="application/json"][data-feather-page]')
  if (root && data?.textContent) {
    const { page, ...options } = JSON.parse(data.textContent) as { page: unknown } & RuntimeOptions
    hydrate(root, page, options)
  }
}
