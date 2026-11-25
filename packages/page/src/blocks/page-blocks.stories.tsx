import type { Meta, StoryObj } from "@storybook/react-vite"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import { validatePage } from "../core/validate"
import type { BlockName, PageBlock, PageDocument } from "../core/types"
import { FeatherPage } from "../render"
import { BLOCKS, VARIANT_EXTRAS } from "./fixtures"

// Wave 5 part A: the page blocks (gallery, comparison, story, testimonials, journal, form, showreel), the new work and
// offer variants and the image treatments, each in the three reference brands, with the reference content. Each story
// is a small feather.page/1 page at loudness 3, rendered by FeatherPage in the brand's tokens; the toolbar's reduced
// motion shows every block's static form.
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
  return <FeatherPage page={page([block])} tokens={BRANDS[brand].tokens as unknown as BrandTokens} />
}

const meta = {
  title: "Pages/Page blocks",
  decorators: [
    (Story) => (
      <div className="-m-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "The blocks only a feather.page/1 page takes (gallery, comparison, story, testimonials, journal, form, showreel), the work and offer variants of wave 5, and the image treatments, in the three reference brands." } },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>


/** gallery: rail, in Studio. */
export const GalleryRailStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="gallery" variant="rail" brand="studio" />,
}

/** gallery: rail, in Portrait. */
export const GalleryRailPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="gallery" variant="rail" brand="portrait" />,
}

/** gallery: rail, in Seed. */
export const GalleryRailSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="gallery" variant="rail" brand="seed" />,
}

/** gallery: masonry, in Studio. */
export const GalleryMasonryStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="gallery" variant="masonry" brand="studio" />,
}

/** gallery: masonry, in Portrait. */
export const GalleryMasonryPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="gallery" variant="masonry" brand="portrait" />,
}

/** gallery: masonry, in Seed. */
export const GalleryMasonrySeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="gallery" variant="masonry" brand="seed" />,
}

/** gallery: grid, in Studio. */
export const GalleryGridStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="gallery" variant="grid" brand="studio" />,
}

/** gallery: grid, in Portrait. */
export const GalleryGridPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="gallery" variant="grid" brand="portrait" />,
}

/** gallery: grid, in Seed. */
export const GalleryGridSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="gallery" variant="grid" brand="seed" />,
}

/** gallery: hover-list, in Studio. */
export const GalleryHoverListStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="gallery" variant="hover-list" brand="studio" />,
}

/** gallery: hover-list, in Portrait. */
export const GalleryHoverListPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="gallery" variant="hover-list" brand="portrait" />,
}

/** gallery: hover-list, in Seed. */
export const GalleryHoverListSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="gallery" variant="hover-list" brand="seed" />,
}

/** gallery: wheel, in Studio. */
export const GalleryWheelStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="gallery" variant="wheel" brand="studio" />,
}

/** gallery: wheel, in Portrait. */
export const GalleryWheelPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="gallery" variant="wheel" brand="portrait" />,
}

/** gallery: wheel, in Seed. */
export const GalleryWheelSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="gallery" variant="wheel" brand="seed" />,
}

/** comparison: slider, in Studio. */
export const ComparisonSliderStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="comparison" variant="slider" brand="studio" />,
}

/** comparison: slider, in Portrait. */
export const ComparisonSliderPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="comparison" variant="slider" brand="portrait" />,
}

/** comparison: slider, in Seed. */
export const ComparisonSliderSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="comparison" variant="slider" brand="seed" />,
}

/** story: pinned, in Studio. */
export const StoryPinnedStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="story" variant="pinned" brand="studio" />,
}

/** story: pinned, in Portrait. */
export const StoryPinnedPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="story" variant="pinned" brand="portrait" />,
}

/** story: pinned, in Seed. */
export const StoryPinnedSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="story" variant="pinned" brand="seed" />,
}

/** story: stacked, in Studio. */
export const StoryStackedStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="story" variant="stacked" brand="studio" />,
}

/** story: stacked, in Portrait. */
export const StoryStackedPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="story" variant="stacked" brand="portrait" />,
}

/** story: stacked, in Seed. */
export const StoryStackedSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="story" variant="stacked" brand="seed" />,
}

/** testimonials: grid, in Studio. */
export const TestimonialsGridStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="testimonials" variant="grid" brand="studio" />,
}

/** testimonials: grid, in Portrait. */
export const TestimonialsGridPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="testimonials" variant="grid" brand="portrait" />,
}

/** testimonials: grid, in Seed. */
export const TestimonialsGridSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="testimonials" variant="grid" brand="seed" />,
}

/** testimonials: rail, in Studio. */
export const TestimonialsRailStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="testimonials" variant="rail" brand="studio" />,
}

/** testimonials: rail, in Portrait. */
export const TestimonialsRailPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="testimonials" variant="rail" brand="portrait" />,
}

/** testimonials: rail, in Seed. */
export const TestimonialsRailSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="testimonials" variant="rail" brand="seed" />,
}

/** journal: list, in Studio. */
export const JournalListStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="journal" variant="list" brand="studio" />,
}

/** journal: list, in Portrait. */
export const JournalListPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="journal" variant="list" brand="portrait" />,
}

/** journal: list, in Seed. */
export const JournalListSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="journal" variant="list" brand="seed" />,
}

/** journal: featured, in Studio. */
export const JournalFeaturedStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="journal" variant="featured" brand="studio" />,
}

/** journal: featured, in Portrait. */
export const JournalFeaturedPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="journal" variant="featured" brand="portrait" />,
}

