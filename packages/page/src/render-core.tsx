// FeatherPage: a validated feather.page/0 document, rendered as a complete website in the brand's tokens, with the
// Living Page layered on when the document has one. Deterministic: the same page, brand and host give the same DOM.
import * as React from "react"
import { buildTheme, type BrandTokens } from "@aleeforoughi/feather-tokens"
import { Cursor, Loader, OverlayMenu, SoundToggle } from "@aleeforoughi/feather-expression"
import { LivingPage, PreparedSceneView, createRegistry, useLivingAsk, type AskHandler, type Block, type BlockKind, type PreparedScene, type Speaker } from "@aleeforoughi/feather-living"
import { coreBlocks } from "./blocks/core"
import type { BlockProps } from "./blocks/shared"
import { Footer, NotFound } from "./blocks/edges"
import { CursorLabels } from "./blocks/shared"
import { isDarkTheme, schemeCss } from "./blocks/scheme-css"
import { PagePartsContext, type PageParts } from "./blocks/parts"
import { PageContext, type PageContextValue } from "./blocks/knobs"
import { resolveRefs } from "./core/validate-core"
import { layoutPlan, type LayoutPlan } from "./core/layouts"
import type { BlockName, PageBlock, PageDocument, PageIssue, PageScheme } from "./core/types"

export type BlockLibrary = { [K in BlockName]: React.ComponentType<BlockProps<K>> }

export interface FeatherPageProps {
  /** A page that passed validatePage. */
  page: PageDocument
  /** The brand's tokens, resolved by the host from `page.brand` (or `page.brand` itself when inline). Omit to keep the
   * theme the host already applied. */
  tokens?: BrandTokens
  /** The brand's own block designs, over the defaults. */
  blocks?: Partial<BlockLibrary>
  /** The host's model, streamed. Without it, only prepared scenes answer (the model-off path). */
  onAsk?: AskHandler
  /** The flows' page-level parts (the scheme toggle, the work's view switch): FeatherPage gives them; the release
   * runtime gives them once the flows family has loaded. */
  parts?: PageParts
}

/** The prepared scenes of a page, in the Living Page's shape. */
export function pageScenes(page: PageDocument): PreparedScene[] {
  const scenes = page.scenes ?? {}
  const prepared = page.living?.prepared ?? Object.keys(scenes)
  return prepared.filter((k) => scenes[k]).map((intent) => ({ intent, ask: scenes[intent].ask, line: scenes[intent].line, blocks: scenes[intent].blocks as unknown as Block[], asks: scenes[intent].asks }))
}

/** One block of the page, through the library. The first block is the LCP: its media loads first. */
function PageBlockView({ block, library, priority }: { block: PageBlock; library: BlockLibrary; priority: boolean }) {
  const onAsk = useLivingAsk() ?? undefined
  const Component = library[block.block] as React.ComponentType<BlockProps<BlockName>>
  return <Component block={block as never} priority={priority} onAsk={onAsk} />
}

/**
 * FeatherPage over the Living Page's library alone (coreBlocks): the page blocks come in `blocks`. The release runtime
 * renders this, handing it the families the page uses (blocks/families.ts); FeatherPage (render.tsx) hands it all of
 * them.
 */
export function FeatherPageCore({ page, tokens, blocks, onAsk, parts = NO_PARTS }: FeatherPageProps) {
  const resolved = React.useMemo(() => resolveRefs(page), [page])
  const library = React.useMemo(() => ({ ...coreBlocks, ...blocks }) as BlockLibrary, [blocks])
  const brand = tokens ?? (typeof page.brand === "object" ? (page.brand as unknown as BrandTokens) : undefined)
  const theme = React.useMemo(() => (brand ? buildTheme(brand) : null), [brand])
  const context = usePageContext(resolved)
  const { other, css: scheme } = useSchemeCss(brand, theme, page.scheme)
  const plan = useLayoutPlan(resolved, theme, other)
  if (theme && !theme.ok) throw new Error(`FeatherPage: the brand does not compile:\n- ${theme.problems.join("\n- ")}`)

  const base = resolved.sections.map((block, i) => {
    const { ground, hang } = plan.sections[i] ?? {}
    return (
      <div key={block.id ?? i} data-living-section={block.id ?? `section-${i + 1}`} {...(ground ? { "data-ground": ground } : {})} {...(hang ? { "data-hang": "" } : {})}>
        <PageBlockView block={block} library={library} priority={i === 0} />
      </div>
    )
  })

  const head = <ThemeHead theme={theme} scheme={scheme} />

  const content = !resolved.living || !resolved.speaker ? base : (
    <LivingPageFor page={resolved} library={library} onAsk={onAsk}>
      {base}
    </LivingPageFor>
  )
  return (
    <PagePartsContext.Provider value={parts}>
      <PageContext.Provider value={context}>
        <PageFrame page={resolved} head={head} plan={plan}>
          {content}
        </PageFrame>
      </PageContext.Provider>
    </PagePartsContext.Provider>
  )
}

