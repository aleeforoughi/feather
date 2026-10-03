import type { Meta, StoryObj } from "@storybook/react-vite"
import { Tradeoff } from "./tradeoff"

const meta = {
  title: "Organisms/Tradeoff",
  component: Tradeoff,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "What one option gains and costs, as two titled lists. Each item has a screen-reader word (Gain: or Cost:), so meaning never depends on color. Renders the IR Tradeoff node; it takes no acts." } },
  },
  args: {
    gains: ["Reaches 3x more people", "Results in 7 days"],
    costs: ["Spends AED 1,050", "Needs a new creative"],
  },
  render: (args) => (
    <div className="w-[36rem] max-w-full">
      <Tradeoff {...args} />
    </div>
  ),
} satisfies Meta<typeof Tradeoff>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithSummary: Story = { args: { summary: "Faster, but you pay more up front." } }

export const GainsOnly: Story = { args: { costs: undefined } }

export const CostsOnly: Story = { args: { gains: undefined } }

export const High: Story = { args: { importance: "high", summary: "Worth a close look." } }

export const Critical: Story = { args: { importance: "critical", summary: "This cannot be undone." } }

export const LongText: Story = {
  args: {
    summary: "A very long summary that keeps going to check that the text wraps inside the container and never forces the page to scroll sideways, even on a narrow phone screen.",
    gains: ["A gain written as a long sentence that has to wrap onto several lines without overflowing its column at all"],
    costs: ["Supercalifragilisticexpialidocious_unbroken_token_that_is_far_too_long_to_fit_on_one_line_of_a_narrow_column"],
  },
}
