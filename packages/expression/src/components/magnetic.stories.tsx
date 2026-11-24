import type { Meta, StoryObj } from "@storybook/react-vite"
import { Cursor, Magnetic } from "./magnetic"

const Cta = () => (
  <button type="button" data-slot="story-cta" className="min-h-12 rounded-control border border-line-primary bg-surface-inverse px-6 type-label text-fg-inverse focus-ring">
    Get started
  </button>
)

const meta = {
  title: "Website/Magnetic",
  component: Magnetic,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Magnetic leans one child toward a fine pointer (strength 0.15). Cursor is an optional decorative ring that trails the pointer and never hides the native cursor. Both do nothing under reduced motion or with a touch pointer.",
      },
    },
  },
  args: { children: <Cta /> },
} satisfies Meta<typeof Magnetic>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <div data-slot="story-stage" className="p-16">
      <Magnetic {...args} />
      <Cursor />
    </div>
  ),
}
export const ReducedMotion: Story = {
  render: (args) => (
    <div data-motion="reduced" data-slot="story-stage" className="p-16">
      <Magnetic {...args} />
      <Cursor />
    </div>
  ),
}
