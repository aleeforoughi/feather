import type { Meta, StoryObj } from "@storybook/react-vite"
import { Check } from "lucide-react"
import { Badge } from "./badge"

const meta = {
  title: "Atoms/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a badge to label an item with a short status, count, or category." } },
  },
  args: { children: "Badge" },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Secondary: Story = { args: { variant: "secondary" } }
export const Outline: Story = { args: { variant: "outline" } }
export const Destructive: Story = { args: { variant: "destructive", children: "Failed" } }
export const Ghost: Story = { args: { variant: "ghost" } }
export const Link: Story = { args: { variant: "link" } }
export const WithIcon: Story = {
  args: {
    variant: "secondary",
    children: (
      <>
        <Check data-icon="inline-start" /> Verified
      </>
    ),
  },
}
