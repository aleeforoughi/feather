# Feather — changelog

## 1.13.0 — 2026-10-03

**A default theme: feather.** What Feather looks like with no brand.

- `themes/feather.json` (light) and `themes/feather-dark.json` (dark):
  - Black and white. The primary is ink, near-black in light and near-white in dark, and there is no accent.
    Color appears only where it carries meaning: success, warning, info, errors and the destructive act.
  - Warm-neutral greys: a #F7F7F5 page under white surfaces, and #0C0C0E under #16161A in dark.
  - JetBrains Mono throughout, for headings and text alike.
  - The system defaults on every other axis: rounded 8/12/16, comfortable density (44px controls), soft
    elevation, calm motion.
  - Every emphasis color meets its contrast floor. The destructive red is the theme's own (#B42318 light, #FF6B62
    dark), so error text passes AA on the page and on its tint, with no accessibility debt.
- **The fallback is the theme.** foundation.css's `:root` and `.dark` blocks are generated from the two files by
  `scripts/default-theme.mjs` (`pnpm --filter @aleeforoughi/feather-tokens theme:default`), and a test fails on
  drift. A product that applies no brand gets exactly this theme.
- **Geist Mono** joins the foundation font set. A mono family now falls back to `monospace` for display as well
  as body.
- **Corner radius is a hierarchy** (docs/visual-system.md §7). The button radius is the base and the minimum;
  every enclosing level adds one 4px step, so curves inside curves are always tighter (control 8 → card 12 → card
  holding a card 16 → dialog 20). `rounded-card` and `rounded-dialog` compute this from their content with
  `:has()`, so every component follows it without knowing where it sits. A list that insets its items by 4px is
  exactly concentric with them. The `pill` shape's cards and dialogs are now 16 and 20, and the rendered audit
  checks the hierarchy (`radius.nesting`).
- **Spacing belongs to regions** (docs/visual-system.md §3a). A surface divided into regions (dialog, sheet, card,
  the organism cards) has no padding of its own; each region owns an inset by role, scaled by density:
  - content (axis, 20/32);
  - header (directional: 24 above, 16 below);
  - action (perimeter, 20 all sides);
  - utility (axis, 12/16);
  - display (perimeter, 32).

  Gaps have roles too: action 8, label 8, field 16, heading↔body 12. Content directly under a header attaches to
  it, so the heading sits 16px above the body. `p-card` and `p-dialog` are retired. New: `DialogBody` and
  `SheetBody`. Hygiene checks that every region uses its inset; the audit checks each region's values and that
  shells have no padding.
- **Tooltip:** a surface's radius starts at the control radius, so tooltips are 8 and their arrow stays a step
  tighter.
- **Table:** a table wider than its container becomes a focusable, named region while it scrolls, so a keyboard
  user can reach it. Mono text made the comparison table scroll and exposed this.
- **Gates.** Storybook opens in feather. Accessibility runs in all four reference themes, and visual regression
  and the rendered audit cover them too.

## 1.12.0 — 2026-10-03

**Visual hygiene (milestone V1).** Every pixel, gap, radius, type size, border, shadow, duration and curve now
comes from one finite system, `docs/visual-system.md`. Brand themes choose values inside it and can never step
outside it. Every component was normalized onto the system. Normalized means the values moved; nothing was
redesigned, and anatomy, API and behaviour are unchanged. **This is a deliberate visual release:** most
components look different.

- **Tokens** (`@aleeforoughi/feather-tokens`):
  - a fixed 4px spacing unit;
  - three densities (tight, default, spacious) with 36, 44 and 52px controls, as CSS variables on `:root` and per
    `[data-density]`;
  - radius tiers per brand shape that always nest. The default shape is now `rounded`;
  - one emphasis scale for text, icons and borders (`text-fg-*`, `border-line-*`, `bg-surface-*`). The engine
    derives each emphasis color by exact oklab search and checks it against its contrast floor; the primary
    border reaches 3:1;
  - four elevation levels. This also fixes shadows that never reached Tailwind's utilities;
  - one easing curve and six durations per motion axis. A brand's motion setting now scales durations only;
  - type roles on a 4px line grid, font rendering, reduced motion built in, one 2px focus ring, a scrim, 2px
    selection indicators, and layout tokens.
  - `headingWeight` is limited to 400–700 and component border widths to 0 or 1px.
