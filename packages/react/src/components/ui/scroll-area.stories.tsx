import type { Meta, StoryObj } from "@storybook/react-vite"
import { ScrollArea, ScrollBar } from "./scroll-area"
import { Separator } from "./separator"

const items = Array.from({ length: 30 }, (_, i) => `Item ${i + 1}`)

const meta = {
  title: "Atoms/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a scroll area to contain overflowing content in a fixed-size region with a themed scrollbar." } },
  },
  render: (args) => (
    <ScrollArea {...args} className="h-60 w-56 rounded-card border border-line-secondary">
      <div className="p-4">
        <h4 className="mb-2 type-label">Recent items</h4>
        {items.map((item) => (
          <div key={item}>
            <div className="py-2 type-body-sm">{item}</div>
            <Separator />
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
} satisfies Meta<typeof ScrollArea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Horizontal: Story = {
  render: (args) => (
    <ScrollArea {...args} className="w-72 rounded-card border border-line-secondary whitespace-nowrap">
      <div className="flex gap-3 p-4">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex size-20 shrink-0 items-center justify-center rounded-xs bg-surface-subtle type-body-sm">
            {i + 1}
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
}
