import type { Meta, StoryObj } from "@storybook/react-vite"
import { Counter } from "./counter"

const meta = {
  title: "Website/Counter",
  component: Counter,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Counter counts up to its value as it enters the viewport, in tabular figures so the width holds. Assistive technology reads the final value only. Under reduced motion the final value is shown at once.",
      },
    },
  },
  args: { value: 1280, unit: "ms", className: "type-display-s text-fg-primary" },
} satisfies Meta<typeof Counter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Decimals: Story = { args: { value: 99.9, unit: "%" } }
export const ReducedMotion: Story = {
  render: (args) => (
    <div data-motion="reduced">
      <Counter {...args} />
    </div>
  ),
}
