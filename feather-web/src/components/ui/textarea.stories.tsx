import type { Meta, StoryObj } from "@storybook/react-vite"
import { Field, FieldDescription, FieldLabel } from "./field"
import { Textarea } from "./textarea"

const meta = {
  title: "Atoms/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a textarea to collect multi-line free-form text such as comments or descriptions." } },
  },
  args: { placeholder: "Type your message here", "aria-label": "Message", className: "w-80" },
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLabel: Story = {
  render: (args) => (
    <Field className="w-80">
      <FieldLabel htmlFor="textarea-bio">Bio</FieldLabel>
      <Textarea {...args} id="textarea-bio" placeholder="Tell us a little about yourself" />
      <FieldDescription>Up to 280 characters.</FieldDescription>
    </Field>
  ),
}

export const Disabled: Story = { args: { disabled: true, defaultValue: "This field cannot be edited." } }

export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "Too short" } }