const NO_PARTS: PageParts = {}

/** The brand's open-font faces (theme.fonts): its @font-face rules, without the `@import` lines, which are bundler paths
 * for the foundation families (a product's stylesheet already carries those faces). Null when the brand has none. */
export function fontFaces(fonts: string | undefined): string | null {
  if (!fonts || !fonts.includes("@font-face")) return null
  return fonts
    .split("\n")
    .filter((line) => !/^\s*@import\s/.test(line))
    .join("\n")
    .trim()
}

type Theme = ReturnType<typeof buildTheme>
type Compiled = Extract<Theme, { ok: true }>

/** The page's other colour scheme (`scheme`, wave 5): the brand's tokens with the scheme's colours, compiled by the
 * same engine (schemeCss writes the CSS that applies it). Null without a scheme or a brand. */
function otherScheme(brand: BrandTokens | undefined, theme: Theme | null, scheme: PageScheme | undefined): Compiled | null {
  if (!scheme || !brand || !theme?.ok) return null
  const other = buildTheme({ ...brand, colors: { ...scheme.colors } })
  if (!other.ok) throw new Error(`FeatherPage: the scheme's colours do not compile:\n- ${other.problems.join("\n- ")}`)
  if (isDarkTheme(other.css) === isDarkTheme(theme.css)) throw new Error(`FeatherPage: scheme.colors is a ${isDarkTheme(theme.css) ? "dark" : "light"} set, like the brand's; give the brand's other scheme`)
  return other
}

/** The page's other scheme, and the CSS that applies it. */
function useSchemeCss(brand: BrandTokens | undefined, theme: Theme | null, scheme: PageScheme | undefined): { other: Compiled | null; css: string | null } {
  const other = React.useMemo(() => otherScheme(brand, theme, scheme), [brand, theme, scheme])
  const css = React.useMemo(() => (theme?.ok && other ? schemeCss(theme.css, other.css) : null), [theme, other])
  return { other, css }
}

/** The page's layout in its brand (core/layouts.ts): every theme it can show is measured, and a ground the brand cannot
 * carry stops the render, as a brand that does not compile does. */
function useLayoutPlan(page: PageDocument, theme: Theme | null, other: Compiled | null): LayoutPlan {
  return React.useMemo(() => {
    const plan = layoutPlan(page.layout, page.sections, [theme?.ok ? theme.css : null, other?.css ?? null].filter((c): c is string => c !== null))
    if (plan.issues.length) throw new Error(`FeatherPage: the brand cannot carry the ${page.layout} layout:\n- ${plan.issues.map((i) => i.message).join("\n- ")}`)
    return plan
  }, [page, theme, other])
}

/**
 * The layout's contradictions for a page in a brand, as validatePage reports issues: what the brand's colours cannot
 * carry (a colour block, or a two-colour ink, below 4.5:1 in the brand or the scheme's other set). The CLI's build runs
 * it before it renders; FeatherPage refuses the same page.
 */
export function checkLayout(page: PageDocument, tokens?: BrandTokens): PageIssue[] {
  if (!page.layout) return []
  const brand = tokens ?? (typeof page.brand === "object" ? (page.brand as unknown as BrandTokens) : undefined)
  const theme = brand ? buildTheme(brand) : null
  if (!theme?.ok) return []
  const other = otherScheme(brand, theme, page.scheme)
  return layoutPlan(page.layout, page.sections, [theme.css, ...(other ? [other.css] : [])]).issues
}

