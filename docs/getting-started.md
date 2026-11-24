# Getting started

From nothing to a themed product screen, a themed website, and a call from Python. Each part stands alone: read the
install, then the part you need. The package map is [packages.md](packages.md); theming in depth is
[theming.md](theming.md).

| I want | Go to |
|---|---|
| A product (app, dashboard, tool) | 1, 2, then **A product screen** |
| A website from a document | 1, 2, then **A page in minutes** |
| To ask Feather for an interface from a service | **Python callers** |
| To see it first | `pnpm storybook` in this repository: every component, in every brand, and a theme builder under Foundations |

## 1. Install

Feather is published to GitHub Packages under the `@aleeforoughi` scope. Point the scope at the registry, with a
token that has `read:packages` in `NPM_TOKEN`, in the product's `.npmrc`:

```ini
@aleeforoughi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Then install. A product has React 19 and Tailwind CSS v4 already.

```bash
# a product
npm install @aleeforoughi/feather-react @aleeforoughi/feather-tokens

# a website from a document
npm install @aleeforoughi/feather-page @aleeforoughi/feather-tokens @aleeforoughi/feather-react
```

All packages share one version. Pin them to the same one. With no brand at all, Feather renders its default theme,
`feather`: black and white, JetBrains Mono, colour only where it carries meaning. `.dark` switches to `feather-dark`.

## 2. Theme it: one brand file

A brand is one JSON file. Write the smallest that is yours, in `brand/tokens.json`:

```json
{
  "schema": "feather-tokens/4",
  "name": "Northwind",
  "colors": {
    "background": "#F6F4EF",
    "surface": "#FFFFFF",
    "text": "#1B1A17",
    "primary": "#1B1A17",
    "accent": "#C2410C"
  },
  "typography": {
    "fontFamily": { "display": "Fraunces", "body": "Inter" }
  },
  "shape": "soft",
  "density": "comfortable",
  "elevation": "flat",
  "personality": "calm",
  "loudness": 1,
  "surface": "paper"
}
```

Run the CLI. It reads `brand/tokens.json` and writes the theme into `src/styles`:

```bash
npx feather-brand
# Brand theme applied: {"shape":"soft","density":"comfortable", ...}
```

| Written | What it is |
|---|---|
| `src/styles/brand.css` | The theme: every semantic variable, and your component tokens. |
| `src/styles/brand-fonts.css` | The font imports (and, for open fonts, their `@font-face` rules). |
| `src/styles/brand-preload.html` | Preload links for display faces marked `preload`, when there are any. |

Other paths: `npx feather-brand path/to/tokens.json --out some/dir`. If the brand cannot theme (a colour under its
contrast floor, an unknown font), the command prints every problem, writes nothing, and exits 1. It never adjusts a
brand quietly. An older file moves up with `npx feather-brand --migrate` (to `/3`) or `--migrate --to 4`.

In the product's stylesheet, in this order:

```css
@import "tailwindcss";
@import "@aleeforoughi/feather-react/styles.css";
@import "./styles/brand-fonts.css";
@import "./styles/brand.css";
```

That is the whole theme. Everything below wears it. [theming.md](theming.md) explains every field.

## A product screen

Wrap the app once, then compose from Feather:

```tsx
import { Button, Card, CardContent, FeatherProvider } from "@aleeforoughi/feather-react"

export function App() {
  return (
    <FeatherProvider>
      <Card>
        <CardContent>
          <Button>Continue</Button>
        </CardContent>
      </Card>
    </FeatherProvider>
  )
}
```

### Ask for the interaction, not the layout

For a decision, describe what must happen as an experience (the [Experience IR](ir/README.md), `feather.ir/0`) and let
Feather compose it for this person and device. Add `@aleeforoughi/feather-manifest-web` and
`@aleeforoughi/feather-intent`:

```tsx
import { validate, formatIssues } from "@aleeforoughi/feather-intent"
import { FeatherExperience } from "@aleeforoughi/feather-manifest-web"

const experience = {
  ir: "feather.ir/0",
  experience: "approve_campaign",
  nodes: [
    { type: "Recommendation", id: "rec", intent: "launch the recommended test", summary: "7 days, purchase objective" },
    { type: "IrreversibleAction", id: "go", intent: "confirm spend", consequence: { spend: { amount: 1050, currency: "AED" } } },
    { type: "Alternative", id: "less", intent: "spend less" },
  ],
}

const result = validate(experience)
if (!result.ok) console.error(formatIssues(result.issues))

<FeatherExperience
  experience={experience}
  context={{ device: { surface: "phone" }, persona: { explanation: "brief" } }}
  onReply={(reply) => send(reply)} // { experience, node, act, value? }, already checked with validateReply
