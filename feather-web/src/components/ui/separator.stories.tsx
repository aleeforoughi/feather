import type { Meta, StoryObj } from "@storybook/react-vite"
import { Separator } from "./separator"

const meta = {
  title: "Atoms/Separator",
  component: Separator,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a separator to visually divide groups of content without adding extra structure." } },
  },
  render: (args) => (
    <div className="w-72">
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Design system</h4>
        <p className="text-sm text-muted-foreground">Building blocks for consistent interfaces.</p>
      </div>
      <Separator {...args} className="my-4" />
      <p className="text-sm">Docs, tokens, and components.</p>
    </div>
  ),
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-5 items-center gap-4 text-sm">
      <span>Blog</span>
      <Separator {...args} />
      <span>Docs</span>
      <Separator {...args} />
      <span>Source</span>
    </div>
  ),
}