/** The theme in the head: its variables, its other colour scheme, its open-font faces, and the preloads of those
 * fonts. */
function ThemeHead({ theme, scheme }: { theme: ReturnType<typeof buildTheme> | null; scheme?: string | null }) {
  if (!theme?.ok) return null
  const faces = fontFaces(theme.fonts)
  return (
    <>
      <style data-feather-theme="">{theme.css}</style>
      {scheme ? <style data-feather-scheme="">{scheme}</style> : null}
      {faces ? <style data-feather-fonts="">{faces}</style> : null}
      {theme.preload.map((p) => (
        <link key={p.href} rel="preload" href={p.href} as={p.as} type={p.type} crossOrigin={p.crossorigin} />
      ))}
    </>
  )
}

/** What the blocks may know about the page: its defaults, its layout and the index of its titled sections (the index
 * hero). */
function usePageContext(page: PageDocument): PageContextValue {
  return React.useMemo(
    () => ({
      ...(page.defaults ? { defaults: page.defaults } : {}),
      ...(page.layout ? { layout: page.layout } : {}),
      index: page.sections.filter((b): b is typeof b & { id: string; title: string } => typeof b.id === "string" && typeof b.title === "string").map((b) => ({ id: b.id, title: b.title })),
    }),
    [page]
  )
}

/** The text of a media field (a path or { src }). */
const srcOf = (m: unknown): string | undefined => (typeof m === "string" ? m : m && typeof m === "object" && "src" in m ? String((m as { src: unknown }).src) : undefined)

/** The page edges around the main content (feather.page/1): the loader, the nav, the footer. A page without edges
 * renders exactly as a /0 page did. */
function PageFrame({ page, head, plan, children }: { page: PageDocument; head: React.ReactNode; plan: LayoutPlan; children: React.ReactNode }) {
  const name = page.nav?.brand ?? page.title
  const bed = srcOf(page.sound?.bed)
  const reveal = page.footer?.variant === "reveal"
  const { SchemeToggle } = React.useContext(PagePartsContext)
  const toggle = page.scheme && SchemeToggle ? (page.scheme.toggle ?? (page.nav ? "nav" : "footer")) : null
  return (
    <>
      {head}
      {page.loader ? <Loader variant={page.loader.variant ?? "counter"} label={page.loader.label ?? `Loading ${page.title ?? "the page"}`} sound={page.loader.sound === true && !!bed} /> : null}
      {page.nav ? (
        <OverlayMenu
          className="page-inset"
          label={page.nav.label}
          items={page.nav.items}
          brand={
            name ? (
              <a href="/" data-slot="page-brand" className="inline-flex min-h-12 min-w-12 items-center type-label text-fg-primary focus-ring">
                {name}
              </a>
            ) : undefined
          }
          actions={
            bed || toggle === "nav" ? (
              <>
                {toggle === "nav" && SchemeToggle ? <SchemeToggle place="nav" /> : null}
                {bed ? <SoundToggle src={bed} /> : null}
              </>
            ) : undefined
          }
        />
      ) : null}
      {/* The page's loudness is a ceiling every block and expression component under main reads (data-loudness). */}
      {/* The layout (data-layout, and a two-colour page's ink) is drawn by foundation.css. */}
      <main data-page="" data-loudness={page.loudness} {...layoutAttrs(page, plan)} className={reveal ? "relative z-10 bg-surface-base" : undefined}>
        {page.cursor === "follower" ? <CursorLabels.Provider value>{children}</CursorLabels.Provider> : children}
      </main>
      {page.footer ? <Footer footer={page.footer} name={name} {...(toggle === "footer" && SchemeToggle ? { aside: <SchemeToggle place="footer" /> } : {})} /> : null}
      {/* Last, so it shifts no generated ids of the page above it. */}
      {page.cursor === "follower" ? <Cursor /> : null}
    </>
  )
}

