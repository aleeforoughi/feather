import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArrowRight, Mail } from "lucide-react"
import { Button } from "./button"

const meta = {
  title: "Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a button to trigger an action; choose the variant by how much emphasis the action deserves." } },
  },
  argTypes: {
    variant: { control: "select", options: ["default", "secondary", "outline", "ghost", "destructive", "link"] },
    size: { control: "select", options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"] },
  },
  args: { children: "Button" },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Secondary: Story = { args: { variant: "secondary" } }
export const Outline: Story = { args: { variant: "outline" } }
export const Ghost: Story = { args: { variant: "ghost" } }
export const Destructive: Story = { args: { variant: "destructive", children: "Delete" } }
export const Link: Story = { args: { variant: "link" } }
export const Small: Story = { args: { size: "sm" } }
export const Large: Story = {
  args: {
    size: "lg",
    children: (
      <>
        Continue <ArrowRight />
      </>
    ),
  },
}
export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Mail /> Send email
      </>
    ),
  },
}
export const IconOnly: Story = { args: { size: "icon", "aria-label": "Send email", children: <Mail /> } }
export const Disabled: Story = { args: { disabled: true } }