- **Components** (`@aleeforoughi/feather-react`):
  - Buttons, inputs, selects, toggles and tabs share one frame at the density height.
  - Every control, checkbox, radio, switch, menu row, link and disclosure reaches a 44px hit area through an
    invisible extension. A text field is its own target.
  - Motion roles replace every ad-hoc transition. There is no `transition-all` and no layout animation; the
    accordion animates a grid track, and progress and hold fills scale.
  - Dialogs, tables and galleries sit on whole pixels.
  - New: `Icon`, which renders glyphs in a pixel-aligned slot, with an optical registry for asymmetric glyphs.
  - `cn` now merges the system's own utilities.
- **Manifestations:**
  - The web manifestation sets `data-density` from the plan instead of rescaling spacing.
  - Switch scanning uses the same focus ring.
- **Three gates** (docs/visual-system.md §12):
  - **Static hygiene** fails on any off-system value.
  - **A new rendered audit** measures every story in both themes and all three densities: control heights,
    targets, borders and focus, layout shift, type, radius, icons, whole pixels and motion. It is a CI job, and
    its self-test (56 fixtures) proves that each rule fires.
  - **A principle review** is recorded below.
- **Results.** The rendered audit went from 8,158 failures to 0, static findings from 403 to 0, with zero
  optical exceptions. Axe passes in both themes, and all 960 conformance tests still pass.
- **Principle review for this release:**
  - Alignment: the Recommendation and IrreversibleAction headings now share one left edge with their content (the
    icon moved into the eyebrow).
  - Hierarchy, emphasis, consistency, rhythm, depth and accessibility hold across both reference themes.
  - Follow-ups: a "warm" warning tint for the budget bar; reduced motion for JS-driven loops when the OS
    preference changes after load; Sonner's own toast offsets.

## 1.11.0 — 2026-10-03

**More than one body (milestone L4).** The action is permanent; its manifestation is not. One experience now
takes four bodies (web, switch, voice and text), and a conformance suite proves they agree.

- `@aleeforoughi/feather-dialog`: the turn-based engine text and voice share.
  - Its turns are browse, value, confirm, readback and done.
  - It is pure, with no I/O, no DOM and no clock, and every reply is checked with `validateReply`.
  - Only the plan's keyword commits an irreversible act. A number, "yes", or the act's label never does.
  - It owns the sentences every non-visual body says. They match the web organisms' consequences word for word.
- `@aleeforoughi/feather-manifest-text`: `renderTurn`, `runText`, and the `feather-text` CLI.
  - The conversation goes to stderr and replies go to stdout as JSON lines.
  - No meaning depends on colour, and plan text is stripped of control characters.
- `@aleeforoughi/feather-manifest-voice`: `speechFor`, `createVoiceDialog().hear(alternatives)` and
  `runVoice(engine)`, for any speech engine.
  - Spoken numbers, readback of values, and the consequence in full before the keyword.
  - The caller's words are said verbatim.
  - A misheard alternative never changes state.
- `@aleeforoughi/feather-manifest-switch`: scanning over the web body.
  - One switch (auto-scan, started only by the first press) or two (step). Dwell is optional.
  - The highlight is real focus, a ring and a description, never colour alone.
  - Escape in a text field belongs to the scanner, so no form is backed out by accident. Open popups are scanned.
  - Dwell may arm an act; it never commits one.
- `conformance/manifest`, the L4 exit test (960 tests): every valid fixture, plus synthetic ones for paths the
  fixtures miss, and every available act, driven through all four bodies by their own inputs.
  - The same reply in every body.
  - For anything irreversible, the single act emits nothing until the deliberate step: the confirm button, the
    typed or spoken keyword, or a second switch selection.
  - The suite was written independently of the bodies, and its first run found three switch defects, now fixed.
- The playground shows each context in its own body.
- `manifest-web` takes its wording and formatting from `feather-dialog`, so every body says the same thing.

## 1.10.0 — 2026-10-03

**The liquid composer (milestone L3).** Semantics in, the right experience out: one Experience IR, composed for
the person, their abilities and their device. Three new packages.

- `@aleeforoughi/feather-context`: the render context types (persona, capability, device, brand, locale). It is
  types only. The host passes the context per render, and Feather stores none of it.
