import type { Meta, StoryObj } from "@storybook/react-vite"
import { OverlayMenu } from "./overlay-menu"

const items = [
  { label: "Work", href: "#work", current: true },
  { label: "Studio", href: "#studio" },
  { label: "Journal", href: "#journal" },
  { label: "Careers", href: "#careers" },
  { label: "Contact", href: "#contact" },
]

const Brand = () => (
  <a href="#home" data-slot="story-wordmark" className="inline-flex min-h-11 items-center type-label text-fg-primary focus-ring">
    Feather
  </a>
)

const Aside = () => (
  <>
    <p>hello@example.com</p>
    <p>+1 555 0100</p>
  </>
)

const meta = {
  title: "Website/OverlayMenu",
  component: OverlayMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A minimal bar whose Menu button opens a full-screen overlay of large links. Without script the toggle is hidden and the links are a plain list. Open, it is a modal dialog: focus is trapped, Escape closes, the page is inert and does not scroll, and focus returns to the toggle. Reduced motion is a short fade.",
      },
    },
  },
  args: { items, brand: <Brand />, aside: <Aside /> },
  decorators: [
    (Story) => (
      <div className="min-h-64 px-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OverlayMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithActions: Story = {
  args: {
    actions: (
      <button type="button" data-slot="story-action" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-2 type-label text-fg-primary focus-ring">
        Sound
      </button>
    ),
  },
}
export const LongLabels: Story = {
  args: {
    items: [
      { label: "Selected work and case studies", href: "#work", current: true },
      { label: "The studio, its people and its principles", href: "#studio" },
      { label: "Notes from the journal", href: "#journal" },
    ],
  },
}
