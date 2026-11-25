import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Button } from "./button"
import { Checkbox } from "./checkbox"
import { FieldError } from "./field"
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

function TermsFlow() {
  const [accepted, setAccepted] = useState(false)
  const [tried, setTried] = useState(false)
  const invalid = tried && !accepted
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-control items-center gap-2">
        <Checkbox id="states-terms" checked={accepted} onCheckedChange={setAccepted} aria-invalid={invalid || undefined} aria-describedby={invalid ? "states-terms-error" : undefined} />
        <Label htmlFor="states-terms">Accept the terms</Label>
      </div>
      {invalid && <FieldError id="states-terms-error">Accept the terms to continue.</FieldError>}
      <Button variant="outline" className="w-fit" onClick={() => setTried(true)}>
        Continue
      </Button>
    </div>
  )
}

/** Toggle a box (it fills, the check draws on, unchecking fades it), press one (it scales), or press Continue unchecked (it shakes and says why). */
export const States: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex h-control items-center gap-6">
        <Checkbox aria-label="Unchecked" />
        <Checkbox aria-label="Checked" defaultChecked />
        <Checkbox aria-label="Disabled" disabled />
      </div>
      <TermsFlow />
    </div>
  ),
}
