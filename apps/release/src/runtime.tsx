// feather-page-runtime.js: the browser runtime of a Feather page, as the release ships it. A static page built by
// `feather-page build --runtime` carries its document and brand as JSON and this module; the runtime hydrates the
// server markup, so the motion, the loader, the menu and the Living Page come alive without a re-render. It also
// mounts a page document into any element (`mount`), for a host that renders on the client only. Its styles are
// feather-page.css, released beside it.
//
// The runtime carries the Living Page's library only. The page blocks come in families of their own, beside it:
// feather-page-media.js (gallery, comparison, story, testimonials, journal, form, showreel) and feather-page-flows.js
// (quiz, booking, calculator, chart, places, podcast, and the scheme toggle and the work's view switch), each loaded
// only for a page whose document uses it. hydrate loads them before it hydrates, so the server's markup is matched by the same components with no flash
// and no mismatch; mount renders them as lazy components under one Suspense boundary.
import { lazy, StrictMode, Suspense } from "react"
import { hydrateRoot } from "react-dom/client"
import { FeatherPageCore as FeatherPage, loadPageBlocks, mountPage, PageNotFoundCore as PageNotFound, PreparedPage, validateLoaded, type MountedPage, type PageDocument, type PageFamilies, type PageResult, type BlockLibrary } from "@aleeforoughi/feather-page/runtime"
import type { AskHandler } from "@aleeforoughi/feather-living"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"

/** validatePage with every rule the runtime holds: the core's always, and the product flows' once their family has
 * loaded (hydrate and mount load it for any page that uses a flow). */
export function validatePage(doc: unknown): PageResult {
  return validateLoaded(doc)
}

export interface RuntimeOptions {
  /** The brand's tokens, when the document's `brand` is a path the browser cannot read. */
  tokens?: BrandTokens
  /** Render the page's 404 instead of the page. */
  notFound?: boolean
  /** Render one prepared scene as its route (its intent), with links to the others under `base`. */
  intent?: string
  base?: string
  /** The host's model, streamed, for the Living Page: an ask (a starter, or one typed) that no prepared scene answers
   * goes to it. Without one, only the prepared scenes answer. Given to mount, or to hydrate called by the host. */
  onAsk?: AskHandler
  /** The brand's own block designs, over the defaults and the families the page loads. */
  blocks?: Partial<BlockLibrary>
}

const checked = (doc: unknown): PageDocument => {
  const r = validateLoaded(doc)
  if (!r.ok) throw new Error(`Not a valid feather.page document:\n${r.issues.map((i) => `- ${i.path || "/"} ${i.code}: ${i.message}`).join("\n")}`)
  return r.page
}
const element = (page: PageDocument, { tokens, notFound, intent, base = "/", onAsk, blocks: own }: RuntimeOptions, { blocks: loaded, parts }: PageFamilies) => {
  const blocks = own ? { ...loaded, ...own } : loaded
  return (
    <StrictMode>
      {notFound ? (
        <PageNotFound page={page} tokens={tokens} parts={parts} />
      ) : intent ? (
        <PreparedPage page={page} intent={intent} tokens={tokens} blocks={blocks} href={(i) => `${base.endsWith("/") ? base : `${base}/`}${i}`} />
      ) : (
        <FeatherPage page={page} tokens={tokens} blocks={blocks} parts={parts} onAsk={onAsk} />
      )}
    </StrictMode>
  )
}

/** Mounts a page document into a container (client rendering, in a transition: see mountPage). An invalid document
 * throws at once; the page appears whole once the block families it uses have loaded, and is checked again then with
 * their rules. */
export function mount(container: Element, doc: unknown, options: RuntimeOptions = {}): MountedPage {
  checked(doc)
  const Page = lazy(async () => {
    const families = await loadPageBlocks(doc)
    const page = checked(doc)
    return { default: () => element(page, options, families) }
  })
  return mountPage(
    container,
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  )
}

/** Hydrates server markup that `feather-page build --runtime` wrote: the same document, the same brand. The block
 * families the page uses load first (the server's markup stays as it is meanwhile), then the page is checked with every
 * rule and hydrates. */
export async function hydrate(container: Element, doc: unknown, options: RuntimeOptions = {}): Promise<void> {
  // A prepared scene holds only the living library; a 404 needs only the scheme toggle, which comes with the flows.
  const families = options.intent ? { blocks: {}, parts: {} } : await loadPageBlocks(options.notFound && typeof doc === "object" && doc ? { ...doc, sections: [] } : doc)
  hydrateRoot(container, element(checked(doc), options, families))
}

// A built page boots itself: <div data-feather-page-root> with a sibling <script type="application/json" data-feather-page>.
if (typeof document !== "undefined") {
  const root = document.querySelector("[data-feather-page-root]")
  const data = document.querySelector('script[type="application/json"][data-feather-page]')
  if (root && data?.textContent) {
    const { page, ...options } = JSON.parse(data.textContent) as { page: unknown } & RuntimeOptions
    void hydrate(root, page, options)
  }
}
