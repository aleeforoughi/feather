import type { Meta, StoryObj } from "@storybook/react-vite"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import { validatePage } from "../core/validate"
import type { BlockName, PageBlock, PageDocument } from "../core/types"
import { FeatherPage } from "../render"
import { BLOCKS, PLACEHOLDER, VARIANT_EXTRAS } from "./fixtures"

// Every block variant of feather.page/1 (wave 2), each in one of the three reference brands, with the reference page's
// content. Each story is a small page (the variant, after the hero where the block needs a page around it) rendered by
// FeatherPage with the brand's tokens, so the theme, the knobs and the Living Page context are the real ones. The
// moving variants move at the page's loudness (3 here); the toolbar's reduced motion and a quieter brand calm them.
const BRANDS = { studio, portrait, seed } as const
type BrandName = keyof typeof BRANDS

function page(sections: unknown[]): PageDocument {
  const r = validatePage({ schema: "feather.page/1", brand: "brand.json", title: "Alee — design engineer", lang: "en", loudness: 3, sections })
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}: ${i.message}`).join("\n"))
  return r.page
}

/** One variant of one block, as a page in a brand. */
function Variant({ kind, variant, brand, extra = {} }: { kind: BlockName; variant: string; brand: BrandName; extra?: Record<string, unknown> }) {
  const block = { ...BLOCKS[kind], ...VARIANT_EXTRAS[kind]?.[variant], ...extra, variant } as PageBlock
  const sections = kind === "hero" ? [block, BLOCKS.work, BLOCKS.process, BLOCKS.contact] : [block]
  return <FeatherPage page={page(sections)} tokens={BRANDS[brand].tokens as unknown as BrandTokens} />
}

const meta = {
  title: "Pages/Block variants",
  decorators: [
    (Story) => (
      <div className="-m-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "Every named variant of every block (feather.page/1), in the three reference brands, with the reference page's content. The first variant of each block is its /0 rendering." } },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** hero: stacked, in Studio. */
export const HeroStackedStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="hero" variant="stacked" brand="studio" extra={{ media: PLACEHOLDER }} />,
}

/** hero: giant-type, in Portrait. */
export const HeroGiantTypePortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="hero" variant="giant-type" brand="portrait" extra={{ media: PLACEHOLDER }} />,
}

/** hero: split, in Seed. */
export const HeroSplitSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="hero" variant="split" brand="seed" extra={{ media: PLACEHOLDER }} />,
}

/** hero: film, in Studio. */
export const HeroFilmStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="hero" variant="film" brand="studio" extra={{ media: PLACEHOLDER }} />,
}

/** hero: product, in Portrait. */
export const HeroProductPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="hero" variant="product" brand="portrait" extra={{ media: PLACEHOLDER }} />,
}

/** hero: index, in Seed. */
export const HeroIndexSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="hero" variant="index" brand="seed" />,
}

/** hero: interactive, in Studio. */
export const HeroInteractiveStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="hero" variant="interactive" brand="studio" />,
}

/** statement: plain, in Portrait. */
export const StatementPlainPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="statement" variant="plain" brand="portrait" />,
}

/** statement: centred, in Seed. */
export const StatementCentredSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="statement" variant="centred" brand="seed" />,
}

/** statement: offset, in Studio. */
export const StatementOffsetStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="statement" variant="offset" brand="studio" />,
}

/** statement: marquee, in Portrait. */
export const StatementMarqueePortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="statement" variant="marquee" brand="portrait" />,
}

/** statement: fill, in Seed. */
export const StatementFillSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="statement" variant="fill" brand="seed" />,
}

/** statement: swap, in Studio. */
export const StatementSwapStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="statement" variant="swap" brand="studio" />,
}

/** work: grid, in Portrait. */
export const WorkGridPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="work" variant="grid" brand="portrait" />,
}

/** work: hover-list, in Seed. */
export const WorkHoverListSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="work" variant="hover-list" brand="seed" />,
}

/** work: stack, in Studio. */
export const WorkStackStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="work" variant="stack" brand="studio" />,
}

/** work: rail, in Portrait. */
export const WorkRailPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="work" variant="rail" brand="portrait" />,
}

/** case: editorial, in Seed. */
export const CaseEditorialSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="case" variant="editorial" brand="seed" extra={{ media: PLACEHOLDER }} />,
}

/** case: scale, in Studio. */
export const CaseScaleStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="case" variant="scale" brand="studio" extra={{ media: PLACEHOLDER }} />,
}

/** numbers: counter, in Portrait. */
export const NumbersCounterPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="numbers" variant="counter" brand="portrait" />,
}

/** numbers: plain, in Seed. */
export const NumbersPlainSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="numbers" variant="plain" brand="seed" />,
}

/** numbers: lead, in Studio. */
export const NumbersLeadStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="numbers" variant="lead" brand="studio" />,
}

/** timeline: list, in Portrait. */
export const TimelineListPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="timeline" variant="list" brand="portrait" />,
}

/** timeline: horizontal, in Seed. */
export const TimelineHorizontalSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="timeline" variant="horizontal" brand="seed" />,
}

/** process: list, in Studio. */
export const ProcessListStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="process" variant="list" brand="studio" />,
}

/** process: pinned, in Portrait. */
export const ProcessPinnedPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="process" variant="pinned" brand="portrait" />,
}

/** process: rows, in Seed. */
export const ProcessRowsSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="process" variant="rows" brand="seed" />,
}

/** logos: grid, in Studio. */
export const LogosGridStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="logos" variant="grid" brand="studio" />,
}

/** logos: marquee, in Portrait. */
export const LogosMarqueePortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="logos" variant="marquee" brand="portrait" />,
}

/** quote: large, in Seed. */
export const QuoteLargeSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="quote" variant="large" brand="seed" />,
}

/** quote: rail, in Studio. */
export const QuoteRailStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="quote" variant="rail" brand="studio" />,
}

/** quote: pull, in Portrait. */
export const QuotePullPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="quote" variant="pull" brand="portrait" />,
}

/** offer: cards, in Seed. */
export const OfferCardsSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="offer" variant="cards" brand="seed" />,
}

/** offer: table, in Studio. */
export const OfferTableStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="offer" variant="table" brand="studio" />,
}

/** faq: list, in Portrait. */
export const FaqListPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="faq" variant="list" brand="portrait" />,
}

/** contact: plain, in Seed. */
export const ContactPlainSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="contact" variant="plain" brand="seed" />,
}
