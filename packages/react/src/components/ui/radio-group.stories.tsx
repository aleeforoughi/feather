import type { Meta, StoryObj } from "@storybook/react-vite"
import { Label } from "./label"
import { RadioGroup, RadioGroupItem } from "./radio-group"

const meta = {
  title: "Atoms/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a radio group when people must pick exactly one option from a short list." } },
  },
  args: { defaultValue: "comfortable" },
  render: (args) => (
    <RadioGroup {...args}>
      {[
        ["compact", "Compact"],
        ["comfortable", "Comfortable"],
        ["spacious", "Spacious"],
      ].map(([value, label]) => (
        <div key={value} className="flex items-center gap-2">
          <RadioGroupItem value={value} id={`radio-${value}`} />
          <Label htmlFor={`radio-${value}`}>{label}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
} satisfies Meta<typeof RadioGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = { args: { disabled: true } }

export const Horizontal: Story = { args: { className: "flex gap-6" } }
