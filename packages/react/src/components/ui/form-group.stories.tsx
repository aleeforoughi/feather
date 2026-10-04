import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { FormGroup, type FormGroupField } from "./form-group"

const posterFields: FormGroupField[] = [
  { id: "market_time", group: "Schedule", prompt: "Market time", kind: "text", maxLength: 200 },
  { id: "opening_date", group: "Schedule", prompt: "First market day", kind: "date" },
  { id: "venue", group: "Place", prompt: "Venue address", kind: "long-text", maxLength: 1000 },
  { id: "stall_fee", group: "Money", prompt: "Stall fee", kind: "money", currency: "AED", min: 0 },
  { id: "contact", group: "Contact", prompt: "Contact email", kind: "email" },
]

const addressFields: FormGroupField[] = [
  { id: "name", prompt: "Full name", kind: "text", required: true },
  { id: "street", prompt: "Street and number", kind: "text", required: true },
  { id: "city", prompt: "City", kind: "text", required: true },
  { id: "phone", prompt: "Phone for the courier", kind: "phone" },
]

const meta = {
  title: "Organisms/FormGroup",
  component: FormGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Several questions asked together and sent with one act (IR node Form). One submit button, a Skip only when nothing is required, every answer checked on submit with each problem beside its field, and a sent state that keeps the values visible. Empty optional fields are left out of the answer.",
      },
    },
  },
  args: {
    id: "details",
    intent: "give the details I know",
    prompt: "Details for the farmers market poster",
    submitLabel: "Run again with my answers",
    fields: posterFields,
    importance: "normal",
    primary: true,
    onAct: fn(),
    className: "w-[34rem] max-w-full",
  },
} satisfies Meta<typeof FormGroup>

export default meta
type Story = StoryObj<typeof meta>

/** The poster details: five optional questions under four group headings, so it can be skipped. */
export const Default: Story = {}

/** The shipping address: three required questions, so there is no Skip. */
export const AllRequired: Story = {
  args: { id: "address", intent: "give the shipping address", prompt: undefined, submitLabel: undefined, fields: addressFields },
}

/** Not primary: the submit button is secondary. */
export const NotPrimary: Story = { args: { primary: false } }

/** Every kind of field. */
export const EveryKind: Story = {
  args: {
    intent: "tell us about the stall",
    prompt: "About the stall",
    submitLabel: undefined,
    fields: [
      { id: "title", prompt: "Stall name", kind: "text", maxLength: 80, value: "Mariam's dates" },
      { id: "story", prompt: "Your story", kind: "long-text" },
      { id: "count", prompt: "Tables needed", kind: "number", min: 1, max: 6 },
      { id: "fee", prompt: "Fee you can pay", kind: "money", currency: "AED", min: 0, max: 5000 },
      { id: "email", prompt: "Email", kind: "email" },
      { id: "phone", prompt: "Phone", kind: "phone" },
      { id: "site", prompt: "Website", kind: "url" },
      { id: "start", prompt: "Start date", kind: "date" },
    ],
  },
}

/** Submitting with bad answers shows each problem beside its field and moves focus to the first. */
export const WithErrors: Story = {
  args: { id: "address", intent: "give the shipping address", prompt: "Where should it go?", submitLabel: undefined, fields: addressFields },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText("Phone for the courier"), "call me")
    await userEvent.click(canvas.getByRole("button", { name: "Give the shipping address" }))
    await expect(args.onAct).not.toHaveBeenCalled()
    await expect(canvas.getByLabelText("Full name")).toHaveFocus()
    await expect(canvas.getByLabelText("Full name")).toHaveAttribute("aria-invalid", "true")
    await expect(canvas.getByLabelText("Phone for the courier")).toHaveAttribute("aria-invalid", "true")
  },
}

/** Filled in and sent: the values stay visible, read-only, with the status message and no control that could send again. */
export const Sent: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText("Market time"), "Saturdays, 8am to 1pm")
    await userEvent.type(canvas.getByLabelText("Contact email"), "market@example.com")
    await userEvent.click(canvas.getByRole("button", { name: "Run again with my answers" }))
    await expect(args.onAct).toHaveBeenCalledWith("submit", { market_time: "Saturdays, 8am to 1pm", contact: "market@example.com" })
    await expect(canvas.getByRole("status")).toHaveTextContent("Sent. 2 answers were sent.")
    await expect(canvas.queryByRole("button", { name: "Run again with my answers" })).toBeNull()
  },
}

/** Skipped: nothing was sent, and the form says so. */
export const Skipped: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Skip" }))
    await expect(args.onAct).toHaveBeenCalledWith("skip")
    await expect(canvas.getByRole("status")).toHaveTextContent("Skipped.")
  },
}

export const WithExpandable: Story = {
  args: { expandable: { why: "A detail you leave empty stays a marked placeholder.", detail: "You can run it again with more details at any time." } },
}

export const Critical: Story = {
  args: {
    importance: "critical",
    expandable: { why: "The courier cannot collect the parcel without a full address.", detail: "A missing street or city holds the parcel at the depot." },
    id: "address",
    intent: "give the shipping address",
    prompt: "Where should it go?",
    submitLabel: undefined,
    fields: addressFields,
  },
}

export const LongText: Story = {
  args: {
    className: "w-72",
    prompt: "A long heading that keeps going so we can check that it wraps cleanly inside a narrow container on a phone",
    fields: [
      { id: "a", group: "A group with a name that is also far too long to fit on one line of a narrow column", prompt: "A question that needs a lot of words to ask, so that its label has to wrap onto several lines", kind: "text", required: true },
      { id: "b", group: "A group with a name that is also far too long to fit on one line of a narrow column", prompt: "Unbroken_label_that_is_far_too_long_to_fit_on_one_line_of_a_narrow_column", kind: "money", currency: "AED", min: 0, max: 100000 },
    ],
  },
}

/** Tab through the fields, type, and press Enter in a single-line field: one act, with only the answered fields. */
export const KeyboardSubmit: Story = {
  name: "Keyboard: type and press Enter",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(canvas.getByLabelText("Market time")).toHaveFocus()
    await userEvent.keyboard("Sundays{Enter}")
    await expect(args.onAct).toHaveBeenCalledTimes(1)
    await expect(args.onAct).toHaveBeenCalledWith("submit", { market_time: "Sundays" })
  },
}
