import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { WhyDisclosure } from "./why-disclosure"

const meta = {
  title: "Organisms/WhyDisclosure",
  component: WhyDisclosure,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "The \"Why?\" control: a real button with aria-expanded and aria-controls, closed by default. With `forceOpen` (a critical node) the detail shows with no control." } } },
  args: {
    className: "w-[28rem]",
    expandable: { why: "Weekday evenings brought the most sign-ups in your last three campaigns.", detail: "Sign-ups per weekday evening: 41, 38 and 44, against 17 at weekends." },
  },
} satisfies Meta<typeof WhyDisclosure>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

export const Open: Story = { args: { open: true } }

export const ForcedOpen: Story = { args: { forceOpen: true } }

export const WhyOnly: Story = { args: { expandable: { why: "It matches the budget you set." } } }

export const LongText: Story = {
  args: {
    className: "w-72",
    open: true,
    expandable: {
      why: "The three channels with the best return over the last ninety days are the ones this plan puts most of the money into, which is why it looks lopsided.",
      detail: "Search returned 4.1 per unit spent, email 3.8, and display 0.9, so display receives only the minimum the contract requires.",
    },
  },
}

export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    const trigger = canvas.getByRole("button", { name: "Why?" })
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.keyboard("{Enter}")
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(canvas.getByText(/Weekday evenings/)).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard(" ")
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
  },
}
