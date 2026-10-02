import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "./popover"

const meta = {
  title: "Atoms/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a popover to show small, non-modal content or controls anchored to the element that opened it." } },
  },
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>Set the size for this layer.</PopoverDescription>
        </PopoverHeader>
        <Input defaultValue="100%" aria-label="Width" />
      </PopoverContent>
    </Popover>
  ),
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const OpenOnLoad: Story = { args: { defaultOpen: true } }

export const AlignedTop: Story = {
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger render={<Button variant="outline" />}>Above</PopoverTrigger>
      <PopoverContent side="top" align="center">
        <PopoverDescription>This popover opens above its trigger.</PopoverDescription>
      </PopoverContent>
    </Popover>
  ),
}
