import type { Meta, StoryObj } from "@storybook/react-vite"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import { TEMPLATES, otherSet, type TemplateName } from "../templates/index.js"
import { validatePage } from "./core/validate"
import type { PageDocument } from "./core/types"
import { FeatherPage } from "./render"
import { PLACEHOLDER } from "./blocks/fixtures"

// The templates (wave 5 part C), the last level of the library: atoms, molecules and organisms (feather-react), the
// blocks (feather-page), then whole pages. Each of the six is shown in the three reference brands, as `feather-page
// init` writes it; only its pictures are the stories' placeholder (the templates' media/ files are the showcase's), and a
// scheme toggle takes the brand's own other set.
const BRANDS = { studio, portrait, seed } as const
type BrandName = keyof typeof BRANDS

/** The template's media/ pictures, as the placeholder (audio and video stay as written: nothing loads them here). */
function placeholders(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(placeholders)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, (k === "src" || k === "poster") && typeof v === "string" && /^media\/.*\.svg$/.test(v) ? PLACEHOLDER.src : placeholders(v)]))
}

function page(name: TemplateName, brand: BrandName): PageDocument {
  const doc = placeholders(TEMPLATES[name].page) as Record<string, unknown> & { scheme?: { toggle?: string } }
  const colors = BRANDS[brand].tokens.colors
  const r = validatePage(doc.scheme ? { ...doc, scheme: { ...doc.scheme, colors: otherSet(colors) } } : doc)
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}: ${i.message}`).join("\n"))
  return r.page
}

function Template({ name, brand }: { name: TemplateName; brand: BrandName }) {
  return <FeatherPage page={page(name, brand)} tokens={BRANDS[brand].tokens as unknown as BrandTokens} />
}

const meta = {
  title: "Templates",
  decorators: [
    (Story) => (
      <div className="-m-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "Six whole pages composed from the library, each with its own layout: launch (poster, loudness 3), studio (swiss), editorial (editorial), service (colour-blocking), product (two-colour) and creator (brutalist). `feather-page init <template>` writes one out." } },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** launch, in Studio. */
export const LaunchStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Template name="launch" brand="studio" />,
}

/** launch, in Portrait. */
export const LaunchPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Template name="launch" brand="portrait" />,
}

/** launch, in Seed. */
export const LaunchSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Template name="launch" brand="seed" />,
}

/** studio, in Studio. */
export const StudioStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Template name="studio" brand="studio" />,
}

/** studio, in Portrait. */
export const StudioPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Template name="studio" brand="portrait" />,
}

/** studio, in Seed. */
export const StudioSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Template name="studio" brand="seed" />,
}

/** editorial, in Studio. */
export const EditorialStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Template name="editorial" brand="studio" />,
}

/** editorial, in Portrait. */
export const EditorialPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Template name="editorial" brand="portrait" />,
}

/** editorial, in Seed. */
export const EditorialSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Template name="editorial" brand="seed" />,
}

/** service, in Studio. */
export const ServiceStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Template name="service" brand="studio" />,
}

/** service, in Portrait. */
export const ServicePortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Template name="service" brand="portrait" />,
}

/** service, in Seed. */
export const ServiceSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Template name="service" brand="seed" />,
}

/** product, in Studio. */
export const ProductStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Template name="product" brand="studio" />,
}

/** product, in Portrait. */
export const ProductPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Template name="product" brand="portrait" />,
}

/** product, in Seed. */
export const ProductSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Template name="product" brand="seed" />,
}

/** creator, in Studio. */
export const CreatorStudio: Story = {
  globals: { theme: "studio" },
  render: () => <Template name="creator" brand="studio" />,
}

/** creator, in Portrait. */
export const CreatorPortrait: Story = {
  globals: { theme: "portrait" },
  render: () => <Template name="creator" brand="portrait" />,
}

/** creator, in Seed. */
export const CreatorSeed: Story = {
  globals: { theme: "seed" },
  render: () => <Template name="creator" brand="seed" />,
}
