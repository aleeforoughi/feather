import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"
import adCampaign from "../../../conformance/ir/valid/ad-campaign-launch.json"
import arabicDelivery from "../../../conformance/ir/valid/arabic-delivery-confirmation.json"
import compareSubscriptionPlans from "../../../conformance/ir/valid/compare-subscription-plans.json"
import flightSearch from "../../../conformance/ir/valid/flight-search-tradeoff.json"
import newsletterSignup from "../../../conformance/ir/valid/newsletter-signup.json"
import posterDetailsForm from "../../../conformance/ir/valid/poster-details-form.json"
import predictedNewsTopic from "../../../conformance/ir/valid/predicted-news-topic.json"
import purchaseApproval from "../../../conformance/ir/valid/purchase-approval.json"
import shippingAddressForm from "../../../conformance/ir/valid/shipping-address-form.json"
import textOnly from "../../../conformance/ir/valid/text-only.json"
import { FeatherExperience } from "./feather-experience"

// Each story is a conformance fixture composed in the `phone` reference context and rendered by the web manifestation.
// What differs between stories is the experience; every decision about how it looks was made by the composer.
const meta = {
  title: "Experiences/Web",
  component: FeatherExperience,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "An Experience IR (a conformance fixture) composed for the phone reference context and rendered with Feather's organisms and atoms. Replies go to `onReply`, checked with `validateReply`." } },
  },
  args: {
    experience: textOnly.ir,
    context: REFERENCE_CONTEXTS.phone.context,
    onReply: fn(),
    className: "w-[24.375rem] max-w-full",
  },
} satisfies Meta<typeof FeatherExperience>

export default meta
type Story = StoryObj<typeof meta>

/** A recommendation, a price, an irreversible spend and two alternatives: the canonical example. */
export const AdCampaignLaunch: Story = { args: { experience: adCampaign.ir } }

/** Arm, then confirm, by keyboard alone: one reply, and nothing left that could act again. */
export const AdCampaignKeyboard: Story = {
  args: { experience: adCampaign.ir },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    canvas.getByRole("button", { name: /^Confirm spend…/ }).focus()
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByRole("button", { name: "Yes, confirm spend" })).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(args.onReply).toHaveBeenCalledTimes(1)
    await expect(args.onReply).toHaveBeenCalledWith({ experience: "approve_campaign", node: "go", act: "confirm" })
  },
}

/** Every word Arabic: the document's language sets the direction, and money and dates follow the locale. */
export const ArabicDeliveryConfirmation: Story = { args: { experience: arabicDelivery.ir } }

/** One line and no decision: plain text, no card. */
export const TextOnly: Story = { args: { experience: textOnly.ir } }

/** A request for authority, with the person asking attached to it. */
export const PurchaseApproval: Story = { args: { experience: purchaseApproval.ir } }

/** A choice with its likely option preselected and marked. */
export const PredictedChoice: Story = { args: { experience: predictedNewsTopic.ir } }

/** A recommendation, alternatives with their tradeoffs, and a choice. */
export const FlightSearchTradeoff: Story = { args: { experience: flightSearch.ir } }

/** A recommendation, a comparison table and a choice among the plans. */
export const CompareSubscriptionPlans: Story = { args: { experience: compareSubscriptionPlans.ir } }

/** An input, a preference and an action. */
export const NewsletterSignup: Story = { args: { experience: newsletterSignup.ir } }

/** A Form asks several things and sends every answer with one act: five optional questions under four headings, and an action beside it. */
export const PosterDetailsForm: Story = { args: { experience: posterDetailsForm.ir } }

/** A Form with required fields cannot be skipped. */
export const ShippingAddressForm: Story = { args: { experience: shippingAddressForm.ir } }

/** Type in a field and press Enter: one reply, with only the answered fields. */
export const PosterDetailsFormKeyboard: Story = {
  args: { experience: posterDetailsForm.ir },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole("textbox", { name: "Contact email" }), "market@example.com{Enter}")
    await expect(args.onReply).toHaveBeenCalledTimes(1)
    await expect(args.onReply).toHaveBeenCalledWith({ experience: "poster_details", node: "details", act: "submit", value: { contact: "market@example.com" } })
  },
}
