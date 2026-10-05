# Feather

Feather is becoming the first liquid design system: semantics in, the right experience out. Read
`docs/PLAN.md` before planning work; its section 0 says where things stand and what is open. It holds the mission, the principles (section 3), the architecture,
the Experience IR, the composer rules and the milestones L0–L7. The owner decided the open questions in its
section 12.

## Layout

- `packages/tokens` (`@aleeforoughi/feather-tokens`): token schema `feather-tokens/2`, plus `qooe-tokens/1`
  migration. Also the theme engine (`src/engine.mjs`, browser-safe, no dependencies), the `feather-brand` CLI,
  `css/foundation.css` (semantic tokens and their Tailwind mapping), the reference themes and the fonts.
- `packages/react` (`@aleeforoughi/feather-react`): components in `src/components/ui` (stories and tests next
  to them), the `src/index.ts` entry, `styles.css`, and `foundation.json` (generated). Atoms, molecules and
  organisms; an organism renders one IR node and follows the contract in `docs/organisms.md`.
- `packages/intent` (`@aleeforoughi/feather-intent`): the Experience IR `feather.ir/1`. `src/spec.ts` is the
  single table of node types; `validate.ts` and `reply.ts` read it; `scripts/generate.ts` writes
  `schema/feather.ir-1.json` and `docs/ir/nodes.md` from it (run `pnpm --filter @aleeforoughi/feather-intent
  generate` after changing it). `src/types.ts` mirrors it by hand. No dependencies.
- `conformance/ir`: valid and invalid IR fixtures; every invalid one lists exactly the issues it must produce.
- `packages/context` (`@aleeforoughi/feather-context`): the render context types (persona, capability, device,
  brand). Types only.
- `packages/liquid` (`@aleeforoughi/feather-liquid`): the composer, `compose(experience, context) → LayoutPlan`.
  Imports only intent and context. Its rules are in `src/rules.ts`, documented in `docs/composer.md`, and proven in
  `test/rules.test.ts` (every rule), `test/invariants.test.ts` (what must always hold) and `test/plans/`
  (snapshots of every fixture in every reference context; update them with `-u` and review the diff).
- `packages/manifest-web` (`@aleeforoughi/feather-manifest-web`): renders a plan on the web (`FeatherExperience`,
  `PlanView`), following the contract in `docs/composer.md`. Its stories are the "Experiences" in Storybook.
- `packages/dialog` (`@aleeforoughi/feather-dialog`): the turn-based engine text and voice share (no I/O, no DOM,
  no clock). `packages/manifest-text` (the `feather-text` CLI), `packages/manifest-voice` (any speech engine) and
  `packages/manifest-switch` (scanning and dwell over manifest-web) are the other bodies. Their contract is
  `docs/manifestations.md`.
- `conformance/manifest`: the cross-body suite. Every fixture and act through all four bodies; same reply, and a
  deliberate act for anything irreversible. Written independently of the bodies; a body bug fails it, never a
  driver workaround.
- `packages/python` (`feather-sdk`, import `feather_sdk`): the caller API for Python, no dependencies. Its validators
  must match the TypeScript ones case for case: `conformance/parity` is written from TypeScript by
  `packages/intent/scripts/parity.ts`, and `_spec.json`/`nodes.py` by the intent `generate` script. Never edit those
  by hand. Its version (`feather_sdk/_version.py`) moves with the others.
- `packages/embed` (`@aleeforoughi/feather-embed`): Feather in any page with one import, `mount(el, experience,
  options)`. Its CSS is scoped to `.feather-root` at build time; it must never change the host page (its e2e proves it
  on Godpip's stylesheet). The wheel ships it (`pnpm build:wheel`). Callers start at `docs/callers.md`;
  `examples/python-caller` is the reference caller.
- `packages/documents`: document templates and the render kit. Private.
- `apps/storybook`: Storybook config, the axe suite (`vitest.config.ts`) and the visual suite (`visual/`).
- `apps/showcase`: consumes the built packages like an outside product.
- `apps/playground`: one IR in four contexts, with the plan and trace; end-to-end tests run with `pnpm test:playground`.
- `scripts/feather-hygiene.mjs`: the release gate. `legacy/branch-tools`: QOOE's copy-a-branch tools, not run.

## Rules

- Every visual value comes from `docs/visual-system.md`: spacing steps, density utilities (`h-control`, `p-card`…),
  `type-*` roles, `text-fg-*`/`border-line-*`/`bg-surface-*` emphasis, radius tiers, `shadow-1|2|3`, 1px borders,
  `motion-*` roles, `Icon` for glyphs, 44px hit areas. An arbitrary value needs an entry in
  `packages/react/optical-exceptions.json`. `pnpm hygiene` and the rendered audit (`pnpm test:audit`, in CI)
  enforce it. Normalize, never redesign.
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
