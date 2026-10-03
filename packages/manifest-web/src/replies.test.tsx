// Acts become replies: completed, checked with validateReply, and only then handed to the host.
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { compose, REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"
import type { Experience } from "@aleeforoughi/feather-intent"
import { FeatherExperience, PlanView } from "./index"
import { failOnConsole, fixture } from "./test/fixtures"

const phone = REFERENCE_CONTEXTS.phone.context

describe("the reply flow", () => {
  failOnConsole()

  it("ad campaign: arm, then confirm, sends exactly one reply", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    render(<FeatherExperience experience={fixture("ad-campaign-launch")} context={phone} onReply={onReply} />)

    const arm = screen.getByRole("button", { name: /^Confirm spend…/ })
    arm.focus()
    await user.keyboard("{Enter}")
    // Arming sends nothing, and moves focus to the second, deliberate press.
    expect(onReply).not.toHaveBeenCalled()
    const confirm = screen.getByRole("button", { name: "Yes, confirm spend" })
    expect(document.activeElement).toBe(confirm)
    await user.keyboard("{Enter}")

    expect(onReply).toHaveBeenCalledTimes(1)
    expect(onReply).toHaveBeenCalledWith({ experience: "approve_campaign", node: "go", act: "confirm" })
    // The act happens once: nothing is left that could confirm again.
    expect(screen.queryByRole("button", { name: "Yes, confirm spend" })).toBeNull()
    await user.keyboard("{Enter}{Enter}")
    expect(onReply).toHaveBeenCalledTimes(1)
  })

  it("ad campaign: Escape backs out of arming and says cancel", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    render(<FeatherExperience experience={fixture("ad-campaign-launch")} context={phone} onReply={onReply} />)
    screen.getByRole("button", { name: /^Confirm spend…/ }).focus()
    await user.keyboard("{Enter}{Escape}")
    expect(onReply).toHaveBeenCalledTimes(1)
    expect(onReply).toHaveBeenCalledWith({ experience: "approve_campaign", node: "go", act: "cancel" })
  })

  it("ad campaign: accepting the recommendation, and an alternative that asks for a price", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    render(<FeatherExperience experience={fixture("ad-campaign-launch")} context={phone} onReply={onReply} />)
    await user.click(screen.getByRole("button", { name: /^Accept recommendation/ }))
    expect(onReply).toHaveBeenLastCalledWith({ experience: "approve_campaign", node: "rec", act: "accept" })

    await user.click(screen.getByRole("button", { name: "spend less" }))
    expect(onReply).toHaveBeenLastCalledWith({ experience: "approve_campaign", node: "less", act: "choose" })

    await user.click(screen.getByRole("button", { name: "set my own budget" }))
    await user.type(screen.getByRole("spinbutton", { name: /Price for set my own budget/ }), "800")
    await user.click(screen.getByRole("button", { name: "Use this" }))
    // The currency is the experience's own (AED), not a default.
    expect(onReply).toHaveBeenLastCalledWith({ experience: "approve_campaign", node: "own", act: "choose", value: { amount: 800, currency: "AED" } })
  })

  it("a Choice: pick, then send; the caller's selection starts picked", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    render(<FeatherExperience experience={fixture("choice-three-options")} context={phone} onReply={onReply} />)
    expect(screen.getByRole("radio", { name: /Standard/ }).getAttribute("aria-checked")).toBe("true")

    await user.click(screen.getByRole("radio", { name: /Express/ }))
    expect(onReply).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: /^Choose Express/ }))
    expect(onReply).toHaveBeenCalledTimes(1)
    expect(onReply).toHaveBeenCalledWith({ experience: "pick_delivery_speed", node: "speed", act: "choose", value: "fast" })
  })

  it("a predicted Choice replies to the PredictedChoice node", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    render(<FeatherExperience experience={fixture("predicted-news-topic")} context={phone} onReply={onReply} />)
    await user.click(screen.getByRole("button", { name: /^Keep Technology news/ }))
    expect(onReply).toHaveBeenCalledWith({ experience: "predict_preference", node: "pred", act: "accept" })
    await user.click(screen.getByRole("radio", { name: /Sports/ }))
    await user.click(screen.getByRole("button", { name: /^Use Sports/ }))
    expect(onReply).toHaveBeenLastCalledWith({ experience: "predict_preference", node: "pred", act: "change", value: "sport" })
  })

  it("an Input: typing and Enter send the value; a value the validator refuses is never sent", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    const onRejectedReply = vi.fn()
    render(<FeatherExperience experience={fixture("user-signup")} context={phone} onReply={onReply} onRejectedReply={onRejectedReply} />)
    const email = screen.getByRole("textbox", { name: "What is your email address?" })

    await user.type(email, "not-an-email{Enter}")
    expect(onReply).not.toHaveBeenCalled()
    expect(onRejectedReply).toHaveBeenCalledTimes(1)
    expect(email.getAttribute("aria-invalid")).toBe("true")
    expect(screen.getByText(/is not an email address/)).toBeTruthy()

    await user.clear(email)
    await user.type(email, "sam@example.com{Enter}")
    expect(onReply).toHaveBeenCalledTimes(1)
    expect(onReply).toHaveBeenCalledWith({ experience: "user_signup", node: "email", act: "submit", value: "sam@example.com" })
  })

  it("a number Input sends a number, and the skip of an optional one", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    render(<FeatherExperience experience={fixture("recipe-step")} context={phone} onReply={onReply} />)
    const portions = screen.getByRole("spinbutton", { name: "How many portions are you making?" })
    await user.clear(portions)
    await user.type(portions, "6{Enter}")
    expect(onReply).toHaveBeenLastCalledWith({ experience: "cooking_step_three", node: "portions", act: "submit", value: 6 })
    await user.click(screen.getByRole("button", { name: "Skip" }))
    expect(onReply).toHaveBeenLastCalledWith({ experience: "cooking_step_three", node: "portions", act: "skip" })
    // Above the Input's own maximum: refused.
    await user.clear(portions)
    await user.type(portions, "99{Enter}")
    expect(onReply).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/above the maximum 12/)).toBeTruthy()
  })

  it("an Approval: approve, and reject with a reason", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    const { unmount } = render(<FeatherExperience experience={fixture("purchase-approval")} context={phone} onReply={onReply} />)
    await user.click(screen.getByRole("button", { name: /^Approve:/ }))
    expect(onReply).toHaveBeenCalledWith({ experience: "purchase_approval", node: "approve", act: "approve" })
    unmount()

    onReply.mockClear()
    render(<FeatherExperience experience={fixture("purchase-approval")} context={phone} onReply={onReply} />)
    await user.click(screen.getByRole("button", { name: /^Reject:/ }))
    await user.type(screen.getByRole("textbox", { name: /Reason for rejecting/ }), "Over budget")
    await user.click(screen.getByRole("button", { name: "Send rejection" }))
    expect(onReply).toHaveBeenCalledWith({ experience: "purchase_approval", node: "approve", act: "reject", value: "Over budget" })
  })

  it("a reply the validator rejects is never emitted", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    const onRejectedReply = vi.fn()
    const ir = fixture("ad-campaign-launch") as Experience
    const composed = compose(ir, phone)
    if (!composed.ok) throw new Error("invalid fixture")
    // The host checks replies against a different experience than the one rendered: every reply names the wrong one.
    render(<PlanView plan={composed.plan} experience={{ ...ir, experience: "some_other_experience" }} onReply={onReply} onRejectedReply={onRejectedReply} />)
    await user.click(screen.getByRole("button", { name: /^Accept recommendation/ }))
    expect(onReply).not.toHaveBeenCalled()
    expect(onRejectedReply).toHaveBeenCalledTimes(1)
    expect(onRejectedReply.mock.calls[0]![0][0].code).toBe("wrong-experience")
  })

  it("a Preference, a Warning acknowledgement and an Autopick reply as the IR says", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    render(<FeatherExperience experience={fixture("newsletter-signup")} context={phone} onReply={onReply} />)
    await user.click(screen.getByRole("radio", { name: "monthly" }))
    await user.click(screen.getByRole("button", { name: "Set to monthly" }))
    expect(onReply).toHaveBeenLastCalledWith({ experience: "newsletter_subscription", node: "frequency", act: "set", value: "monthly" })
    await user.click(screen.getByRole("button", { name: "Subscribe" }))
    expect(onReply).toHaveBeenLastCalledWith({ experience: "newsletter_subscription", node: "subscribe", act: "activate" })
  })

  it("an Autopick is kept or undone once", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    render(<FeatherExperience experience={fixture("auto-save-draft")} context={phone} onReply={onReply} />)
    await user.click(screen.getByRole("button", { name: /^Undo:/ }))
    expect(onReply).toHaveBeenCalledWith({ experience: "draft_autosave", node: "auto_save", act: "undo" })
    expect(screen.queryByRole("button", { name: /^Keep:/ })).toBeNull()
  })

  it("a Recommendation that states a consequence and commits by itself arms before it replies", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    const ir = {
      ir: "feather.ir/0",
      experience: "book_venue",
      nodes: [{ type: "Recommendation", id: "rec", intent: "book the venue", summary: "Book the Marina hall.", consequence: { spend: { amount: 1050, currency: "AED" } } }],
    }
    const composed = compose(ir, phone)
    if (!composed.ok) throw new Error("invalid experience")
    expect(composed.plan.regions.flatMap((r) => r.nodes).find((n) => n.id === "rec")?.confirm).toBe("confirm")
    render(<FeatherExperience experience={ir} context={phone} onReply={onReply} />)
    await user.click(screen.getByRole("button", { name: "Accept recommendation: Book the venue" }))
    expect(onReply).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Yes, book the venue" }))
    expect(onReply).toHaveBeenCalledTimes(1)
    expect(onReply).toHaveBeenCalledWith({ experience: "book_venue", node: "rec", act: "accept" })
    expect(screen.queryByRole("button", { name: /book the venue/i })).toBeNull()
  })

  it("an Approval that an IrreversibleAction confirms replies on one click, and the IrreversibleAction still arms", async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    const ir = {
      ir: "feather.ir/0",
      experience: "pay_deposit",
      nodes: [
        { type: "Approval", id: "ok", intent: "approve the payment", request: "Pay the venue deposit", consequence: { spend: { amount: 1050, currency: "AED" } } },
        { type: "IrreversibleAction", id: "pay", intent: "pay the deposit", consequence: { spend: { amount: 1050, currency: "AED" } }, confirms: "ok" },
      ],
    }
    render(<FeatherExperience experience={ir} context={phone} onReply={onReply} />)
    await user.click(screen.getByRole("button", { name: "Approve: Pay the venue deposit" }))
    expect(onReply).toHaveBeenCalledTimes(1)
    expect(onReply).toHaveBeenLastCalledWith({ experience: "pay_deposit", node: "ok", act: "approve" })

    await user.click(screen.getByRole("button", { name: /^Pay the deposit…/ }))
    expect(onReply).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("button", { name: "Yes, pay the deposit" }))
    expect(onReply).toHaveBeenCalledTimes(2)
    expect(onReply).toHaveBeenLastCalledWith({ experience: "pay_deposit", node: "pay", act: "confirm" })
  })
})
