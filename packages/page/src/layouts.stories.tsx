import type { Meta, StoryObj } from "@storybook/react-vite"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import { validatePage } from "./core/validate"
import type { PageBlock, PageDocument, PageLayout } from "./core/types"
import { FeatherPage } from "./render"
import { BLOCKS } from "./blocks/fixtures"

// The six page layouts (feather.page/1 `layout`, wave 5 part C), each in the three reference brands: one page of the
// reference content (hero, work, numbers, quote, offer, questions, a form and contact) under the layout. The form is
// there to show a block a layout cannot reach keeping its own form (colour-blocking leaves it on the page ground).
const BRANDS = { studio, portrait, seed } as const
type BrandName = keyof typeof BRANDS

const SECTIONS = [BLOCKS.hero, BLOCKS.work, BLOCKS.numbers, BLOCKS.quote, BLOCKS.offer, BLOCKS.faq, BLOCKS.form, BLOCKS.contact] as PageBlock[]

function page(layout: PageLayout): PageDocument {
  const r = validatePage({ schema: "feather.page/1", brand: "brand.json", title: "Alee — design engineer", lang: "en", loudness: 2, layout, sections: SECTIONS })
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}: ${i.message}`).join("\n"))
  return r.page
}

function Layout({ layout, brand }: { layout: PageLayout; brand: BrandName }) {
  return <FeatherPage page={page(layout)} tokens={BRANDS[brand].tokens as unknown as BrandTokens} />
}

const meta = {
  title: "Pages/Layouts",
  decorators: [
    (Story) => (
      <div className="-m-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "The page layouts: editorial (asymmetric), swiss (a strict grid with hairline rules), brutalist, poster, colour-blocking (sections on the theme's colour blocks in turn) and two-colour (the ground and one ink), each in the three reference brands. Structure only: every colour is the theme's." } },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** editorial, in Studio. */
export const EditorialStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Layout layout="editorial" brand="studio" />,
}

/** editorial, in Portrait. */
export const EditorialPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Layout layout="editorial" brand="portrait" />,
}

/** editorial, in Seed. */
export const EditorialSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Layout layout="editorial" brand="seed" />,
}

/** swiss, in Studio. */
export const SwissStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Layout layout="swiss" brand="studio" />,
}

/** swiss, in Portrait. */
export const SwissPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Layout layout="swiss" brand="portrait" />,
}

/** swiss, in Seed. */
export const SwissSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Layout layout="swiss" brand="seed" />,
}

/** brutalist, in Studio. */
export const BrutalistStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Layout layout="brutalist" brand="studio" />,
}

/** brutalist, in Portrait. */
export const BrutalistPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Layout layout="brutalist" brand="portrait" />,
}

/** brutalist, in Seed. */
export const BrutalistSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Layout layout="brutalist" brand="seed" />,
}

/** poster, in Studio. */
export const PosterStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Layout layout="poster" brand="studio" />,
}

/** poster, in Portrait. */
export const PosterPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Layout layout="poster" brand="portrait" />,
}

/** poster, in Seed. */
export const PosterSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Layout layout="poster" brand="seed" />,
}

/** colour-blocking, in Studio. */
export const ColourBlockingStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Layout layout="colour-blocking" brand="studio" />,
}

/** colour-blocking, in Portrait. */
export const ColourBlockingPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Layout layout="colour-blocking" brand="portrait" />,
}

/** colour-blocking, in Seed. */
export const ColourBlockingSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Layout layout="colour-blocking" brand="seed" />,
}

/** two-colour, in Studio. */
export const TwoColourStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Layout layout="two-colour" brand="studio" />,
}

/** two-colour, in Portrait. */
export const TwoColourPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Layout layout="two-colour" brand="portrait" />,
}

/** two-colour, in Seed. */
export const TwoColourSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Layout layout="two-colour" brand="seed" />,
}
