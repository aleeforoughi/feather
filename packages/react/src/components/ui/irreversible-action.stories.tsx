import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"
import { IrreversibleAction } from "./irreversible-action"

const meta = {
  title: "Organisms/IrreversibleAction",
  component: IrreversibleAction,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "An act that cannot be undone (IR node IrreversibleAction). The consequence shows first. Confirm mode arms, then asks again beside Cancel; hold mode needs a 1.5 s hold. It never takes the default focus." } } },
  args: {
    intent: "spend the campaign budget",
    label: "Spend AED 1,050",
    consequence: { spend: { amount: 1050, currency: "AED" } },
    onAct: fn(),
    className: "w-[34rem]",
  },
} satisfies Meta<typeof IrreversibleAction>

/** After the act: done, no control left, focus on the outcome, and `onAct` called exactly once. */
async function expectDone(canvasElement: HTMLElement, onAct: unknown, text: string) {
  const root = canvasElement.querySelector('[data-slot="irreversible-action"]')!
  await expect(root).toHaveAttribute("data-variant", "done")
  await expect(root.querySelectorAll("button")).toHaveLength(0)
  const outcome = canvasElement.querySelector('[data-slot="irreversible-action-outcome"]')!
  await expect(outcome).toHaveTextContent(text)
  await expect(document.activeElement).toBe(outcome)
  await expect(onAct).toHaveBeenCalledTimes(1)
  await expect(canvasElement.querySelector('[data-slot="irreversible-action-warning"]')).toBeVisible()
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const High: Story = { args: { importance: "high", intent: "publish the announcement", label: "Publish", consequence: { publish: { audience: "all subscribers" } } } }

export const WithExpandable: Story = {
  args: { importance: "high", expandable: { why: "The booking closes tonight and the price rises tomorrow.", detail: "Cancelling after confirmation forfeits the deposit." } },
}

export const Critical: Story = {
  args: {
    importance: "critical",
    intent: "delete the archive",
    label: "Delete the archive",
    consequence: { delete: { what: "the 2025 campaign archive" } },
    expandable: { why: "The archive holds the only copy of the signed contracts.", detail: "Nothing else is stored with it." },
  },
}

export const Armed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByRole("button", { name: "Yes, spend AED 1,050" })).toHaveFocus()
  },
}

export const Hold: Story = { args: { mode: "hold" } }

export const MultipleConsequences: Story = {
  args: {
    intent: "launch the campaign",
    label: "Launch the campaign",
    consequence: { spend: { amount: 1050, currency: "AED" }, publish: { audience: "everyone in the UAE" }, send: { to: "the agency", channel: "email" } },
  },
}

export const LongText: Story = {
  args: {
    className: "w-72",
    label: "Grant access to the whole analytics workspace and every connected ad account",
    consequence: { consent: { to: "Acme Analytics Incorporated and its subprocessors", scope: "every ad account, audience list and conversion export in your organisation" } },
    expandable: { why: "The integration cannot read any data until you grant this, and it cannot be limited afterwards." },
  },
}

export const KeyboardConfirm: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const first = canvas.getByRole("button", { name: /^Spend AED 1,050/ })
    await expect(first).not.toHaveFocus()
    await expect(args.onAct).not.toHaveBeenCalled()
    await userEvent.tab()
    await expect(first).toHaveFocus()
    await expect(first).toHaveAccessibleDescription("Spends AED 1,050")
    await userEvent.keyboard("{Enter}")
    await expect(first).toHaveAttribute("data-variant", "armed")
    await expect(canvasElement.querySelector('[data-slot="irreversible-action"]')).toHaveAttribute("data-variant", "armed")
    await expect(canvas.getByRole("status")).toHaveTextContent("Armed: press again to spend AED 1,050")
    const yes = canvas.getByRole("button", { name: "Yes, spend AED 1,050" })
    await expect(yes).toHaveFocus()
    await expect(args.onAct).not.toHaveBeenCalled()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("confirm")
    await expectDone(canvasElement, args.onAct, "Confirmed: spends AED 1,050")
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledTimes(1)
  },
}

export const KeyboardCancel: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await userEvent.keyboard(" ")
    await expect(canvas.getByRole("button", { name: "Yes, spend AED 1,050" })).toHaveFocus()
    await userEvent.keyboard("{Escape}")
    await expect(args.onAct).toHaveBeenCalledWith("cancel")
    await expect(args.onAct).not.toHaveBeenCalledWith("confirm")
    await expect(canvas.getByRole("button", { name: /^Spend AED 1,050/ })).toHaveFocus()
    await expect(canvas.queryByRole("button", { name: /^Yes/ })).toBeNull()
    await expect(canvasElement.querySelector('[data-slot="irreversible-action"]')).toHaveAttribute("data-variant", "idle")
  },
}

export const KeyboardHold: Story = {
  args: { mode: "hold", holdMs: 300 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    // One user instance, so a key held down in one call is released in the next.
    const user = userEvent.setup()
    await user.tab()
    const button = canvas.getByRole("button", { name: /Hold to spend AED 1,050/ })
    await expect(button).toHaveFocus()
    // Released early: nothing happens.
    await user.keyboard("{Enter>}")
    await new Promise((r) => setTimeout(r, 80))
    await user.keyboard("{/Enter}")
    await new Promise((r) => setTimeout(r, 400))
    await expect(args.onAct).not.toHaveBeenCalled()
    // Held for the whole time: confirms once.
    await user.keyboard("[Space>]")
    await new Promise((r) => setTimeout(r, 600))
    await user.keyboard("[/Space]")
    await waitFor(() => expect(args.onAct).toHaveBeenCalledTimes(1))
    await expect(args.onAct).toHaveBeenCalledWith("confirm")
    await expectDone(canvasElement, args.onAct, "Confirmed: spends AED 1,050")
  },
}
