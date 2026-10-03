import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { PredictedChoice } from "./predicted-choice"

const meta = {
  title: "Organisms/PredictedChoice",
  component: PredictedChoice,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "A choice with the likely option preselected and marked \"Likely\" in text, with the reason. Keep accepts the prediction; picking another option turns the button into Use, which changes to it. Arrow keys move between the radios." } },
  },
  args: {
    onAct: fn(),
    intent: "pick the test length",
    prompt: "How long should the test run?",
    options: [
      { id: "3", label: "3 days", description: "Quick read, less certain." },
      { id: "7", label: "7 days", description: "A full week of data." },
      { id: "14", label: "14 days" },
    ],
    predicted: { option: "7", summary: "You picked 7 days the last two times.", confidence: 0.78 },
  },
  render: (args) => (
    <div className="w-[36rem] max-w-full">
      <PredictedChoice {...args} />
    </div>
  ),
} satisfies Meta<typeof PredictedChoice>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutConfidence: Story = { args: { predicted: { option: "7", summary: "Matches your usual choice." } } }

export const LowConfidence: Story = { args: { predicted: { option: "3", summary: "Only a guess from one earlier answer.", confidence: 0.32 } } }

export const MarkOnly: Story = { args: { predicted: { option: "14" } } }

export const LongText: Story = {
  args: {
    prompt: "A long question that keeps going so we can check that the prompt wraps cleanly inside the container on narrow screens?",
    options: [
      { id: "a", label: "An option label that is long enough to wrap across several lines when the container is narrow", description: "Its description is long too, and explains the option at length so that wrapping is exercised." },
      { id: "b", label: "Unbroken_option_label_that_is_far_too_long_to_fit_on_one_line_of_a_narrow_column" },
    ],
    predicted: { option: "a", summary: "A long reason why this option is likely, written as a full sentence that needs more than one line.", confidence: 0.9 },
  },
}

export const KeyboardAccept: Story = {
  name: "Keyboard: keep the prediction",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    // Focus lands on the preselected, likely radio.
    await expect(canvas.getByRole("radio", { name: /7 days/ })).toHaveFocus()
    await expect(canvas.getByText("Likely")).toBeVisible()
    await userEvent.tab()
    const keep = canvas.getByRole("button", { name: "Keep 7 days" })
    await expect(keep).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("accept")
  },
}

export const KeyboardChange: Story = {
  name: "Keyboard: change the option",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await userEvent.keyboard("{ArrowDown}")
    await expect(canvas.getByRole("radio", { name: /14 days/ })).toBeChecked()
    await userEvent.tab()
    await expect(canvas.getByRole("button", { name: "Use 14 days" })).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("change", "14")
  },
}

export const KeyboardBackToPredicted: Story = {
  name: "Keyboard: picking the likely option again shows Keep",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await userEvent.keyboard("{ArrowUp}")
    await expect(canvas.getByRole("button", { name: "Use 3 days" })).toBeVisible()
    await userEvent.keyboard("{ArrowDown}")
    await expect(canvas.getByRole("button", { name: "Keep 7 days" })).toBeVisible()
  },
}