/** journal: featured, in Seed. */
export const JournalFeaturedSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="journal" variant="featured" brand="seed" />,
}

/** form: underline, in Studio. */
export const FormUnderlineStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="form" variant="underline" brand="studio" />,
}

/** form: underline, in Portrait. */
export const FormUnderlinePortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="form" variant="underline" brand="portrait" />,
}

/** form: underline, in Seed. */
export const FormUnderlineSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="form" variant="underline" brand="seed" />,
}

/** form: conversational, in Studio. */
export const FormConversationalStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="form" variant="conversational" brand="studio" />,
}

/** form: conversational, in Portrait. */
export const FormConversationalPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="form" variant="conversational" brand="portrait" />,
}

/** form: conversational, in Seed. */
export const FormConversationalSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="form" variant="conversational" brand="seed" />,
}

/** showreel: player, in Studio. */
export const ShowreelPlayerStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="showreel" variant="player" brand="studio" />,
}

/** showreel: player, in Portrait. */
export const ShowreelPlayerPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="showreel" variant="player" brand="portrait" />,
}

/** showreel: player, in Seed. */
export const ShowreelPlayerSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="showreel" variant="player" brand="seed" />,
}

/** work: fullscreen-cases, in Studio. */
export const WorkFullscreenCasesStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="work" variant="fullscreen-cases" brand="studio" />,
}

/** work: fullscreen-cases, in Portrait. */
export const WorkFullscreenCasesPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="work" variant="fullscreen-cases" brand="portrait" />,
}

/** work: fullscreen-cases, in Seed. */
export const WorkFullscreenCasesSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="work" variant="fullscreen-cases" brand="seed" />,
}

/** work: bento, in Studio. */
export const WorkBentoStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="work" variant="bento" brand="studio" />,
}

/** work: bento, in Portrait. */
export const WorkBentoPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="work" variant="bento" brand="portrait" />,
}

/** work: bento, in Seed. */
export const WorkBentoSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="work" variant="bento" brand="seed" />,
}

/** offer: toggle, in Studio. */
export const OfferToggleStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="offer" variant="toggle" brand="studio" />,
}

/** offer: toggle, in Portrait. */
export const OfferTogglePortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="offer" variant="toggle" brand="portrait" />,
}

/** offer: toggle, in Seed. */
export const OfferToggleSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="offer" variant="toggle" brand="seed" />,
}

/** treatment: clip-reveal on the gallery's grid, in Studio. */
export const TreatmentClipRevealStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="gallery" variant="grid" brand="studio" extra={{ treatment: "clip-reveal" }} />,
}

/** treatment: clip-reveal on the gallery's grid, in Portrait. */
export const TreatmentClipRevealPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="gallery" variant="grid" brand="portrait" extra={{ treatment: "clip-reveal" }} />,
}

/** treatment: clip-reveal on the gallery's grid, in Seed. */
export const TreatmentClipRevealSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="gallery" variant="grid" brand="seed" extra={{ treatment: "clip-reveal" }} />,
}

/** treatment: inner-parallax on the gallery's grid, in Studio. */
export const TreatmentInnerParallaxStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="gallery" variant="grid" brand="studio" extra={{ treatment: "inner-parallax" }} />,
}

/** treatment: inner-parallax on the gallery's grid, in Portrait. */
export const TreatmentInnerParallaxPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="gallery" variant="grid" brand="portrait" extra={{ treatment: "inner-parallax" }} />,
}

/** treatment: inner-parallax on the gallery's grid, in Seed. */
export const TreatmentInnerParallaxSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="gallery" variant="grid" brand="seed" extra={{ treatment: "inner-parallax" }} />,
}

/** treatment: blur-to-sharp on the gallery's grid, in Studio. */
export const TreatmentBlurToSharpStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="gallery" variant="grid" brand="studio" extra={{ treatment: "blur-to-sharp" }} />,
}

/** treatment: blur-to-sharp on the gallery's grid, in Portrait. */
export const TreatmentBlurToSharpPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="gallery" variant="grid" brand="portrait" extra={{ treatment: "blur-to-sharp" }} />,
}

/** treatment: blur-to-sharp on the gallery's grid, in Seed. */
export const TreatmentBlurToSharpSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="gallery" variant="grid" brand="seed" extra={{ treatment: "blur-to-sharp" }} />,
}

/** treatment: duotone on the gallery's grid, in Studio. */
export const TreatmentDuotoneStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="gallery" variant="grid" brand="studio" extra={{ treatment: "duotone" }} />,
}

/** treatment: duotone on the gallery's grid, in Portrait. */
export const TreatmentDuotonePortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="gallery" variant="grid" brand="portrait" extra={{ treatment: "duotone" }} />,
}

/** treatment: duotone on the gallery's grid, in Seed. */
export const TreatmentDuotoneSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="gallery" variant="grid" brand="seed" extra={{ treatment: "duotone" }} />,
}

/** treatment: grain on the gallery's grid, in Studio. */
export const TreatmentGrainStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Variant kind="gallery" variant="grid" brand="studio" extra={{ treatment: "grain" }} />,
}

/** treatment: grain on the gallery's grid, in Portrait. */
export const TreatmentGrainPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Variant kind="gallery" variant="grid" brand="portrait" extra={{ treatment: "grain" }} />,
}

/** treatment: grain on the gallery's grid, in Seed. */
export const TreatmentGrainSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Variant kind="gallery" variant="grid" brand="seed" extra={{ treatment: "grain" }} />,
}