- `@aleeforoughi/feather-liquid`: `compose(experience, context) → LayoutPlan`.
  - It is pure and deterministic, with no clock, no randomness and no model call, and it never throws.
  - Every value in the plan comes from a named rule (`RULES`) at a principle 8 priority level (safety,
    accessibility, user setting, OS, task, learned, aesthetics, default). The plan's `trace` records the rule,
    the reason and what it overrode.
  - The rules cover:
    - one primary act;
    - irreversible acts, which are confirmed once and never take the default focus;
    - the recommendation first, then its alternatives;
    - critical detail, which is never hidden;
    - density and target size;
    - routing by output: web, switch, voice or text;
    - explanation depth;
    - reduced motion;
    - plain text without a card;
    - contrast;
    - importance;
    - structure.
  - The plan gives `order`, the reading, speaking and scanning order, and a confirm `keyword` in the plan's
    language. Audio and video get `textEquivalent` when there is no sound.
  - Every rule has tests. Every valid fixture in every reference context is snapshot-tested. Invariants (every
    node once, focus never on an irreversible act, no body the output cannot carry) hold for every fixture in 64
    contexts.
  - An experience ten times the largest fixture composes in under 5 ms.
- `@aleeforoughi/feather-manifest-web`: `<FeatherExperience>` and `<PlanView>` render a plan with Feather's
  organisms and atoms.
  - They apply every decision in the plan, and move focus once, on mount.
  - Every act becomes a reply checked with `validateReply`; a refused reply is never sent.
  - Voice and text plans render a plain summary until their own manifestations arrive (L4).
  - Its stories are the new *Experiences* in Storybook, and pass axe in both reference themes.
- `apps/playground`: pick or edit an experience, change the person and the device, and see the result in four
  reference contexts, with the plan, the trace and the compose time. Its end-to-end tests run in CI.

Changes to existing packages:

- **IR:**
  - An act that states a `consequence` is irreversible: `"reversible": true` beside one is an error, and an
    IrreversibleAction may confirm it.
  - An IrreversibleAction's `confirms` may name any irreversible act, including a Choice.
  - Spec defaults (IrreversibleAction `critical`, Warning `high`) are documented and applied by the composer.
  - `validate()` never throws: a document it cannot read gives the issue `unreadable`.
  - Validation is faster on large experiences.
- **Organisms:**
  - Recommendation, IrreversibleAction and Approval take `defaultExpanded`.
  - Approval and Recommendation take `arm`, and arm whenever they state a consequence that nothing else confirms.
  - `useThemeMotion` honors a `MotionPreference` set by the plan.
- **Hygiene** checks the new packages' boundaries: the composer imports only the IR and the context; the web
  manifestation imports only Feather and React, and uses no raw colors.

## 1.9.0 — 2026-10-03

**Decision organisms (milestone L2).** Ten components that each render one Experience IR node as a complete,
accessible interaction, the pieces the composer will assemble at L3. `foundation.json` gains the level
`organism`; there are now 28 atoms, 7 molecules and 10 organisms.

- `Recommendation`, `IrreversibleAction`, `Approval`, `Tradeoff`, `AlternativeList`, `PredictedChoice`,
  `ExploreMore`, `CorrectionInput`, plus the shared `ConsequenceStatement` and `WhyDisclosure`.
- One contract for all of them, `docs/organisms.md`:
  - props mirror the IR node's fields;
  - one `onAct(act, value?)` callback carries exactly the node's reply acts and value encodings, so the composer
    wires replies with no translation;
  - `data-slot` and `data-variant` on every part, so brands restyle states such as
    `"irreversible-action.armed"`.
- Irreversible acts:
  - the consequence always shows verbatim ("Spends AED 1,050") and describes the act for screen readers;
  - confirming takes a deliberate act: arm and then "Yes, …", or a 1.5 s hold by pointer or key;
  - an irreversible act never takes the default focus, and happens once: afterwards the organism shows the
    outcome, offers no control that could act again, and moves focus to the outcome;
  - accepting an irreversible recommendation never commits.
- Critical detail is never hidden behind "Why?". Meaning never depends on color: the destructive color fails AA
  contrast for text in both reference themes, so it marks borders and icons only, and the danger state is
  spoken and written ("Cannot be undone").
- Every organism passes axe with zero violations in both reference themes, and completes its main act by
  keyboard alone in a play test that asserts the reply (208 stories, 0 new accessibility debt).
- Visual baselines: the recording workflow gains a `missing` mode that adds baselines for new stories only.

