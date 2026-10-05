import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn } from "storybook/test"
import { applyUpdate, type Experience } from "@aleeforoughi/feather-intent"
import { REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"
import streamedTrip from "../../../conformance/update/valid/streamed-trip.json"
import { FeatherExperience } from "./feather-experience"

// L6: the experience lifecycle. One trip, in the stages the conformance fixture (conformance/update/valid/streamed-trip.json)
// moves through: opened with progress, progress then a recommendation and an approval, then resolved, leaving a summary.
function stage(updates: number): Experience {
  let experience = streamedTrip.experience as Experience
  for (const update of streamedTrip.updates.slice(0, updates)) {
    const result = applyUpdate(experience, update)
    if (!result.ok) throw new Error(`the streamed trip does not apply: ${result.issues.map((i) => i.message).join("; ")}`)
    experience = result.experience
  }
  return experience
}

const meta = {
  title: "Experiences/Streamed trip",
  component: FeatherExperience,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "The L6 exit scenario, one story per stage: opened, after each update, resolved. In an app the caller applies each update with `applyUpdate` and hands the new experience to the same `FeatherExperience`, which changes in place." } },
  },
  args: { experience: stage(0), context: REFERENCE_CONTEXTS.phone.context, onReply: fn(), className: "w-[24.375rem] max-w-full" },
} satisfies Meta<typeof FeatherExperience>

export default meta
type Story = StoryObj<typeof meta>

/** Opened: only the work in progress. */
export const Opened: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-feather-node="work"]')).not.toBeNull()
    await expect(canvasElement.querySelector('[data-feather-node="ok"]')).toBeNull()
  },
}

/** After update 1: the work is half done. Progress speaks for itself; nothing is announced. */
export const AfterUpdate1: Story = { args: { experience: stage(1) } }

/** After update 2: the work is done, and a recommendation and an approval are added. */
export const AfterUpdate2: Story = {
  args: { experience: stage(2) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-feather-node="ok"]')).not.toBeNull()
  },
}

/** Resolved: it collapses to one line, and what it leaves behind. */
export const Resolved: Story = {
  args: { experience: stage(3) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="experience-resolution"]')).not.toBeNull()
    await expect(canvasElement.querySelectorAll("button")).toHaveLength(0)
  },
}
