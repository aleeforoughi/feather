import type { Meta, StoryObj } from "@storybook/react-vite"
import { Marquee, Reel } from "./marquee"

const words = ["Calm", "Precise", "Fluid", "Tactile", "Honest", "Quiet"]
const Row = () => (
  <>
    {words.map((w) => (
      <span key={w} data-slot="story-word" className="type-display-s text-fg-primary">
        {w}
      </span>
    ))}
  </>
)

const meta = {
  title: "Website/Marquee",
  component: Marquee,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Marquee loops content across the page at a speed in px per second. It pauses on hover, on focus and from a visible button, and under reduced motion it is one static row. Reel is its manual sibling: a snap-scrolling row with previous and next buttons.",
      },
    },
  },
  args: { children: <Row />, speed: 60 },
} satisfies Meta<typeof Marquee>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Reverse: Story = { args: { direction: "right" } }
export const ReducedMotion: Story = {
  render: (args) => (
    <div data-motion="reduced">
      <Marquee {...args} />
    </div>
  ),
}
const ReelDemo = () => (
  <Reel aria-label="Principles">
    {words.map((w) => (
      <div key={w} data-slot="story-card" className="w-64 rounded-card border border-line-primary bg-surface-raised p-6 type-title text-fg-primary">
        {w}
      </div>
    ))}
  </Reel>
)
export const ReelStory: StoryObj<typeof Reel> = { name: "Reel", render: () => <ReelDemo /> }
export const ReelReducedMotion: StoryObj<typeof Reel> = {
  name: "Reel, reduced motion",
  render: () => (
    <div data-motion="reduced">
      <ReelDemo />
    </div>
  ),
}
