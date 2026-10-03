import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { Approval } from "./approval"

const meta = {
  title: "Organisms/Approval",
  component: Approval,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "A request for the person's authority (IR node Approval), built on AttentionCard. Approve performs `approve`, arming first when the act is irreversible and states a consequence. Reject opens an optional reason." } } },
  args: {
    intent: "approve the ad budget",
    request: "Raise the weekly ad budget to AED 5,000",
    requester: { name: "Media planner", role: "Planner", kind: "agent" },
    scope: "Weekly budget for the spring campaign",
    onAct: fn(),
    className: "w-[40rem]",
  },
} satisfies Meta<typeof Approval>

/** After the decision: done, no control left, focus on the outcome, and `onAct` called exactly once. */
async function expectDone(canvasElement: HTMLElement, onAct: unknown, text: string) {
  const root = canvasElement.querySelector('[data-slot="approval"]')!
  await expect(root).toHaveAttribute("data-variant", "done")
  await expect(root.querySelectorAll("button")).toHaveLength(0)
  const outcome = canvasElement.querySelector('[data-slot="approval-outcome"]')!
  await expect(outcome).toHaveTextContent(text)
  await expect(document.activeElement).toBe(outcome)
  await expect(onAct).toHaveBeenCalledTimes(1)
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithExpandable: Story = {
  args: { expandable: { why: "Weekday evenings are outperforming the plan, and the budget is spent by Thursday.", detail: "Current budget AED 3,500 a week; 94% spent by Thursday for three weeks running." } },
}

export const Critical: Story = {
  args: {
    importance: "critical",
    request: "Share customer emails with the agency",
    consequence: { consent: { to: "Northwind Agency", scope: "your customer email list" } },
    expandable: { why: "The agency needs the list to run the lookalike campaign.", detail: "12,400 addresses; no phone numbers or purchase history." },
  },
}

export const Irreversible: Story = {
  args: { intent: "approve the payment", request: "Pay the venue deposit", reversible: false, consequence: { spend: { amount: 1050, currency: "AED" } } },
}

export const ReversibleWithConsequence: Story = {
  args: { request: "Send the draft to the board", consequence: { send: { to: "the board", channel: "email" } } },
}

export const LongText: Story = {
  args: {
    className: "w-80",
    intent: "approve the long-running vendor contract renewal",
    request: "Renew the three-year agency retainer, including the optional creative studio and the regional media buying add-ons",
    requester: { name: "Procurement and vendor operations assistant", role: "Procurement", kind: "agent" },
    scope: "Everything in the renewal schedule, including the add-ons and the annual price indexation clause",
    reversible: false,
    consequence: { spend: { amount: 186000, currency: "AED" }, statement: "The contract cannot be cancelled in the first twelve months." },
    expandable: { why: "The current retainer ends in nine days, and the renewal price is held only until then." },
  },
}

export const KeyboardApprove: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    const approve = canvas.getByRole("button", { name: "Approve: Raise the weekly ad budget to AED 5,000" })
    await expect(approve).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("approve")
    await expectDone(canvasElement, args.onAct, "Approved.")
  },
}

export const KeyboardApproveIrreversible: Story = {
  args: { intent: "approve the payment", request: "Pay the venue deposit", reversible: false, consequence: { spend: { amount: 1050, currency: "AED" } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).not.toHaveBeenCalled()
    const yes = canvas.getByRole("button", { name: "Yes, approve: Pay the venue deposit" })
    await expect(yes).toHaveFocus()
    await expect(canvas.getByRole("status")).toHaveTextContent(/Armed/)
    await userEvent.keyboard("{Escape}")
    await expect(args.onAct).not.toHaveBeenCalled()
    await expect(canvas.getByRole("button", { name: /^Approve:/ })).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("approve")
    await expectDone(canvasElement, args.onAct, "Approved.")
  },
}

export const KeyboardReject: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    const reason = canvas.getByRole("textbox", { name: "Reason for rejecting (optional)" })
    await expect(reason).toHaveFocus()
    await userEvent.keyboard("Over budget")
    await userEvent.tab()
    await expect(canvas.getByRole("button", { name: "Send rejection" })).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("reject", "Over budget")
    await expectDone(canvasElement, args.onAct, "Rejection sent. Reason: Over budget")
  },
}

export const KeyboardRejectWithoutReason: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("{Escape}")
    await expect(canvas.getByRole("button", { name: /^Reject:/ })).toHaveFocus()
    await expect(args.onAct).not.toHaveBeenCalled()
    await userEvent.keyboard("{Enter}")
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("reject", undefined)
    await expectDone(canvasElement, args.onAct, "Rejection sent.")
  },
}

/** An IrreversibleAction commits the effect, so this Approval does not arm: one press approves. */
export const CommittedElsewhere: Story = {
  args: { intent: "approve the payment", request: "Pay the venue deposit", reversible: false, consequence: { spend: { amount: 1050, currency: "AED" } }, arm: false },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    const approve = canvas.getByRole("button", { name: "Approve: Pay the venue deposit" })
    await expect(approve).toHaveFocus()
    await expect(approve).toHaveTextContent(/^Approve$/)
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledTimes(1)
    await expect(args.onAct).toHaveBeenCalledWith("approve")
    await expectDone(canvasElement, args.onAct, "Approved.")
  },
}
