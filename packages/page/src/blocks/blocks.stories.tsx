import type { Meta, StoryObj } from "@storybook/react-vite"
import { defaultBlocks } from "./index"
import { BLOCKS } from "./fixtures"

// One story per block, with the reference document's content. Placeholder media is an inline SVG.
const meta = {
  title: "Pages/Blocks",
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "The default block library of feather.page/0. Each block is a labelled region built from the expression primitives; a brand restyles all of them through tokens." } },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Hero: Story = { render: () => <defaultBlocks.hero block={BLOCKS.hero} onAsk={() => {}} /> }
export const HeroWithoutModel: Story = { render: () => <defaultBlocks.hero block={BLOCKS.hero} /> }
export const Statement: Story = { render: () => <defaultBlocks.statement block={BLOCKS.statement} /> }
export const Work: Story = { render: () => <defaultBlocks.work block={BLOCKS.work} /> }
export const Case: Story = { render: () => <defaultBlocks.case block={BLOCKS.case} /> }
export const Numbers: Story = { render: () => <defaultBlocks.numbers block={BLOCKS.numbers} /> }
export const Timeline: Story = { render: () => <defaultBlocks.timeline block={BLOCKS.timeline} /> }
export const Process: Story = { render: () => <defaultBlocks.process block={BLOCKS.process} /> }
export const Logos: Story = { render: () => <defaultBlocks.logos block={BLOCKS.logos} /> }
export const LogosMarquee: Story = {
  render: () => <defaultBlocks.logos block={{ ...BLOCKS.logos, items: Array.from({ length: 10 }, (_, i) => ({ name: `Studio ${i + 1}` })) }} />,
}
export const Quote: Story = { render: () => <defaultBlocks.quote block={BLOCKS.quote} /> }
export const Offer: Story = { render: () => <defaultBlocks.offer block={BLOCKS.offer} /> }
export const Faq: Story = { render: () => <defaultBlocks.faq block={BLOCKS.faq} /> }
export const Contact: Story = { render: () => <defaultBlocks.contact block={BLOCKS.contact} /> }
export const Signature: Story = { render: () => <defaultBlocks.signature block={BLOCKS.signature} /> }
