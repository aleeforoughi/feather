import type { Meta, StoryObj } from "@storybook/react-vite"
import { SAMPLE_IMAGES } from "../../stories/sample-images"
import { MediaGallery } from "./media-gallery"

const meta = {
  title: "Molecules/MediaGallery",
  component: MediaGallery,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "Organize a project's images into titled sections; any tile opens large in a Lightbox that steps through all of them." } } },
  args: {
    sections: [
      { key: "brand", title: "Brand", items: SAMPLE_IMAGES },
      { key: "pages", title: "Design pages", items: [SAMPLE_IMAGES[1]!, SAMPLE_IMAGES[0]!, SAMPLE_IMAGES[1]!] },
    ],
  },
} satisfies Meta<typeof MediaGallery>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = { args: { sections: [], empty: "No images in this project yet." } }
