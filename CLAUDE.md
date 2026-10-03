# Feather

Feather is becoming the first liquid design system: semantics in, the right experience out. Read
`docs/PLAN.md` before planning work. It holds the mission, the principles (section 3), the architecture,
the Experience IR, the composer rules and the milestones L0–L7. The owner decided the open questions in its
section 12.

## Layout

- `packages/tokens` (`@aleeforoughi/feather-tokens`): token schema `feather-tokens/2`, plus `qooe-tokens/1`
  migration. Also the theme engine (`src/engine.mjs`, browser-safe, no dependencies), the `feather-brand` CLI,
  `css/foundation.css` (semantic tokens and their Tailwind mapping), the reference themes and the fonts.
- `packages/react` (`@aleeforoughi/feather-react`): components in `src/components/ui` (stories and tests next
  to them), the `src/index.ts` entry, `styles.css`, and `foundation.json` (generated). Atoms, molecules and
  organisms; an organism renders one IR node and follows the contract in `docs/organisms.md`.
- `packages/intent` (`@aleeforoughi/feather-intent`): the Experience IR `feather.ir/0`. `src/spec.ts` is the
  single table of node types; `validate.ts` and `reply.ts` read it; `scripts/generate.ts` writes
  `schema/feather.ir-0.json` and `docs/ir/nodes.md` from it (run `pnpm --filter @aleeforoughi/feather-intent
  generate` after changing it). `src/types.ts` mirrors it by hand. No dependencies.
- `conformance/ir`: valid and invalid IR fixtures; every invalid one lists exactly the issues it must produce.
- `packages/documents`: document templates and the render kit. Private.
- `apps/storybook`: Storybook config, the axe suite (`vitest.config.ts`) and the visual suite (`visual/`).
- `apps/showcase`: consumes the built packages like an outside product.
- `scripts/feather-hygiene.mjs`: the release gate. `legacy/branch-tools`: QOOE's copy-a-branch tools, not run.

## Rules

- Components read semantic tokens only, never raw colors. Every visible part has a `data-slot`, and every
  variant or state a `data-variant`. Motion comes from `useThemeMotion`. Use relative imports in
  `packages/react/src`, never `@/`.
- A brand changes Feather only through tokens. What earns a component its place is in `FEATHER.md`.
- No model calls inside Feather. No persona storage or logging. No Godpip or QOOE imports.
- One version for all packages. Every release adds a `CHANGELOG.md` entry and passes `pnpm hygiene`.
- Before pushing, run: `pnpm lint && pnpm build && pnpm typecheck && pnpm test && pnpm hygiene`. After
  changing components or stories, also run `pnpm manifest` and commit `foundation.json`.
- Visual baselines come from CI's Playwright container (the *Record visual baselines* workflow). Never record
  them locally. After adding stories, push `apps/storybook/visual/RECORD` containing `missing`; the workflow adds
  baselines for new stories only and commits them. A local Chromium differs, so set `CHROMIUM_PATH` and `SNAPSHOT_DIR` to compare two builds
  locally instead.
- Accessibility debt from 1.7.0 is listed in `apps/storybook/.storybook/a11y-known.json`. Only remove
  entries; never add one to get a build green.
- Pinned dependencies (overrides in `pnpm-workspace.yaml`) hold 1.7.0's versions. A release must be a day
  old before it can be installed.

## Team (docs/PLAN.md section 11)

Opus does the IR schema, composer rules, accessibility rules and final review. Sonnet subagents do organisms,
manifestations, the playground and tests. Haiku subagents do stories, fixtures, hygiene runs and visual diffs.
The builder never reviews its own work. Every delegated task names its files and its exit test.
