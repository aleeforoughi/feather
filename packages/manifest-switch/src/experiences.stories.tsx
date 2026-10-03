import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"
import adCampaign from "../../../conformance/ir/valid/ad-campaign-launch.json"
import purchaseApproval from "../../../conformance/ir/valid/purchase-approval.json"
import { FeatherSwitchExperience } from "./switch-experience"

// Each story is a conformance fixture composed for switch access (`capability.input.switch`) and scanned. The plays
// finish the main act with switch keys only: Tab moves, Enter selects.
const meta = {
  title: "Experiences/Switch",
  component: FeatherSwitchExperience,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "A conformance fixture composed for a person who uses one or two switches, and scanned. The highlighted control has real focus, a thick ring and a sr-only description; an irreversible act still takes two selections." } },
  },
  args: {
    experience: adCampaign.ir,
    context: { capability: { input: { switch: true } } },
    scan: "step",
    onReply: fn(),
    className: "w-[24.375rem] max-w-full",
  },
} satisfies Meta<typeof FeatherSwitchExperience>

export default meta
type Story = StoryObj<typeof meta>

/** Move with Tab until the focus is on a control whose name matches. */
async function scanTo(name: RegExp) {
  for (let i = 0; i < 40; i++) {
    await userEvent.keyboard("{Tab}")
    if (name.test(document.activeElement?.textContent ?? "")) return
  }
  throw new Error(`the scan never reached ${name}`)
}

/** Step scanning: Tab moves, Enter selects; arm, then confirm, are two selections. */
export const AdCampaignLaunch: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await scanTo(/^Confirm spend…/)
    await expect(document.activeElement).toHaveAttribute("data-scanned", "true")
    await userEvent.keyboard("{Enter}")
    await expect(args.onReply).not.toHaveBeenCalled()
    await waitFor(() => expect(canvas.getByRole("button", { name: "Yes, confirm spend" })).toHaveFocus())
    await userEvent.keyboard("{Enter}")
    await expect(args.onReply).toHaveBeenCalledTimes(1)
    await expect(args.onReply).toHaveBeenCalledWith({ experience: "approve_campaign", node: "go", act: "confirm" })
  },
}

/** A request for authority, decided with switches. The plan puts no confirmation on this approval, so one selection decides. */
export const PurchaseApproval: Story = {
  args: { experience: purchaseApproval.ir },
  play: async ({ args }) => {
    await scanTo(/^Approve/)
    await expect(document.activeElement).toHaveAttribute("data-scanned", "true")
    await userEvent.keyboard("{Enter}")
    await expect(args.onReply).toHaveBeenCalledTimes(1)
    await expect(args.onReply).toHaveBeenCalledWith({ experience: "purchase_approval", node: "approve", act: "approve" })
  },
}

/** One switch: the highlight advances by itself after the first press. Not played, so it can be tried by hand. */
export const AutoScan: Story = { args: { scan: "auto", scanMs: 1500 } }

/** Dwell: rest the pointer on a control to select it. The committing control of an armed act is never selected this way. */
export const Dwell: Story = { args: { scan: "step", dwellMs: 1200 } }
