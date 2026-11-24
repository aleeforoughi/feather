import type { Meta, StoryObj } from "@storybook/react-vite"
import { Footer, NotFound } from "./edges"

// The page edges of feather.page/1 that are blocks of their own. The nav and the loader are the expression layer's
// OverlayMenu and Loader (Website/*).
const meta = {
  title: "Pages/Edges",
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "The footer and the 404, finished as scenes: every link stays text, the wordmark is decoration, and the 404 has one h1 and a clear way home." } },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const links = [
  { label: "Work", href: "#work" },
  { label: "How I work", href: "#process" },
  { label: "Contact", href: "#contact" },
]

export const FooterPlain: Story = { render: () => <Footer footer={{ variant: "plain", body: "Design engineer in Amsterdam. Available from January.", links, note: "Built from one feather.page document." }} /> }
export const FooterWordmark: Story = { render: () => <Footer footer={{ variant: "wordmark", links, note: "Built from one feather.page document." }} name="Alee" /> }
export const FooterReveal: Story = {
  render: () => (
    <>
      <main className="relative z-10 bg-surface-base">
        <div className="page-grid section-space-xl">
          <p className="col-span-full type-body-lg text-fg-secondary">Scroll to the end: the footer waits behind the page and is uncovered as it ends.</p>
        </div>
      </main>
      <Footer footer={{ variant: "reveal", wordmark: "Studio of one", links, note: "Built from one feather.page document." }} />
    </>
  ),
}
export const NotFoundType: Story = {
  render: () => <NotFound notFound={{ variant: "type", title: "This page went somewhere else", body: "The link may be old, or the page has moved. The work is still here.", home: [{ label: "Back to the work", href: "/" }] }} />,
}
export const NotFoundMinimal: Story = { render: () => <NotFound notFound={{ variant: "minimal" }} /> }
