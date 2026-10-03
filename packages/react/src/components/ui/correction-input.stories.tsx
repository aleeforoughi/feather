import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { CorrectionInput } from "./correction-input"

const meta = {
  title: "Organisms/CorrectionInput",
  component: CorrectionInput,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "The person corrects something that was understood wrong. Shows what was understood and a labelled text field; Submit is disabled while it is blank, Enter submits, and after submitting the field clears and keeps focus." } },
  },
  args: { onAct: fn(), intent: "correct the audience", prompt: "Who did you mean?", original: "Runners in Dubai" },
  render: (args) => (
    <div className="w-[36rem] max-w-full">
      <CorrectionInput {...args} />
    </div>
  ),
} satisfies Meta<typeof CorrectionInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutOriginal: Story = { args: { original: undefined } }

export const WithInput: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByLabelText("Who did you mean?")
    field.focus()
    await userEvent.keyboard("Cyclists in Abu Dhabi")
    await expect(canvas.getByRole("button", { name: "Submit correction" })).toBeEnabled()
  },
}

export const LongText: Story = {
  args: {
    prompt: "A long question that keeps going so we can check that the label wraps cleanly inside the container on a narrow screen?",
    original: "Unbroken_text_that_was_understood_and_is_far_too_long_to_fit_on_one_line_of_a_narrow_column and then some more words that wrap normally",
  },
}

export const KeyboardSubmit: Story = {
  name: "Keyboard: type and press Enter",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    const field = canvas.getByLabelText("Who did you mean?")
    await expect(field).toHaveFocus()
    const submit = canvas.getByRole("button", { name: "Submit correction" })
    await expect(submit).toBeDisabled()
    await userEvent.keyboard("   {Enter}")
    await expect(args.onAct).not.toHaveBeenCalled()
    await userEvent.keyboard("Cyclists in Abu Dhabi{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("submit", "Cyclists in Abu Dhabi")
    await expect(field).toHaveValue("")
    await expect(field).toHaveFocus()
    await expect(submit).toBeDisabled()
  },
}

export const KeyboardSubmitButton: Story = {
  name: "Keyboard: submit with the button",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await userEvent.keyboard("Hikers")
    await userEvent.tab()
    await expect(canvas.getByRole("button", { name: "Submit correction" })).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("submit", "Hikers")
    await expect(canvas.getByLabelText("Who did you mean?")).toHaveFocus()
  },
}
