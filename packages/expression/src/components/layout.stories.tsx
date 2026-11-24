import type { Meta, StoryObj } from "@storybook/react-vite"
import { Bento, BentoCell, Grid, Split } from "./layout"

const meta = {
  title: "Website/Layout",
  component: Split,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "Split, Grid and Bento: the page grid as components. Bento's container radius is concentric with its cells." } },
  },
} satisfies Meta<typeof Split>

export default meta
type Story = StoryObj<typeof meta>

const Box = ({ children }: { children: string }) => (
  <div data-slot="story-box" className="bg-surface-subtle p-6 text-fg-primary rounded-card">
    <p className="type-body">{children}</p>
  </div>
)

const Page = ({ children }: { children: React.ReactNode }) => (
  <div data-slot="story-page" className="page-grid bg-surface-base py-12">
    {children}
  </div>
)

export const Default: Story = {
  args: { ratio: "5:7", children: [<Box key="a">First column</Box>, <Box key="b">Second column</Box>] },
  render: (args) => (
    <Page>
      <Split {...args} />
    </Page>
  ),
}

export const Reversed: Story = {
  args: { ratio: "7:5", reverse: true, children: [<Box key="a">Text, first in reading order</Box>, <Box key="b">Media, first on wide screens</Box>] },
  render: (args) => (
    <Page>
      <Split {...args} />
    </Page>
  ),
}

export const Columns: Story = {
  args: { children: [null, null] },
  render: () => (
    <Page>
      <Grid columns={3}>
        <Box>One</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Grid>
    </Page>
  ),
}

export const BentoMosaic: Story = {
  args: { children: [null, null] },
  render: () => (
    <Page>
      <Bento>
        <BentoCell span={8} rowSpan={2}>
          <p className="type-title">Large</p>
        </BentoCell>
        <BentoCell span={4}>
          <p className="type-body">Small</p>
        </BentoCell>
        <BentoCell span={4}>
          <p className="type-body">Small</p>
        </BentoCell>
      </Bento>
    </Page>
  ),
}

export const ReducedMotion: Story = {
  args: Default.args,
  render: (args) => (
    <div data-motion="reduced">
      <Page>
        <Split {...args} />
      </Page>
    </div>
  ),
}
