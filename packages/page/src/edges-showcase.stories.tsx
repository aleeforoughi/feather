import * as React from "react"
import { flushSync } from "react-dom"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { createTransitions, Loader, type RouteVariant } from "@aleeforoughi/feather-expression"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import example from "../examples/studio-of-one.page.json"
import { validatePage } from "./core/validate"
import type { PageDocument } from "./core/types"
import { FeatherPage, PageNotFound } from "./render"

// The wave 1 edges in the three reference brands, on the reference page: the craft, not only the mechanics. Each
// story sets its brand (the toolbar's theme follows). Replay a loader with the button in its corner.
const BRANDS = { studio, portrait, seed } as const
type BrandName = keyof typeof BRANDS
const tokensOf = (b: BrandName) => BRANDS[b].tokens as unknown as BrandTokens

const page = (extra: Partial<PageDocument> = {}): PageDocument => {
  const r = validatePage({ ...example, ...extra })
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}`).join("\n"))
  return r.page
}

function Replay({ children }: { children: (key: number) => React.ReactNode }) {
  const [key, setKey] = React.useState(0)
  return (
    <>
      {children(key)}
      <button type="button" onClick={() => setKey((k) => k + 1)} className="fixed bottom-4 right-4 z-[60] inline-flex min-h-12 items-center rounded-control border border-line-primary bg-surface-base px-4 type-label text-fg-primary focus-ring">
        Replay
      </button>
    </>
  )
}

const meta = {
  title: "Pages/Edges in brands",
  // Whole pages: undo the preview's padding so the page's own edges (and its fixed menu panel) line up.
  decorators: [
    (Story) => (
      <div className="-m-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "The page edges of feather.page/1 on the reference page, each in one of the three reference brands: the overlay menu, the loaders, the route transitions, the footer and the 404." } },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Studio: the overlay menu over the full page, with the wordmark footer at its end. */
export const MenuAndFooterStudio: Story = {
  globals: { theme: "studio" },
  render: () => <FeatherPage page={page()} tokens={tokensOf("studio")} />,
}

/** Portrait: the counter loader in front of the page. */
export const CounterLoaderPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => (
    <Replay>
      {(key) => (
        <>
          <FeatherPage page={page()} tokens={tokensOf("portrait")} />
          <Loader key={key} variant="counter" label="Loading the studio of one" />
        </>
      )}
    </Replay>
  ),
}

/** Seed: the dock loader asks about sound, then travels into the menu bar. */
export const DockLoaderWithSoundSeed: Story = {
  globals: { theme: "seed" },
  render: () => (
    <Replay>
      {(key) => (
        <>
          <FeatherPage page={page()} tokens={tokensOf("seed")} />
          <Loader key={key} variant="dock" sound label="Loading the studio of one" />
        </>
      )}
    </Replay>
  ),
}

/** The route transitions: pick a variant, then switch brand. Each switch is a route change through go(). */
export const RouteTransitions: Story = {
  globals: { theme: "studio" },
  render: function Render() {
    const [brand, setBrand] = React.useState<BrandName>("studio")
    const [variant, setVariant] = React.useState<RouteVariant>("view")
    const transitions = React.useMemo(() => createTransitions(), [])
    const go = (next: BrandName) => void transitions.go(() => flushSync(() => setBrand(next)), { variant })
    return (
      <>
        <div role="toolbar" aria-label="Route transition" className="flex flex-wrap items-center justify-center gap-2 bg-surface-subtle p-2">
          {(["view", "push", "columns", "fade", "none"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={v === variant} onClick={() => setVariant(v)} className="inline-flex min-h-12 items-center rounded-control px-4 type-label text-fg-secondary focus-ring aria-pressed:bg-surface-base aria-pressed:text-fg-primary">
              {v}
            </button>
          ))}
          <span aria-hidden="true" className="px-2 text-fg-secondary">
            →
          </span>
          {(Object.keys(BRANDS) as BrandName[]).map((b) => (
            <button key={b} type="button" aria-current={b === brand ? "page" : undefined} onClick={() => go(b)} className="inline-flex min-h-12 items-center rounded-control border border-line-primary bg-surface-base px-4 type-label text-fg-primary focus-ring">
              {b}
            </button>
          ))}
        </div>
        <FeatherPage page={page()} tokens={tokensOf(brand)} />
      </>
    )
  },
}

/** Portrait: the reveal footer, waiting behind the page. Scroll to the end. */
export const RevealFooterPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <FeatherPage page={page({ footer: { variant: "reveal", wordmark: "Alee", links: [{ label: "Work", href: "#work" }, { label: "Contact", href: "#contact" }], note: "Built from one feather.page document." } })} tokens={tokensOf("portrait")} />,
}

/** Seed: the 404 as a small scene, in the page's own chrome. */
export const NotFoundSeed: Story = {
  globals: { theme: "seed" },
  render: () => <PageNotFound page={page()} tokens={tokensOf("seed")} />,
}

/** Studio: the minimal 404. */
export const NotFoundMinimalStudio: Story = {
  globals: { theme: "studio" },
  render: () => <PageNotFound page={page({ notFound: { variant: "minimal", title: "Nothing lives at this address", home: [{ label: "Back to the work", href: "/" }] } })} tokens={tokensOf("studio")} />,
}