## 1.8.0 — 2026-10-03

**The Experience IR, `feather.ir/0` (milestone L1).** The public contract: what a caller asks Feather to render,
as meaning. New package `@aleeforoughi/feather-intent`, with no dependencies.

- 24 node types (14 content, 10 decision), the common fields (`id`, `intent`, `importance`, `reversible`,
  `expandable`), references between nodes, and the acts each node takes in its replies
  (`{ experience, node, act, value? }`).
- One table (`src/spec.ts`) drives the validator, the JSON Schema (`schema/feather.ir-0.json`) and the node
  reference (`docs/ir/nodes.md`); a test fails if the generated files drift. TypeScript types in `src/types.ts`.
- `validate()` reports every problem at once, each with a stable code, a JSON Pointer and a sentence saying what
  to change. Beyond structure it checks one primary act per experience, that irreversible acts state their
  consequence (principle 6), that every medium has a text equivalent, that references resolve, and it rejects
  presentational fields (principle 1) and unknown ones, suggesting the name a typo meant. `validateReply()`
  checks a reply against its experience. `feather-ir validate <file>` runs it from a shell.
- Contract rules settled after an adversarial review:
  - `primary` gives emphasis, never default focus.
  - An irreversible act without its own consequence is committed by the IrreversibleAction that `confirms` it,
    implied when there is only one; accepting such a recommendation never commits.
  - An IrreversibleAction is `high` or `critical`.
  - References are typed, and an Alternative follows what it replaces (and names it when there are several
    Recommendations).
  - One PredictedChoice per Choice, agreeing with `selected`.
  - Option and step ids follow the id pattern.
  - Text fields are capped at 4,000 code points.
  - Zoned and wall-clock date-times are never compared.
  - Every reply value has one encoding (money as a number in the Input's currency, a Price alternative as
    `{ amount, currency }`, dates as ISO 8601), and an optional Input can be skipped.
- Hardened: validate() and validateReply() never throw (prototype-named types and fields included), report at
  most 100 issues, escape JSON Pointer segments, and check every node, including those with a bad id.
  validateReply() validates the experience first and checks each value against its node.
- Conformance fixtures in `conformance/ir`: 43 realistic valid experiences that together cover every node type
  and IR feature, and 52 invalid ones, each a valid fixture with one deliberate mistake. Together they cover
  every issue code except `too-many-issues`, and each lists exactly the issues the validator must report.
- Docs: `docs/ir/README.md` (how the IR works, the rules, the codes, versioning).
- `docs/PLAN.md`: the `qooe-core` switch is set aside; Feather builds on the 1.7.0 handoff alone.

## 1.7.0 — 2026-10-03

**Feather becomes independent (milestone L0).** The 1.7.0 components, unchanged, move out of qooe-core into
this repository as packages: `@aleeforoughi/feather-tokens` and `@aleeforoughi/feather-react` on GitHub Packages.
Every story renders pixel-identical to 1.7.0 in both reference themes.

- `@aleeforoughi/feather-tokens`: the theme engine (was `scripts/apply-brand.mjs`; the same CSS, byte for byte),
  the `feather-brand` CLI, the foundation CSS (the semantic tokens and their Tailwind mapping, was the top of
  `src/index.css`), the reference themes, and the 14 fonts. Fonts now resolve through this package
  (`@aleeforoughi/feather-tokens/fonts/<font>.css`), so a product no longer installs Fontsource itself.
- Token schema `feather-tokens/2`: the same fields and semantic role names as `qooe-tokens/1`, now declared with
  `"schema": "feather-tokens/2"`. `qooe-tokens/1` brands (no `schema` field) still work: they migrate on read, or
  in place with `feather-brand --migrate`. A JSON Schema ships for editors (`schema/feather-tokens-2.json`).
- `@aleeforoughi/feather-react`: every component from one entry point, one ES module per component, with type
  declarations; `styles.css` for a product's Tailwind CSS v4 stylesheet; `foundation.json`. `FeatherProvider`
  (color mode, tooltips, toasts) replaces QOOE's `FoundationProviders`; data fetching (React Query) stays in the
  product.
- Moved out of the component system: the app dependencies (`better-auth`, `@tanstack/react-router`,
  `@tanstack/react-query`, `openapi-fetch`, `react-hook-form`, `zod`) belong to products. The copy-a-branch tools
  (`feather-branch`, `check`, `shot`, `BranchSheet`) are kept in `legacy/branch-tools` for QOOE branches that have
  not switched to the packages.
