import type { Meta, StoryObj } from "@storybook/react-vite"
import { MoreHorizontal } from "lucide-react"
import { Button } from "./button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"

const meta = {
  title: "Atoms/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a card to group related content and actions into a single scannable surface." } },
  },
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Project summary</CardTitle>
        <CardDescription>A quick overview of this week's progress.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Twelve tasks completed and three still in review.</p>
      </CardContent>
      <CardFooter>
        <Button>View details</Button>
        <Button variant="ghost">Dismiss</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAction: Story = {
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Team notes</CardTitle>
        <CardDescription>Shared with everyone in your workspace.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm" aria-label="More options">
            <MoreHorizontal />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Remember to review the draft before Friday.</p>
      </CardContent>
    </Card>
  ),
}

export const Small: Story = {
  args: { size: "sm" },
}
