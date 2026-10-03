import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { Recommendation } from "./recommendation"

const meta = {
  title: "Organisms/Recommendation",
  component: Recommendation,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "What the caller recommends (IR node Recommendation). One button accepts it. Confidence is words plus a percentage. An irreversible recommendation never commits on accept unless it states its own consequence." } } },
  args: {
    intent: "run a 7-day test",
    summary: "Run a 7-day test on weekday evenings before committing the full budget.",
    confidence: 0.64,
    onAct: fn(),
    className: "w-[34rem]",
  },
} satisfies Meta<typeof Recommendation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Primary: Story = { args: { primary: true, label: "Start the 7-day test", confidence: 0.86 } }

export const WithExpandable: Story = {
  args: { expandable: { why: "Your last three campaigns converted best on weekday evenings.", detail: "41, 38 and 44 sign-ups per evening, against 17 at weekends." } },
}

export const Critical: Story = {
  args: {
    importance: "critical",
    confidence: 0.92,
    expandable: { why: "The current ad set breaches the platform's policy.", detail: "Two creatives were flagged. Running them risks the whole account." },
  },
}

export const IrreversibleWithConsequence: Story = {
  args: { intent: "book the venue", summary: "Book the Marina hall for the launch.", reversible: false, consequence: { spend: { amount: 1050, currency: "AED" } }, confidence: 0.81 },
}

export const IrreversibleNeedsConfirmation: Story = {
  args: { intent: "book the venue", summary: "Book the Marina hall for the launch.", reversible: false, confidence: 0.55 },
}

export const LowConfidence: Story = { args: { confidence: 0.2 } }

export const LongText: Story = {
  args: {
    className: "w-72",
    intent: "move the entire remaining quarterly budget to the three best-performing channels",
    summary: "Move the entire remaining quarterly budget to the three best-performing channels and pause everything that returned less than the minimum for ninety days running.",
    confidence: 0.77,
    reversible: false,
    consequence: { spend: { amount: 48250.75, currency: "AED" }, statement: "Paused campaigns lose their learning history and start from zero if restarted." },
    expandable: { why: "Display returned under one unit per unit spent across every region we measured, and the trend is not improving." },
  },
}

export const Keyboard: Story = {
  args: { primary: true, label: "Start the 7-day test", expandable: { why: "Your last three campaigns converted best on weekday evenings." } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    const accept = canvas.getByRole("button", { name: "Accept recommendation: Start the 7-day test" })
    await expect(accept).toHaveFocus()
    await expect(accept).toHaveAccessibleDescription("Accepting applies it. You can undo it.")
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByRole("button", { name: "Why?" })).toHaveAttribute("aria-expanded", "true")
    await userEvent.tab({ shift: true })
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("accept")
    await expect(canvas.getByRole("button", { name: "Why?" })).toHaveAttribute("aria-expanded", "false")
  },
}
