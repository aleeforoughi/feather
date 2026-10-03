import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { AlternativeList } from "./alternative-list"

const meta = {
  title: "Organisms/AlternativeList",
  component: AlternativeList,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "Other ways to go, each a button with its Tradeoff under it. An alternative with an input opens an inline labelled field when chosen; Use this submits once the value is valid, and Escape cancels. Replies with onAct(id, \"choose\", value?)." } },
  },
  args: {
    onAct: fn(),
    alternatives: [
      {
        id: "shorter",
        intent: "run a shorter test",
        label: "Run a 3-day test",
        tradeoff: { gains: ["Results sooner", "Spends less"], costs: ["Less certain"] },
      },
      {
        id: "own",
        intent: "set my own budget",
        label: "Set my own budget",
        input: "Price",
        currency: "AED",
        tradeoff: { summary: "You decide how much to spend." },
      },
      { id: "later", intent: "decide later" },
    ],
  },
  render: (args) => (
    <div className="w-[36rem] max-w-full">
      <AlternativeList {...args} />
    </div>
  ),
} satisfies Meta<typeof AlternativeList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InputKinds: Story = {
  args: {
    alternatives: [
      { id: "price", intent: "pay a different price", input: "Price", currency: "USD" },
      { id: "date", intent: "pick another day", label: "Choose another date", input: "Date" },
      { id: "text", intent: "say what you prefer", input: "Text" },
      { id: "place", intent: "meet somewhere else", input: "Location" },
      { id: "who", intent: "ask someone else", input: "Person" },
    ],
  },
}

export const PriceInputOpen: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    canvas.getByRole("button", { name: "Set my own budget" }).focus()
    await userEvent.keyboard("{Enter}")
    const field = await canvas.findByLabelText(/Price for Set my own budget/)
    await expect(field).toHaveFocus()
    await expect(canvas.getByRole("button", { name: "Use this" })).toBeDisabled()
    await expect(args.onAct).not.toHaveBeenCalled()
  },
}

export const Chosen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole("button", { name: /Run a 3-day test/ }).focus()
    await userEvent.keyboard("{Enter}")
  },
}

export const LongText: Story = {
  args: {
    alternatives: [
      {
        id: "long",
        intent: "go another way",
        label: "An alternative with a very long label that keeps going so we can check that it wraps inside the card instead of overflowing sideways",
        tradeoff: {
          summary: "A long summary that explains the tradeoff in more words than will fit on one line of a narrow container.",
          gains: ["A long gain that has to wrap onto several lines without overflowing its column"],
          costs: ["Unbroken_token_that_is_far_too_long_to_fit_on_one_line_of_a_narrow_column_in_any_theme"],
        },
      },
    ],
  },
}

export const KeyboardChooseWithValue: Story = {
  name: "Keyboard: choose with a price",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    // Tab reaches the alternatives in reading order.
    await userEvent.tab()
    await expect(canvas.getByRole("button", { name: /Run a 3-day test/ })).toHaveFocus()
    await userEvent.tab()
    const own = canvas.getByRole("button", { name: /Set my own budget/ })
    await expect(own).toHaveFocus()

    // Enter opens the field and moves focus into it. Nothing is sent yet.
    await userEvent.keyboard("{Enter}")
    const amount = await canvas.findByLabelText(/Price for Set my own budget/)
    await expect(amount).toHaveFocus()
    await expect(args.onAct).not.toHaveBeenCalled()

    // Escape cancels and returns focus to the alternative.
    await userEvent.keyboard("{Escape}")
    await expect(own).toHaveFocus()
    await expect(canvas.queryByLabelText(/Price for Set my own budget/)).toBeNull()
    await expect(args.onAct).not.toHaveBeenCalled()

    // Open again, type an amount, tab past the currency to "Use this", press Enter.
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("800")
    const use = canvas.getByRole("button", { name: "Use this" })
    await expect(use).toBeEnabled()
    await userEvent.tab()
    await expect(canvas.getByLabelText("Currency")).toHaveFocus()
    await userEvent.tab()
    await expect(use).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("own", "choose", { amount: 800, currency: "AED" })
    await expect(own).toHaveFocus()
    await expect(canvas.getByText("Chosen")).toBeVisible()
  },
}

export const KeyboardChooseSimple: Story = {
  name: "Keyboard: choose without a value",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await userEvent.keyboard(" ")
    await expect(args.onAct).toHaveBeenCalledWith("shorter", "choose")
    await expect(canvas.getByRole("button", { name: /Run a 3-day test/ })).toHaveFocus()
  },
}
