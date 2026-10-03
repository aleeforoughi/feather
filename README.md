# Feather

**Feather renders the next necessary human interaction, shaped to this person, on this device, right now, and
dissolves it when its purpose is done.** Semantics in, the right experience out.

Feather is becoming the first *liquid* design system: callers describe what must happen (an Experience IR), and
Feather composes the interface for the person, their abilities and their device at runtime. The plan, its
principles and its milestones are in [`docs/PLAN.md`](docs/PLAN.md).

What is built so far:

- **The static foundation (L0):** themeable React components, a token-driven theme engine, and the gates that keep
  them clean.
- **The contract (L1):** the [Experience IR](docs/ir/README.md), with its validator and conformance fixtures.
- **Decision organisms (L2):** [ten components](docs/organisms.md), each rendering one IR node as a complete,
  accessible interaction.
- **The liquid composer (L3):** [`compose(experience, context)`](docs/composer.md) turns an experience and who it is
  for into a layout plan by named rules, with a trace of every decision. The web manifestation renders that plan,
  and the playground shows one experience in four contexts.
- **Visual hygiene (V1):** every value comes from [one finite visual system](docs/visual-system.md) (4px grid, three
  densities, one control frame, type roles, one emphasis scale, one motion curve), enforced by static hygiene and a
  rendered audit of every story.
- **More than one body (L4):** the same experience as [web, switch scanning, voice and plain text](docs/manifestations.md).
  A conformance suite proves every act reaches the same reply in all four, and that an irreversible act needs a
  deliberate act in each.

| Package | What it is |
|---|---|
| [`@aleeforoughi/feather-tokens`](packages/tokens) | Token schema `feather-tokens/2`, the theme engine and `feather-brand` CLI, the foundation CSS, the reference themes and fonts. |
| [`@aleeforoughi/feather-intent`](packages/intent) | The Experience IR `feather.ir/0`: TypeScript types, JSON Schema, `validate()`, `validateReply()` and the `feather-ir` CLI. No dependencies. |
| [`@aleeforoughi/feather-context`](packages/context) | Who an experience is rendered for, and where: persona, capability, device and brand types. Types only. |
| [`@aleeforoughi/feather-liquid`](packages/liquid) | The composer: `compose(experience, context)` gives a layout plan, by named rules, with a trace. Pure and deterministic. |
| [`@aleeforoughi/feather-manifest-web`](packages/manifest-web) | The web manifestation: `<FeatherExperience>` and `<PlanView>` render a plan with Feather's components, and turn every act into a validated reply. |
| [`@aleeforoughi/feather-manifest-switch`](packages/manifest-switch) | Switch access on the web: scanning (one or two switches) and dwell over the web body. Dwell may arm an act; it never commits one. |
| [`@aleeforoughi/feather-dialog`](packages/dialog) | The turn-based engine text and voice share: what to present, what the person may answer, and the reply it becomes. No I/O. |
| [`@aleeforoughi/feather-manifest-text`](packages/manifest-text) | Plain text and the terminal, with the `feather-text` CLI (conversation on stderr, replies as JSON lines on stdout). |
| [`@aleeforoughi/feather-manifest-voice`](packages/manifest-voice) | Prompts, spoken confirmations and readback for any speech engine. |
| [`@aleeforoughi/feather-react`](packages/react) | 28 atoms, 7 molecules and 10 organisms on Base UI and Tailwind CSS v4, styled only through tokens. |
| [`@aleeforoughi/feather-documents`](packages/documents) | Token-themed HTML/CSS document templates and the render and verify kit (not published yet). |
| [`apps/storybook`](apps/storybook) | Every component and story, switchable between the reference themes; home of the a11y and visual suites. |
| [`apps/showcase`](apps/showcase) | The component sheet, built against the packages exactly as a product would. |
| [`apps/playground`](apps/playground) | Edit an experience, change the person and the device, and see the plan, the trace and the result in four contexts, each in its own body. |
| [`conformance`](conformance) | IR fixtures, and the cross-body suite: every act, in every body, reaches the same reply. |

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
type is in [`docs/ir/nodes.md`](docs/ir/nodes.md).

Render it for the person in front of you. The host passes the context on every render, and Feather stores none of
it:

```tsx
import { FeatherExperience } from "@aleeforoughi/feather-manifest-web"

<FeatherExperience
  experience={experience}
  context={{ device: { surface: "phone" }, persona: { explanation: "brief" } }}
  onReply={(reply) => send(reply)} // { experience, node, act, value? }, already checked with validateReply
/>
```

To see what Feather decided and why, call `compose(experience, context)` from `@aleeforoughi/feather-liquid`. Each
value in the plan comes with the rule that chose it and what it overrode. The rules are in
[`docs/composer.md`](docs/composer.md).

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

   With no brand, Feather renders its default theme, **feather**: black and white, with color only where it
   carries meaning (status, errors). Everything is set in JetBrains Mono, headings and text alike, and `.dark` switches to
   **feather-dark**. Steps 3 and 4 are for a product that has its own brand.

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
pnpm test:a11y             # axe on every story (FEATHER_THEME=feather|feather-dark|paper-sharp|void-pill)
pnpm test:visual           # every story in all four reference themes against visual/__screenshots__
pnpm --filter @feather-apps/playground dev   # the playground
node packages/manifest-text/dist/cli.js conformance/ir/valid/ad-campaign-launch.json   # an experience in the terminal
pnpm test:playground       # build the playground and run its end-to-end tests (CHROMIUM_PATH to reuse a browser)
```

The visual baselines are recorded in CI's Playwright container (the *Record visual baselines* workflow), so a
local run only matches pixel for pixel inside `mcr.microsoft.com/playwright:v1.63.0-noble`.

### Gates

Every change passes CI: lint, types, unit tests, the package build, the hygiene gate, the Storybook build, axe
on every story in both reference themes, visual regression of every story in both themes, and the playground's
end-to-end tests. What earns a
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
