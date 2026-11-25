import type { Meta, StoryObj } from "@storybook/react-vite"
import { Checkbox } from "./checkbox"
import { useState } from "react"
import { Button } from "./button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet, FieldSuccess } from "./field"
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

export const WithSuccess: Story = {
  render: (args) => (
    <Field {...args} className="w-80">
      <FieldLabel htmlFor="field-username">Username</FieldLabel>
      <Input id="field-username" defaultValue="jordan" />
      <FieldSuccess>Username available</FieldSuccess>
    </Field>
  ),
}

function CheckFlow() {
  const [value, setValue] = useState("")
  const [result, setResult] = useState<"none" | "error" | "success">("none")
  const check = () => setResult(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? "success" : "error")
  return (
    <Field data-invalid={result === "error" || undefined} className="w-80">
      <FieldLabel htmlFor="field-states">Email</FieldLabel>
      <Input
        id="field-states"
        type="email"
        placeholder="you@example.com"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setResult("none")
        }}
        aria-invalid={result === "error" || undefined}
        aria-describedby={result === "none" ? undefined : "field-states-outcome"}
      />
      {result === "error" && <FieldError id="field-states-outcome">Enter a valid email address.</FieldError>}
      {result === "success" && <FieldSuccess id="field-states-outcome">Looks right</FieldSuccess>}
      <Button variant="outline" className="w-fit" onClick={check}>
        Check
      </Button>
    </Field>
  )
}

/** Press Check with a wrong address (the field shakes 3px once and the message fades in), then a right one (a check draws on). */
export const States: Story = { render: () => <CheckFlow /> }