/>
```

The host passes the context on every render; Feather stores none of it. To see what the composer decided and why,
call `compose(experience, context)` from `@aleeforoughi/feather-liquid`: every value in the plan names the rule that
chose it. Every node type is in [ir/nodes.md](ir/nodes.md); the rules are in [composer.md](composer.md).

## A page in minutes

A website is one `feather.page/1` document and a brand file. Save this as `page.json` beside `brand/tokens.json`:

```json
{
  "schema": "feather.page/1",
  "brand": "brand/tokens.json",
  "title": "Northwind",
  "description": "Maps that explain themselves.",
  "lang": "en",
  "sections": [
    { "block": "hero", "title": "Maps that explain themselves.", "lede": "Northwind turns a route into a sentence you can trust." },
    { "block": "statement", "title": "One clear next turn.", "body": "Everything else waits until you need it." },
    { "block": "contact", "title": "Talk to us", "body": "We answer within a day.", "actions": [{ "label": "hello@northwind.example", "href": "mailto:hello@northwind.example" }] }
  ],
  "footer": { "variant": "plain", "note": "Northwind" }
}
```

Check it, then build it:

```bash
npx feather-page validate page.json
# page.json: valid feather.page/1, 3 sections, 0 prepared scenes

npx feather-page build page.json --out dist --css /app.css
# built 1 routes into dist
```

`validate` prints every problem with its JSON pointer and a code, and exits 1. `build` writes `dist/index.html` (and one
static route per prepared scene, and `404.html` when the page has a `notFound`). The HTML is complete with no script.
`brand` is read relative to the page file. The theme travels inside the HTML; the stylesheet is yours: compile one
with Tailwind v4 and pass its URL with `--css`. It must carry Feather's classes, so the entry reads:

```css
@import "tailwindcss";
@import "@aleeforoughi/feather-react/styles.css";
@import "./styles/brand-fonts.css";
@source "../node_modules/@aleeforoughi/feather-expression/dist";
@source "../node_modules/@aleeforoughi/feather-living/dist";
@source "../node_modules/@aleeforoughi/feather-page/dist";
```

(Adjust the `@source` paths to where the CSS file sits.) Run the Tailwind v4 CLI or its Vite plugin over it to produce
`app.css`.

### The same page in React

```tsx
import { FeatherPage, mountPage, validatePage } from "@aleeforoughi/feather-page"
import type { BrandTokens } from "@aleeforoughi/feather-tokens"
import brand from "../brand/tokens.json"
import doc from "./page.json"

const result = validatePage(doc)
if (!result.ok) throw new Error(result.issues.map((i) => `${i.path} ${i.code}`).join("\n"))

mountPage(document.getElementById("root")!, <FeatherPage page={result.page} tokens={brand as BrandTokens} />)
```

Use `mountPage`, not a plain `root.render`: it renders in a transition, so the long first render yields to the main
thread (a full page in one task breaks the 200 ms mobile blocking budget). Changing `tokens` restyles the whole page,
which is how the showcase shows one document in three brands.

Add edges (`nav`, `loader`, `notFound`, `transition`, `sound`), loudness, block variants and knobs in the same
document: see [page.md](page.md) and [patterns.md](patterns.md).

## Python callers

A caller sends an experience and receives the person's reply; it never sends a component, a colour or a position.
The SDK is a wheel attached to each Feather release (the repository is private, so use a token that can read it).
Pin an exact version:

```bash
gh release download v1.19.0 --repo aleeforoughi/feather --pattern 'feather_sdk-*.whl' --dir vendor/
pip install vendor/feather_sdk-1.19.0-py3-none-any.whl
```

Use the latest release's tag in place of `v1.19.0`. Python 3.11 or later, no dependencies. Then:

```python
from feather_sdk import experience, format_issues, nodes, validate

approve = experience("approve_campaign", [
    nodes.Recommendation(id="rec", intent="launch the recommended test", summary="7 days, purchase objective"),
    nodes.IrreversibleAction(id="go", intent="confirm spend", consequence={"spend": {"amount": 1050, "currency": "AED"}}),
    nodes.Alternative(id="less", intent="spend less"),
])
result = validate(approve)
if not result.ok:
    raise ValueError(format_issues(result.issues))
```

Serve the browser bundle from the wheel (`feather_sdk.static_dir()`), `mount()` it in the page, and check every reply
with `validate_reply` before acting on it. The full walkthrough, including updates and the reference caller, is
[callers.md](callers.md).

## From a QOOE Feather branch

A product that was cut as a copy of Feather (`feather.lock.json`) switches by deleting its copied
`src/components/ui`, `src/lib/motion.ts` and `scripts/apply-brand.mjs`, installing the packages as above, and
rewriting `@/components/ui/<name>` imports to `@aleeforoughi/feather-react`. `FoundationProviders` becomes
`FeatherProvider` plus the product's own `QueryClientProvider`; `isPreview` and `appOrigin`
(`legacy/branch-tools/foundation/runtime.ts`) move into the product. `brand/tokens.json` needs no change. The
old tools stay in [`legacy/branch-tools`](../legacy/branch-tools) until every branch has moved.

## Where next

| | |
|---|---|
| Every field of a brand file, and how one file restyles everything | [theming.md](theming.md) |
| The package map and who depends on whom | [packages.md](packages.md) |
| Every award pattern built, and what is planned | [patterns.md](patterns.md) |
| The values behind it all | [visual-system.md](visual-system.md) |
| What changed, release by release | [../CHANGELOG.md](../CHANGELOG.md) |