/** main's layout attributes: none without a layout, so a page without one renders as before. */
function layoutAttrs(page: PageDocument, plan: LayoutPlan): Record<string, string> {
  if (!page.layout) return {}
  return { "data-layout": page.layout, ...(plan.ink ? { "data-ink": plan.ink } : {}) }
}

export interface PageNotFoundProps {
  page: PageDocument
  tokens?: BrandTokens
  /** The scheme toggle, as for FeatherPageCore. */
  parts?: PageParts
}

/** The page's 404 route: its nav, the notFound scene and its footer, in the brand. */
export function PageNotFoundCore({ page, tokens, parts = NO_PARTS }: PageNotFoundProps) {
  const brand = tokens ?? (typeof page.brand === "object" ? (page.brand as unknown as BrandTokens) : undefined)
  const theme = React.useMemo(() => (brand ? buildTheme(brand) : null), [brand])
  const { other, css: scheme } = useSchemeCss(brand, theme, page.scheme)
  const plan = useLayoutPlan(page, theme, other)
  const head = <ThemeHead theme={theme} scheme={scheme} />
  return (
    <PagePartsContext.Provider value={parts}>
      <PageFrame page={{ ...page, loader: undefined }} head={head} plan={plan}>
        <NotFound notFound={page.notFound ?? {}} />
      </PageFrame>
    </PagePartsContext.Provider>
  )
}

/** The Living Page registry of a block library: every kind, rendered by the brand's design of it. */
export function livingRegistry(library: BlockLibrary) {
  const entries = Object.fromEntries(
    (Object.keys(library) as BlockName[]).map((kind) => {
      const Component = library[kind] as React.ComponentType<BlockProps<BlockName>>
      const Adapter = ({ block }: { block: Block }) => <Component block={block as never} priority={false} />
      Adapter.displayName = `Living(${kind})`
      return [kind, Adapter]
    })
  ) as Record<BlockKind, React.ComponentType<{ block: Block }>>
  return createRegistry(entries)
}

function LivingPageFor({ page, library, onAsk, children }: { page: PageDocument; library: BlockLibrary; onAsk?: AskHandler; children: React.ReactNode }) {
  const registry = React.useMemo(() => livingRegistry(library), [library])
  const prepared = React.useMemo(() => pageScenes(page), [page])
  const speaker = page.speaker as Speaker
  return (
    <LivingPage speaker={speaker} registry={registry} prepared={prepared} onAsk={onAsk} disclosure={page.living?.disclosure}>
      {children}
    </LivingPage>
  )
}

export interface PreparedPageProps {
  page: PageDocument
  /** The scene's intent (its route segment). */
  intent: string
  tokens?: BrandTokens
  blocks?: Partial<BlockLibrary>
  /** How a next ask links to its route; `/<intent>` by default. */
  href?: (intent: string) => string
}

/** A prepared scene as its own static, indexable route: readable with no script and no model. */
export function PreparedPage({ page, intent, tokens, blocks, href }: PreparedPageProps) {
  const resolved = React.useMemo(() => resolveRefs(page), [page])
  const library = React.useMemo(() => ({ ...coreBlocks, ...blocks }) as BlockLibrary, [blocks])
  const registry = React.useMemo(() => livingRegistry(library), [library])
  const context = usePageContext(resolved)
  const brand = tokens ?? (typeof page.brand === "object" ? (page.brand as unknown as BrandTokens) : undefined)
  const theme = React.useMemo(() => (brand ? buildTheme(brand) : null), [brand])
  const { other, css: scheme } = useSchemeCss(brand, theme, page.scheme)
  const plan = useLayoutPlan(resolved, theme, other)
  const scenes = pageScenes(resolved)
  const scene = scenes.find((s) => s.intent === intent)
  if (!scene) throw new Error(`PreparedPage: "${intent}" is not a prepared scene of this page`)
  return (
    <>
      <ThemeHead theme={theme} scheme={scheme} />
      <main data-page="" data-intent={intent} data-loudness={page.loudness} {...layoutAttrs(page, plan)}>
        <PageContext.Provider value={context}>
          <PreparedSceneView scene={scene} speaker={resolved.speaker as Speaker} registry={registry} scenes={scenes} href={href} headingLevel={1} />
        </PageContext.Provider>
      </main>
    </>
  )
}
