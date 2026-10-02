import type { Meta, StoryObj } from "@storybook/react-vite"
import { Checkbox } from "./checkbox"
import { Label } from "./label"

const meta = {
  title: "Atoms/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a checkbox when people can toggle one or more independent options on or off." } },
  },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { "aria-label": "Accept" } }

export const Checked: Story = { args: { defaultChecked: true, "aria-label": "Accept" } }

export const Disabled: Story = { args: { disabled: true, "aria-label": "Accept" } }

export const Invalid: Story = { args: { "aria-invalid": true, "aria-label": "Accept" } }

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" {...args} />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
}
