import type { Meta, StoryObj } from "@storybook/react-vite"
import { HandIcon, TriangleAlertIcon } from "lucide-react"
import { AttentionCard } from "./attention-card"
import { Button } from "./button"

const meta = {
  title: "Molecules/AttentionCard",
  component: AttentionCard,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "A rare, important question for the user: it pulses until answered, with the choice on the card." } } },
  args: {
    eyebrow: "Your decision is needed",
    title: "Approve the design?",
    description: "Every screen passed QA. Approving starts the build.",
    icon: <HandIcon />,
    actions: (
      <>
        <Button>Approve</Button>
        <Button variant="outline">Reject</Button>
      </>
    ),
    className: "w-[36rem]",
  },
} satisfies Meta<typeof AttentionCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Danger: Story = { args: { variant: "danger", eyebrow: "Budget", title: "Raise the cap above your maximum?", icon: <TriangleAlertIcon /> } }
