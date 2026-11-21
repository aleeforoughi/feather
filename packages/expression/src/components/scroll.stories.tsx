import type { Meta, StoryObj } from "@storybook/react-vite"
import { ScrollProgress, ScrollProvider, useScroll } from "./scroll"

function Engine() {
  const { kind } = useScroll()
  return (
    <p data-slot="story-note" className="type-body text-fg-primary">
      Scroll engine: {kind}
    </p>
  )
}

const meta = {
  title: "Website/ScrollProvider",
  component: ScrollProvider,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "ScrollProvider owns the page's one scroll connection (native, CSS scroll timelines, or Lenis on the shared clock) and useScroll() reports it. ScrollProgress is a decorative bar driven by the page's scroll. Under reduced motion there is no smoothing.",
      },
    },
  },
} satisfies Meta<typeof ScrollProvider>

export default meta
type Story = StoryObj<typeof meta>

const Page = () => (
  <ScrollProvider engine={{ kind: "native" }}>
    <ScrollProgress />
    <div data-slot="story-page" className="p-8">
      <Engine />
    </div>
  </ScrollProvider>
)

export const Default: Story = { render: () => <Page /> }
export const ReducedMotion: Story = {
  render: () => (
    <div data-motion="reduced">
      <Page />
    </div>
  ),
}
