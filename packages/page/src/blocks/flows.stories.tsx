import type { Meta, StoryObj } from "@storybook/react-vite"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import { validatePage } from "../core/validate"
import type { PageBlock, PageDocument } from "../core/types"
import { FeatherPage } from "../render"
import { BLOCKS, FLOW_BLOCKS, VARIANT_EXTRAS } from "./fixtures"

// Product flows in a page (feather.page/1, wave 5): the quiz, the booking flow, the calculator, the chart, the places
// list and the podcast, each in the three reference brands; their other variants; the work's view-mode switch; and
// the colour scheme toggle in the nav and in the footer. Each story is a small page rendered by FeatherPage with the
// brand's tokens, so the theme and the knobs are the real ones.
const BRANDS = { studio, portrait, seed } as const
type BrandName = keyof typeof BRANDS
type FlowName = keyof typeof FLOW_BLOCKS

/** Each brand's other colour set (the showcase's own, apps/showcase/src/schemes.json). */
const OTHER: Record<BrandName, NonNullable<PageDocument["scheme"]>["colors"]> = {
  studio: { background: "#FBF5EE", surface: "#FFFFFF", text: "#1C130C", primary: "#A8410C", primaryText: "#FFFFFF", accent: "#A8410C", accentText: "#FFFFFF" },
  portrait: { background: "#1A1718", surface: "#242021", text: "#F1ECE3", primary: "#F1ECE3", primaryText: "#1A1718", accent: "#D9A86A", accentText: "#1A1718" },
  seed: { background: "#0E0F16", surface: "#171925", text: "#F1F2F8", primary: "#A3A4FF", primaryText: "#0E0F16", accent: "#A3A4FF", accentText: "#0E0F16" },
}

function page(sections: unknown[], extra: Record<string, unknown> = {}): PageDocument {
  const r = validatePage({ schema: "feather.page/1", brand: "brand.json", title: "Alee — working together", lang: "en", sections, ...extra })
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}: ${i.message}`).join("\n"))
  return r.page
}

/** One flow block, in a variant, as a page in a brand. */
function Flow({ kind, variant, brand }: { kind: FlowName; variant?: string; brand: BrandName }) {
  const block = { ...FLOW_BLOCKS[kind], ...(variant ? { ...VARIANT_EXTRAS[kind]?.[variant], variant } : {}) } as PageBlock
  return <FeatherPage page={page([block])} tokens={BRANDS[brand].tokens as unknown as BrandTokens} />
}

const meta = {
  title: "Pages/Product flows",
  decorators: [
    (Story) => (
      <div className="-m-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "The product-flow blocks of feather.page/1 (wave 5): every one works in full with no script, as a static, honest form, and keeps the person in control." } },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** quiz, in Studio. */
export const QuizStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Flow kind="quiz" brand="studio" />,
}

/** quiz, in Portrait. */
export const QuizPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Flow kind="quiz" brand="portrait" />,
}

/** quiz, in Seed. */
export const QuizSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Flow kind="quiz" brand="seed" />,
}

/** booking, in Studio. */
export const BookingStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Flow kind="booking" brand="studio" />,
}

/** booking, in Portrait. */
export const BookingPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Flow kind="booking" brand="portrait" />,
}

/** booking, in Seed. */
export const BookingSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Flow kind="booking" brand="seed" />,
}

/** calculator, in Studio. */
export const CalculatorStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Flow kind="calculator" brand="studio" />,
}

/** calculator, in Portrait. */
export const CalculatorPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Flow kind="calculator" brand="portrait" />,
}

/** calculator, in Seed. */
export const CalculatorSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Flow kind="calculator" brand="seed" />,
}

/** chart, in Studio. */
export const ChartStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Flow kind="chart" brand="studio" />,
}

/** chart, in Portrait. */
export const ChartPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Flow kind="chart" brand="portrait" />,
}

/** chart, in Seed. */
export const ChartSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Flow kind="chart" brand="seed" />,
}

/** places, in Studio. */
export const PlacesStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Flow kind="places" brand="studio" />,
}

/** places, in Portrait. */
export const PlacesPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Flow kind="places" brand="portrait" />,
}

/** places, in Seed. */
export const PlacesSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Flow kind="places" brand="seed" />,
}

/** podcast, in Studio. */
export const PodcastStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Flow kind="podcast" brand="studio" />,
}

/** podcast, in Portrait. */
export const PodcastPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Flow kind="podcast" brand="portrait" />,
}

/** podcast, in Seed. */
export const PodcastSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Flow kind="podcast" brand="seed" />,
}

/** calculator: stacked, in Seed. */
export const CalculatorStackedSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Flow kind="calculator" variant="stacked" brand="seed" />,
}

/** chart: line, in Portrait. */
export const ChartLinePortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Flow kind="chart" variant="line" brand="portrait" />,
}

/** chart: area, in Studio. */
export const ChartAreaStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Flow kind="chart" variant="area" brand="studio" />,
}

/** places: map, in Seed. */
export const PlacesMapSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Flow kind="places" variant="map" brand="seed" />,
}

/** work with the view-mode switch, starting in grid, in Studio. */
export const WorkViewsGridStudio: Story = {
  globals: { theme: "studio" },
  render: () => <FeatherPage page={page([{ ...BLOCKS.work, views: "grid" }])} tokens={BRANDS.studio.tokens as unknown as BrandTokens} />,
}

/** work with the view-mode switch, starting in list, in Portrait. */
export const WorkViewsListPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <FeatherPage page={page([{ ...BLOCKS.work, views: "list" }])} tokens={BRANDS.portrait.tokens as unknown as BrandTokens} />,
}

/** work with the view-mode switch, starting in index, in Seed. */
export const WorkViewsIndexSeed: Story = {
  globals: { theme: "seed" },
  render: () => <FeatherPage page={page([{ ...BLOCKS.work, views: "index" }])} tokens={BRANDS.seed.tokens as unknown as BrandTokens} />,
}

/** The colour scheme toggle in the nav, in Studio: light, dark and system, the system's preference first. */
export const SchemeToggleNavStudio: Story = {
  globals: { theme: "studio" },
  render: () => <FeatherPage page={page([BLOCKS.hero], { ...{ nav: { brand: "Alee", items: [{ label: "Work", href: "#work" }] } }, scheme: { toggle: "nav", colors: OTHER.studio } })} tokens={BRANDS.studio.tokens as unknown as BrandTokens} />,
}

/** The colour scheme toggle in the footer, in Portrait: light, dark and system, the system's preference first. */
export const SchemeToggleFooterPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <FeatherPage page={page([BLOCKS.hero], { ...{ footer: { links: [{ label: "Work", href: "#work" }], note: "Built from one feather.page document." } }, scheme: { toggle: "footer", colors: OTHER.portrait } })} tokens={BRANDS.portrait.tokens as unknown as BrandTokens} />,
}

/** The colour scheme toggle in the nav, in Seed: light, dark and system, the system's preference first. */
export const SchemeToggleNavSeed: Story = {
  globals: { theme: "seed" },
  render: () => <FeatherPage page={page([BLOCKS.hero], { ...{ nav: { brand: "Alee", items: [{ label: "Work", href: "#work" }] } }, scheme: { toggle: "nav", colors: OTHER.seed } })} tokens={BRANDS.seed.tokens as unknown as BrandTokens} />,
}
