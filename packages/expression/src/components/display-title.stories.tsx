import type { Meta, StoryObj } from "@storybook/react-vite"
import { DisplayTitle } from "./display-title"

const meta = {
  title: "Website/DisplayTitle",
  component: DisplayTitle,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "Display type with a line, word or character reveal. Screen readers get the whole text; the split pieces are hidden from them. Under reduced motion it is plain text." } },
  },
  args: { children: "Design that answers to the person", as: "h1", size: "xl", split: "word" },
  decorators: [(Story) => <div data-slot="story-page" className="page-grid bg-surface-base py-12"><div className="col-span-full"><Story /></div></div>],
} satisfies Meta<typeof DisplayTitle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ByLine: Story = { args: { split: "line", size: "l", as: "h2" } }
export const ByCharacter: Story = { args: { split: "char", size: "m", as: "h2" } }
export const Whole: Story = { args: { split: "none", size: "s", as: "h2" } }
export const ReducedMotion: Story = { render: (args) => <div data-motion="reduced"><DisplayTitle {...args} /></div> }