- Gates: hygiene now also checks the packaging (no `@/` imports in published code, every component exported,
  every import a dependency, one version across packages). New in CI: axe on every story in both reference themes
  (in a real browser) and visual regression of every story in both themes. The axe run found 19 violations
  1.7.0 already had (contrast of destructive and muted text, unnamed progress bars); they are recorded in
  `apps/storybook/.storybook/a11y-known.json`, and the gate fails on any new one.
- Dependencies are held at the exact versions 1.7.0 shipped with; installs need a release to be a day old.

Status tokens plus two more molecules promoted from Qoco Panel (its SpendBar and CrewAvatar, made generic).

- Semantic status tokens: `--success`, `--warning` and `--info`, each with a `-foreground`, in light and dark (Tailwind classes `bg-success`, `text-warning`…). Status colors (approved, sent back, budget zones, live states) now theme with the brand instead of using fixed palette classes. The theme engine (`scripts/apply-brand.mjs`) now writes them: a brand may set `colors.success|warning|info` (and `successText`…), otherwise light/dark defaults apply.
- `BudgetBar`: a meter for budgets, quotas and storage. Fill = used, optional target and cap markers with labels, optional striped reserved segment, overshoot drawn beyond the cap; zones `ok | warm | hot | over` as `data-variant` (success / warning / destructive tokens); `size` default | mini; `format` prop (no currency assumed); `role="meter"` with aria values. Slots `budget-bar`, `budget-bar-track`, `budget-bar-fill`, `budget-bar-reserved`, `budget-bar-overshoot`, `budget-bar-marker`, `budget-bar-caption`. Pure helpers `budgetZone` and `budgetGeometry` are exported with tests.
- `RoleAvatar` (+ `RoleChip`, `RoleCard`, `RoleAvatarGroup`): an avatar for a person or agent role. The caller passes `title` and any `icon` (initials when none); `emphasis` rings a distinct role in the primary color; cards take `kind`, `state` (idle, working pulsing, waiting, done), a `meta` line and `metrics`; the group collapses members past `max` into "+n". Slots `role-avatar`, `role-chip`, `role-card`, `role-state`, `role-avatar-group`; helpers `overflow` and `roleInitials` tested.

## 1.6.0 — 2026-10-02

First molecules. Promoted from Qoco Panel after the owner asked for a live view of agents at work: each is
generic (any product can use it), themed only through tokens, and animated at the theme's motion pace.

- `Lightbox`: one image of a set, large, previous / next (buttons and arrow keys), download, a checkerboard
  so transparency shows. Slots `lightbox`, `lightbox-stage`, `lightbox-caption`, `lightbox-nav`.
- `MediaGallery` (+ `MediaTile`): images in titled sections, tiles fading in, any one opening in the
  Lightbox. Slots `media-gallery`, `media-gallery-section`, `media-tile`, `media-tile-label`.
- `ActivityFeed` (+ `ActivityItem`, `LiveDot`, `WorkingDots`, `TypedText`): a live log, newest at the bottom,
  older lines fading out, following new lines until the user scrolls up; tones `info | good | warn | bad |
  ask` as `data-variant`, so `"activity-item.ask"` can be themed alone.
- `AttentionCard`: a rare, important question that pulses until answered, choices on the card; variants
  `default | danger`. Slots `attention-card`, `attention-card-icon`, `attention-card-title`,
  `attention-card-actions`.
- `StepList` (+ `StepItem`): an ordered plan with each step's status `pending | active | done | blocked`
  as `data-variant`. Slots `step-list`, `step-item`, `step-marker`, `step-item-detail`.
- `src/lib/motion.ts`: `useThemeMotion()` reads `--motion-duration` / `--motion-ease` (the brand's motion
  axis) and honours the user's reduced-motion setting; every animated component uses it.
- foundation.json marks these `"level": "molecule"`. Admission rules for new components: FEATHER.md.

## 1.5.0 — 2026-10-01

Found on qoco_panel: the app rendered blank in QOOE's screenshots — Better Auth's client threw
"Invalid base URL: null" because a file:// page has no origin, and the whole app failed to mount.

