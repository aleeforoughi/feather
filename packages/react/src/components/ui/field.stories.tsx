import type { Meta, StoryObj } from "@storybook/react-vite"
import { Checkbox } from "./checkbox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet } from "./field"
import { Input } from "./input"

const meta = {
  title: "Atoms/Field",
  component: Field,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "Use a field to pair a form control with its label, helper text, and validation message." } },
  },
  render: (args) => (
    <Field {...args} className="w-80">
      <FieldLabel htmlFor="field-email">Email</FieldLabel>
      <Input id="field-email" type="email" placeholder="you@example.com" />
      <FieldDescription>We will only use it to send receipts.</FieldDescription>
    </Field>
  ),
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithError: Story = {
  render: (args) => (
    <Field {...args} data-invalid className="w-80">
      <FieldLabel htmlFor="field-error">Email</FieldLabel>
      <Input id="field-error" type="email" defaultValue="not-an-email" aria-invalid />
      <FieldError>Enter a valid email address.</FieldError>
    </Field>
  ),
}

export const Horizontal: Story = {
  args: { orientation: "horizontal" },
  render: (args) => (
    <Field {...args} className="w-80">
      <Checkbox id="field-news" />
      <FieldLabel htmlFor="field-news">Subscribe to the newsletter</FieldLabel>
    </Field>
  ),
}

export const FieldSetGroup: Story = {
  render: () => (
    <FieldSet className="w-80">
      <FieldLegend>Account</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="fs-name">Name</FieldLabel>
          <Input id="fs-name" placeholder="Jordan Lee" />
        </Field>
        <FieldSeparator>or</FieldSeparator>
        <Field>
          <FieldLabel htmlFor="fs-handle">Handle</FieldLabel>
          <Input id="fs-handle" placeholder="@jordan" />
          <FieldDescription>Shown on your public profile.</FieldDescription>
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
}
