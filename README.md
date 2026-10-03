# Feather

**Feather renders the next necessary human interaction, shaped to this person, on this device, right now, and
dissolves it when its purpose is done.** Semantics in, the right experience out.

Feather is becoming the first *liquid* design system: callers will describe what must happen (an Experience IR),
and Feather composes the interface for the person, their abilities and their device at runtime. The plan, its
principles and its milestones are in [`docs/PLAN.md`](docs/PLAN.md).

Feather today has two halves:

- The static foundation (milestone L0): 35 themeable React components, a token-driven theme engine and the gates
  that keep them clean.
- The contract the liquid system is built on (L1): the [Experience IR](docs/ir/README.md), with its validator and
  conformance fixtures.

| Package | What it is |
|---|---|
| [`@aleeforoughi/feather-tokens`](packages/tokens) | Token schema `feather-tokens/2`, the theme engine and `feather-brand` CLI, the foundation CSS, the reference themes and fonts. |
| [`@aleeforoughi/feather-intent`](packages/intent) | The Experience IR `feather.ir/0`: TypeScript types, JSON Schema, `validate()`, `validateReply()` and the `feather-ir` CLI. No dependencies. |
| [`@aleeforoughi/feather-react`](packages/react) | 28 atoms and 7 molecules on Base UI and Tailwind CSS v4, styled only through tokens. |
| [`@aleeforoughi/feather-documents`](packages/documents) | Token-themed HTML/CSS document templates and the render and verify kit (not published yet). |
| [`apps/storybook`](apps/storybook) | Every component and story, switchable between the reference themes; home of the a11y and visual suites. |
| [`apps/showcase`](apps/showcase) | The component sheet, built against the packages exactly as a product would. |

## Ask Feather for an experience

Callers describe the interaction as meaning, in `feather.ir/0`, and validate it before sending:

```ts
import { validate, formatIssues } from "@aleeforoughi/feather-intent"

const result = validate({
  ir: "feather.ir/0",
  experience: "approve_campaign",
  nodes: [
    { type: "Recommendation", id: "rec", intent: "launch the recommended test", summary: "7 days, purchase objective" },
    { type: "IrreversibleAction", id: "go", intent: "confirm spend", consequence: { spend: { amount: 1050, currency: "AED" } } },
    { type: "Alternative", id: "less", intent: "spend less" },
  ],
})
if (!result.ok) console.error(formatIssues(result.issues))
```

How the IR works, and every rule and error code, is in [`docs/ir/README.md`](docs/ir/README.md); every node
type is in [`docs/ir/nodes.md`](docs/ir/nodes.md). The composer that turns an experience into an interface is
milestone L3.

## Use Feather in a product

1. Point the `@aleeforoughi` scope at GitHub Packages (a token with `read:packages` in `NPM_TOKEN`), in `.npmrc`:

   ```ini
   @aleeforoughi:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
   ```

2. Install, with React 19 and Tailwind CSS v4 already in the product:

   ```bash
   npm install @aleeforoughi/feather-react @aleeforoughi/feather-tokens
   ```

3. Write the brand into `brand/tokens.json` (`feather-tokens/2`; a QOOE `qooe-tokens/1` file works as it is) and
   generate the theme:

   ```bash
   npx feather-brand                     # brand/tokens.json → src/styles/brand.css, brand-fonts.css
   npx feather-brand --migrate           # optional: stamp an old qooe-tokens/1 file as feather-tokens/2
   ```

4. In the product's stylesheet:

   ```css
   @import "tailwindcss";
   @import "@aleeforoughi/feather-react/styles.css";
   @import "./styles/brand-fonts.css";
   @import "./styles/brand.css";
   ```

5. Wrap the app once and compose from Feather:

   ```tsx
   import { Button, Card, CardContent, FeatherProvider } from "@aleeforoughi/feather-react"

   <FeatherProvider>
     <Card><CardContent><Button>Continue</Button></CardContent></Card>
   </FeatherProvider>
   ```

A brand reshapes Feather only through tokens: colors, fonts, the shape, density, elevation and motion axes, and
component tokens per `data-slot` (`"button"`, `"button.outline"`). Never edit a component; ask for the gap as an
issue.

### From a QOOE Feather branch

A product that was cut as a copy of Feather (`feather.lock.json`) switches by deleting its copied
`src/components/ui`, `src/lib/motion.ts` and `scripts/apply-brand.mjs`, installing the packages as above, and
rewriting `@/components/ui/<name>` imports to `@aleeforoughi/feather-react`. `FoundationProviders` becomes
`FeatherProvider` plus the product's own `QueryClientProvider`; `isPreview` and `appOrigin`
(`legacy/branch-tools/foundation/runtime.ts`) move into the product. `brand/tokens.json` needs no change. The
old tools stay in [`legacy/branch-tools`](legacy/branch-tools) until every branch has moved.

## Develop

Node 24 (22.22.2 or later works) and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm storybook             # every component; switch the reference themes in the toolbar
pnpm build                 # build the packages
pnpm lint && pnpm typecheck && pnpm test
pnpm hygiene               # the release gate
pnpm manifest              # rebuild Storybook and regenerate packages/react/foundation.json
pnpm test:a11y             # axe on every story (FEATHER_THEME=paper-sharp|void-pill)
pnpm test:visual           # every story in both themes against visual/__screenshots__
```

The visual baselines are recorded in CI's Playwright container (the *Record visual baselines* workflow), so a
local run only matches pixel for pixel inside `mcr.microsoft.com/playwright:v1.63.0-noble`.

### Gates

Every change passes CI: lint, types, unit tests, the package build, the hygiene gate, the Storybook build, axe
on every story in both reference themes, and visual regression of every story in both themes. What earns a
component its place, and how it is versioned, is in [`FEATHER.md`](FEATHER.md).

### Release

All packages share one version. To release, bump it in every `package.json`, add the `CHANGELOG.md` entry,
run `pnpm manifest`, and merge to `main`. The *Publish* workflow sees a version with no `v<version>` tag, checks
every gate again, publishes to GitHub Packages, then creates the tag and a GitHub release from the changelog
entry. A push to `main` with an unchanged version publishes nothing.

## History

Feather was built inside QOOE (`qooe-core/qooe/feather`) from 1.0.0 to 1.7.0, 2026-10-01 to 2026-10-03. The
first commit here imports that release unchanged; `git log --follow` traces every file back to it. The QOOE
handoff and its file manifest are in [`docs/history`](docs/history).

Proprietary; see [`LICENSE`](LICENSE).