- Added `src/foundation/runtime.ts`: `isPreview` (QOOE's file:// render) and `appOrigin` (the page's origin
  when served, a placeholder in preview). Build API and auth clients from `appOrigin`; serve fixtures when
  `isPreview`.

## 1.4.0 — 2026-10-01

Closes the visual blocker the design-system designer recorded on qoco_panel: outline buttons could not be
themed apart from filled ones.

- Component tokens per variant: `"button.outline": { "borderColor": "primary", "foreground": "text" }`
  themes only that variant and wins over the slot's own tokens. `Button` now exposes `data-variant` and
  `data-size` (Badge already did, through Base UI).
- Still open from the same report: size-scoped button tokens, a segmented Tabs variant, an emphasis Card,
  status Badge variants, and a responsive navigation recipe.

## 1.3.0 — 2026-10-01

Feather becomes a base for full web apps (QOOE's new web_app product kind; first: Qoco Panel).

- Added: `@tanstack/react-router` (screens; hash history so every screen renders from the built files),
  `openapi-fetch` (API calls typed from a contract; QOOE generates the types, the crew never hand-writes
  them), and `better-auth` (its React client: GitHub, Google, email and password, account settings).
  All pinned and past the minimum release age.
- `shot` renders every screen listed in `design/screens.json`, full page, at 390 and 1280; a single page is
  still `home`.

## 1.2.0 — 2026-10-01

Closes the gap for QOOE's own brand (Qoco Panel): titles in Poppins, body in Figtree.

- Added fonts: **Figtree** (variable) and **Poppins** (fixed weights 400–800; it has no stable variable cut).
- The theme engine supports fixed-weight fonts: it loads only the listed weights and uses the font's own
  family name.

## 1.1.0 — 2026-10-01

Closes two gaps the design-system designer recorded on `sayease_v2`, where the approved designs' extra-heavy
headlines and bright supporting copy could not be themed and QA (rightly) rejected the theme twice.

- Added `typography.headingWeight` (100–900): every `font-heading` element takes the brand's heading weight;
  component tokens (e.g. `card-title.fontWeight`) still override a single component.
- Added `colors.mutedForeground`: the brand's own supporting-text color. Without it, supporting text stays
  a quiet mix of text and background, as before.
- Still open from the same report: per-size button tokens, a circular CTA size, a step indicator, an
  image-label overlay, and an upload drop zone (see the project's design/theme.md).

## 1.0.3 — 2026-10-01

- Fixed: product screenshots (`shot`) captured only the first window, so QA could not see sections
  below the fold and failed a correct section order. Home shots are now full-page (capped at 6,000px),
  via the installed playwright-core driving the same offline headless Chromium.
- Pinned `playwright` to 1.63.0 (was `latest`).

## 1.0.2 — 2026-10-01

Gap closed from the first live project (SayEase landing page).

- Fixed: the themed component sheet rendered open-on-load overlay stories (dialog, sheet, popover,
  tooltip), whose backdrop blurred the whole sheet, so neither the designer nor QA could compare
  components. Open-on-load stories are now left out; overlay surfaces use the card and popover tokens
  shown elsewhere on the sheet.

## 1.0.1 — 2026-10-01

Hygiene release (Bootstrap's first): the new hygiene gate audited 1.0.0.

- Fixed: the `motion` theme axis was written by the engine but read by nothing, so calm and snappy
  brands animated the same. Tailwind's default transition duration and easing now follow it.
- Added: `npm run hygiene` (`scripts/feather-hygiene.mjs`), required for every release.
- Reference themes moved to `themes/*.json`, shared by Storybook and the hygiene gate.

## 1.0.0 — 2026-10-01

First release, owner direction: QOOE builds every product on one themeable master design system.

- Engineering foundation: React 19 + TypeScript, Vite 8, Tailwind CSS v4, Base UI, shadcn/ui (generated
  by the official CLI, `base` library, `nova` preset), Lucide, Motion, React Hook Form + Zod,
  TanStack Query, Vitest, Storybook 10 (docs, a11y, Vitest, MCP).
- 28 atoms with 112 Storybook stories; `foundation.json` manifest generated from the Storybook index.
- Theme engine (`scripts/apply-brand.mjs`, token schema `qooe-tokens/1`): primitive → semantic →
  component tokens; axes shape, density, elevation, motion; 12 pre-installed variable fonts.
- Reference themes: `neutral`, `void-pill`, `paper-sharp`.
