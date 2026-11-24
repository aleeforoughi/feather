// FeatherPage: a validated feather.page/0 document, rendered as a complete website in the brand's tokens, with the
// Living Page layered on when the document has one. Deterministic: the same page, brand and host give the same DOM.
import * as React from "react"
import { buildTheme, type BrandTokens } from "@aleeforoughi/feather-tokens"
import { Loader, OverlayMenu, SoundToggle } from "@aleeforoughi/feather-expression"
import { LivingPage, PreparedSceneView, createRegistry, useLivingAsk, type AskHandler, type Block, type BlockKind, type PreparedScene, type Speaker } from "@aleeforoughi/feather-living"
import { defaultBlocks, type BlockProps } from "./blocks/index"
import { Footer, NotFound } from "./blocks/edges"
import { resolveRefs } from "./core/validate"
import type { BlockName, PageBlock, PageDocument } from "./core/types"

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

export function FeatherPage({ page, tokens, blocks, onAsk }: FeatherPageProps) {
  const resolved = React.useMemo(() => resolveRefs(page), [page])
  const library = React.useMemo(() => ({ ...defaultBlocks, ...blocks }) as BlockLibrary, [blocks])
  const brand = tokens ?? (typeof page.brand === "object" ? (page.brand as unknown as BrandTokens) : undefined)
  const theme = React.useMemo(() => (brand ? buildTheme(brand) : null), [brand])
  if (theme && !theme.ok) throw new Error(`FeatherPage: the brand does not compile:\n- ${theme.problems.join("\n- ")}`)

  const base = resolved.sections.map((block, i) => (
    <div key={block.id ?? i} data-living-section={block.id ?? `section-${i + 1}`}>
      <PageBlockView block={block} library={library} priority={i === 0} />
    </div>
  ))

  const head = theme?.ok ? (
    <>
      <style data-feather-theme="">{theme.css}</style>
      {theme.preload.map((p) => (
        <link key={p.href} rel="preload" href={p.href} as={p.as} type={p.type} crossOrigin={p.crossorigin} />
      ))}
    </>
  ) : null

  const content = !resolved.living || !resolved.speaker ? base : (
    <LivingPageFor page={resolved} library={library} onAsk={onAsk}>
      {base}
    </LivingPageFor>
  )
  return (
    <PageFrame page={resolved} head={head}>
      {content}
    </PageFrame>
  )
}

/** The text of a media field (a path or { src }). */
const srcOf = (m: unknown): string | undefined => (typeof m === "string" ? m : m && typeof m === "object" && "src" in m ? String((m as { src: unknown }).src) : undefined)

/** The page edges around the main content (feather.page/1): the loader, the nav, the footer. A page without edges
 * renders exactly as a /0 page did. */
function PageFrame({ page, head, children }: { page: PageDocument; head: React.ReactNode; children: React.ReactNode }) {
  const name = page.nav?.brand ?? page.title
  const bed = srcOf(page.sound?.bed)
  const reveal = page.footer?.variant === "reveal"
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
              <a href="/" data-slot="page-brand" className="inline-flex min-h-12 items-center type-label text-fg-primary focus-ring">
                {name}
              </a>
            ) : undefined
          }
          actions={bed ? <SoundToggle src={bed} /> : undefined}
        />
      ) : null}
      <main data-page="" className={reveal ? "relative z-10 bg-surface-base" : undefined}>
        {children}
      </main>
      {page.footer ? <Footer footer={page.footer} name={name} /> : null}
    </>
  )
}

export interface PageNotFoundProps {
  page: PageDocument
  tokens?: BrandTokens
}

/** The page's 404 route: its nav, the notFound scene and its footer, in the brand. */
export function PageNotFound({ page, tokens }: PageNotFoundProps) {
  const brand = tokens ?? (typeof page.brand === "object" ? (page.brand as unknown as BrandTokens) : undefined)
  const theme = React.useMemo(() => (brand ? buildTheme(brand) : null), [brand])
  const head = theme?.ok ? <style data-feather-theme="">{theme.css}</style> : null
  return (
    <PageFrame page={{ ...page, loader: undefined }} head={head}>
      <NotFound notFound={page.notFound ?? {}} />
    </PageFrame>
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
  const library = React.useMemo(() => ({ ...defaultBlocks, ...blocks }) as BlockLibrary, [blocks])
  const registry = React.useMemo(() => livingRegistry(library), [library])
  const scenes = pageScenes(resolved)
  const scene = scenes.find((s) => s.intent === intent)
  if (!scene) throw new Error(`PreparedPage: "${intent}" is not a prepared scene of this page`)
  const brand = tokens ?? (typeof page.brand === "object" ? (page.brand as unknown as BrandTokens) : undefined)
  const theme = brand ? buildTheme(brand) : null
  return (
    <>
      {theme?.ok ? <style data-feather-theme="">{theme.css}</style> : null}
      <main data-page="" data-intent={intent}>
        <PreparedSceneView scene={scene} speaker={resolved.speaker as Speaker} registry={registry} scenes={scenes} href={href} headingLevel={1} />
      </main>
    </>
  )
}
