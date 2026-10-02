import type { Meta, StoryObj } from "@storybook/react-vite"
import { Field, FieldDescription, FieldLabel } from "./field"
import { Input } from "./input"

const meta = {
  title: "Atoms/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use an input to collect a single line of free-form text." } },
  },
  args: { placeholder: "Type something", "aria-label": "Input", className: "w-72" },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLabel: Story = {
  render: (args) => (
    <Field className="w-72">
      <FieldLabel htmlFor="input-email">Email</FieldLabel>
      <Input {...args} id="input-email" type="email" placeholder="you@example.com" />
      <FieldDescription>We will never share your email.</FieldDescription>
    </Field>
  ),
}

export const Disabled: Story = { args: { disabled: true, defaultValue: "Read only value" } }

export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "not-an-email" } }

export const Password: Story = { args: { type: "password", defaultValue: "secret" } }

export const File: Story = { args: { type: "file" } }
