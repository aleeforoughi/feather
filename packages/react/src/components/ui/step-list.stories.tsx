import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "./badge"
import { StepItem, StepList } from "./step-list"

const meta = {
  title: "Molecules/StepList",
  component: StepList,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "An ordered plan: numbered steps with their status (pending, active, done, blocked), tags and a detail line." } } },
} satisfies Meta<typeof StepList>

export default meta
type Story = StoryObj<typeof meta>

export const Plan: Story = {
  render: () => (
    <StepList className="w-[36rem]">
      <StepItem index={1} status="done" title="Brand ideas" tags={<Badge variant="outline">Hero</Badge>} detail="Starts first · up to $0.40 and 6 turns · used 1 turn" />
      <StepItem index={2} status="active" title="Brand identity and logo" tags={<Badge variant="outline">Brand designer</Badge>} detail="After Brand ideas · up to $1.50 and 12 turns" />
      <StepItem index={3} status="blocked" title="Landing page" tags={<><Badge variant="outline">Frontend engineer</Badge><Badge variant="secondary">after your design approval</Badge></>} detail="Stopped: the build failed" />
      <StepItem index={4} title="Release" detail="After the landing page" />
    </StepList>
  ),
}
