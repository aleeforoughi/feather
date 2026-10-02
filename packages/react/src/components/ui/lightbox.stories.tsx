import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import { Lightbox, type LightboxImage } from "./lightbox"
import { SAMPLE_IMAGES } from "../../stories/sample-images"

const meta = {
  title: "Molecules/Lightbox",
  component: Lightbox,
  tags: ["autodocs"],
  parameters: { layout: "centered", docs: { description: { component: "Show one image of a set large: previous / next (buttons and arrow keys), download, and a checkerboard so transparency shows." } } },
  args: { images: SAMPLE_IMAGES, index: 0, onIndexChange: () => undefined },
} satisfies Meta<typeof Lightbox>

export default meta
type Story = StoryObj<typeof meta>

function Controlled({ images, start }: { images: LightboxImage[]; start: number | null }) {
  const [index, setIndex] = React.useState<number | null>(start)
  return (
    <>
      <Button onClick={() => setIndex(0)}>Open lightbox</Button>
      <Lightbox images={images} index={index} onIndexChange={setIndex} />
    </>
  )
}

export const Default: Story = { render: (args) => <Controlled images={args.images} start={0} /> }

export const SingleImage: Story = { render: () => <Controlled images={SAMPLE_IMAGES.slice(0, 1)} start={0} /> }
