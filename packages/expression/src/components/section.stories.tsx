import type { Meta, StoryObj } from "@storybook/react-vite"
import { Section } from "./section"

const meta = {
  title: "Website/Section",
  component: Section,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "A full-width band of a website: the page grid, the section rhythm (48 to 160px, fluid) and its own scroll trigger. Its content is HTML first." } },
  },
  args: { space: "m", tone: "base", "aria-labelledby": "section-title" },
} satisfies Meta<typeof Section>

export default meta
type Story = StoryObj<typeof meta>

const Content = () => (
  <div data-slot="story" className="col-span-full flex flex-col gap-4">
    <h2 id="section-title" data-slot="story" className="type-display-m text-fg-primary">
      The work, in one sentence
    </h2>
    <p data-slot="story" className="type-body-lg text-prose max-w-prose text-fg-secondary">
      Related things sit close and groups sit far apart. This band holds one focal point and leaves the rest to space.
    </p>
  </div>
)

export const Default: Story = { args: { children: <Content /> } }
export const Spacious: Story = { args: { space: "xl", tone: "subtle", children: <Content /> } }
export const Inverse: Story = { args: { tone: "inverse", children: <Content /> } }
export const ReducedMotion: Story = {
  args: { children: <Content /> },
  decorators: [(Story) => <div data-motion="reduced">{Story()}</div>],
}
