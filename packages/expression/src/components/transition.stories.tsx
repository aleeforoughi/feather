import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { PersistentSlot, TransitionProvider, useTransitions } from "./transition"

function Router() {
  const { go } = useTransitions()
  const [page, setPage] = React.useState("One")
  return (
    <div data-slot="story-router" className="flex items-center gap-4 p-8">
      <p data-slot="story-page" className="type-body text-fg-primary">
        Page {page}
      </p>
      <button type="button" data-slot="story-go" className="min-h-12 rounded-control border border-line-primary px-4 type-label text-fg-primary focus-ring" onClick={() => go(() => setPage((p) => (p === "One" ? "Two" : "One")))}>
        Go
      </button>
    </div>
  )
}

const meta = {
  title: "Website/Transition",
  component: TransitionProvider,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "TransitionProvider runs route changes in a View Transition and disposes what the last route registered. PersistentSlot is the fixed layer behind the content that keeps the World canvas alive across routes. Without View Transitions, or under reduced motion, the update runs at once.",
      },
    },
  },
} satisfies Meta<typeof TransitionProvider>

export default meta
type Story = StoryObj<typeof meta>

const Demo = () => (
  <TransitionProvider>
    <PersistentSlot />
    <Router />
  </TransitionProvider>
)

export const Default: Story = { render: () => <Demo /> }
export const ReducedMotion: Story = {
  render: () => (
    <div data-motion="reduced">
      <Demo />
    </div>
  ),
}
