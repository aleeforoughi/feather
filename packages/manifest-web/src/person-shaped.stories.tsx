import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, within } from "storybook/test"
import { REFERENCE_CAPABILITIES, REFERENCE_PERSONAS } from "@aleeforoughi/feather-liquid"
import adCampaign from "../../../conformance/ir/valid/ad-campaign-launch.json"
import deleteAccount from "../../../conformance/ir/valid/delete-account.json"
import flightSearch from "../../../conformance/ir/valid/flight-search-tradeoff.json"
import posterDetailsForm from "../../../conformance/ir/valid/poster-details-form.json"
import predictedNewsTopic from "../../../conformance/ir/valid/predicted-news-topic.json"
import purchaseApproval from "../../../conformance/ir/valid/purchase-approval.json"
import { FeatherExperience } from "./feather-experience"

// L5: one experience shaped to a person. Each story composes a conformance fixture for a reference persona or
// capability profile (packages/liquid/src/context.ts); the a11y suite checks every low-vision story at AAA (7:1).
const desk = { surface: "desktop" as const, width: 1280 }
const lowVision = { device: desk, capability: REFERENCE_CAPABILITIES["low-vision"].capability }

const meta = {
  title: "Experiences/Person-shaped",
  component: FeatherExperience,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "Conformance fixtures composed for Feather's reference personas and capability profiles. Low vision asks for AAA contrast: the theme's AAA block applies under the plan's `data-contrast`." } },
  },
  args: { experience: adCampaign.ir, context: lowVision, onReply: fn(), className: "w-[24.375rem] max-w-full" },
} satisfies Meta<typeof FeatherExperience>

export default meta
type Story = StoryObj<typeof meta>

/** Low vision: the canonical example at AAA contrast, with secondary text, the primary and the spend at 7:1. */
export const LowVisionAdCampaign: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-contrast="AAA"]')).not.toBeNull()
  },
}

/** Low vision: a permanent deletion, its destructive red moved toward the text until it reads at 7:1. */
export const LowVisionDeleteAccount: Story = { args: { experience: deleteAccount.ir } }

/** Low vision: alternatives and their tradeoffs at AAA contrast. */
export const LowVisionFlightSearch: Story = { args: { experience: flightSearch.ir } }

/** Low vision: a Form's hints and "Optional" labels at AAA contrast. */
export const LowVisionPosterForm: Story = { args: { experience: posterDetailsForm.ir } }

/** Low vision: an approval and the person asking, at AAA contrast. */
export const LowVisionPurchaseApproval: Story = { args: { experience: purchaseApproval.ir } }

/** Picks for themselves: the prediction is a note beside the choice, and nothing is preselected. */
export const DeliberatePredictedChoice: Story = {
  args: { experience: predictedNewsTopic.ir, context: { device: desk, persona: REFERENCE_PERSONAS.deliberate.persona } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked && radio.getAttribute("aria-checked") !== "true")).toBe(true)
    await expect(canvasElement.querySelector('[data-slot="experience-prediction-note"]')).not.toBeNull()
  },
}

/** Prefers touch at a desk: every control at least 44 px. */
export const TouchFirstFlightSearch: Story = { args: { experience: flightSearch.ir, context: { device: desk, persona: REFERENCE_PERSONAS["touch-first"].persona } } }
