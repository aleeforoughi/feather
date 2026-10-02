# Feather: the first liquid design system

Handoff for a new repo and a new session. Written 2026-10-03 from the Godpip architecture
sessions and the current Feather 1.6.0 in `qooe-core/qooe/feather/web`.

Feather is independent. It does not import Godpip or QOOE. Godpip, QOOE and any other system
connect to it later through one public contract: the **Experience IR**.

---

## 1. Mission

> **Feather renders the next necessary human interaction, shaped to this person, on this device, right now, and dissolves it when its purpose is done.**

A static design system ships components that products assemble at build time.
A **liquid** design system also composes the interface at runtime from meaning:
what must happen, for whom, through which senses and hands, on which surface.

One line: **semantics in, the right experience out.**

## 2. What "liquid" means

Feather is liquid when it has all five properties. Each one is testable.

| Property | Static design system | Feather |
|---|---|---|
| **Semantic input** | Products pass components and props. | Callers pass intent: an action, its importance, reversibility, alternatives. No pixels, no component names. |
| **Runtime composition** | Layout is fixed per screen. | A composer turns intent plus context into a layout plan at runtime. |
| **Person-shaped** | One theme per brand. | Density, explanation depth, motion and hierarchy follow a persona slice, within brand tokens. |
| **Capability-shaped** | Accessibility is an overlay. | The same action manifests as a button, a voice confirmation, a switch target, a keyboard command or plain text. |
| **Ephemeral** | Screens persist. | An interface exists while its intent exists, then collapses. The artifact stays; the UI goes. |

## 3. Principles

1. **Semantics, not pixels.** Callers never name a component, color or position.
2. **The action is permanent; its manifestation is not.** One semantic action, many physical forms.
3. **Render only the next necessary interaction.** The minimum interface is often plain text.
4. **Resist generating UI because it can.** Each element earns its place.
5. **Expand on "Why?", collapse on "Continue".** Detail is on demand.
6. **Irreversible means explicit.** Spending, publishing, sending and consent always show the exact consequence and need a deliberate act.
7. **Infer interaction needs, never diagnoses.** Feather models what a person can do, not what condition they have.
8. **Priority when rules conflict:** safety and critical comprehension → explicit accessibility needs → explicit user settings → OS settings → task needs → learned preferences → aesthetics.
9. **Deterministic.** The same IR and context always produce the same layout plan. No model call inside the renderer.
10. **Brand through tokens only.** A brand reshapes Feather through tokens; it never edits components.
11. **Feather stores nothing about people.** Persona and capability arrive per render from the host. Feather keeps no profile.

## 4. Starting point: Feather 1.6.0 (in `qooe-core`)

> The starting point turned out to be **1.7.0** (35 components: 1.6.0 plus status tokens, `BudgetBar` and
> `RoleAvatar`), delivered as a release package without git history. It was imported unchanged as this repo's
> first commit.

Carry over, as the static foundation:

- **Stack:** React, TypeScript, Vite, Tailwind CSS v4, Base UI primitives, shadcn/ui source, Lucide, Motion, Storybook (a11y), Vitest, Playwright.
- **Components (33):** atoms such as button, card, dialog, field, input, select, tabs, tooltip, progress, sheet; and molecules `ActivityFeed`, `AttentionCard`, `StepList`, `MediaGallery`, `Lightbox`.
- **Tokens:** schema `qooe-tokens/1` with three tiers: primitive, semantic, and component (on `data-slot`).
- **Theme axes:** shape, density, elevation, motion, fonts. Reference themes: `paper-sharp` and `void-pill`.
- **Discipline:** `foundation.json` manifest, semver with CHANGELOG, the hygiene gate (`scripts/feather-hygiene.mjs`), and visual regression across reference themes.

Change on the move:

- The token schema becomes `feather-tokens/2`. It keeps `qooe-tokens/1` input working through a migration.
- QOOE's Bootstrap loop (gaps → proposal → owner authorizes → release) stays the way QOOE asks for upgrades. In the new repo it arrives as issues. Feather owns its releases.
- `qooe-core` consumes Feather as a versioned package. A one-time import keeps git history if possible (`git subtree split`).

## 5. Architecture

A monorepo with small packages. Arrows show what may import what.

> Package names: `@feather/x` below is published as `@aleeforoughi/feather-x` (decision 12.2).

```text
@feather/tokens      token schema, theme engine, CSS variables        (no deps)
@feather/react       atoms, molecules, organisms                      → tokens
@feather/intent      Experience IR: JSON Schema, TS types, validator  (no deps)
@feather/context     PersonaSlice, CapabilityProfile, DeviceContext   (types only)
@feather/liquid      composer: IR + context → LayoutPlan              → intent, context
@feather/manifest-*  renderers of a LayoutPlan:
    manifest-web     React DOM                                        → react, liquid
    manifest-voice   speech prompts and spoken confirmations           → liquid
    manifest-text    plain text and terminal                          → liquid
    manifest-switch  scanning and switch access (on top of web)       → manifest-web
apps/playground      paste an IR, change persona and capability live, see every manifestation
apps/storybook       components and organisms
conformance/         IR fixtures with expected layout plans for every manifestation
```

The composer is the heart. It is a pure function:

```text
compose(ir, context) → LayoutPlan
context = { persona, capability, device, surface, locale, brandTokens }
LayoutPlan = ordered regions → nodes → manifestation hints (density, depth, emphasis, input modes)
```

## 6. Experience IR v0 (the public contract)

The contract Godpip, QOOE and others will emit. Version it from day one (`feather.ir/0`).

**Content nodes:** `Action`, `Choice`, `Input`, `Price`, `Person`, `Date`, `Location`, `Status`, `Progress`, `Media`, `Confirmation`, `Warning`, `Approval`, `Text`.

**Decision nodes:** `Recommendation`, `PredictedChoice`, `Alternative`, `Tradeoff`, `Autopick`, `Correction`, `Preference`, `Comparison`, `IrreversibleAction`, `ExploreMore`.

Every node carries:

```text
id           stable within the experience
intent       what the human is doing here, in a few words
importance   low | normal | high | critical
reversible   true | false
expandable   optional detail behind "Why?"
```

Example: a paid campaign launch.

```json
{
  "ir": "feather.ir/0",
  "experience": "approve_campaign",
  "nodes": [
    {"type": "Recommendation", "id": "rec", "intent": "launch the recommended test",
     "importance": "high", "reversible": false,
     "summary": "Recommended test: 7 days, purchase objective",
     "expandable": {"why": "Enough to test three creative directions without overspending."}},
    {"type": "Price", "id": "cap", "amount": 1050, "currency": "AED", "label": "Maximum spend"},
    {"type": "IrreversibleAction", "id": "go", "intent": "confirm spend",
     "importance": "critical", "reversible": false, "consequence": {"spend": {"amount": 1050, "currency": "AED"}}},
    {"type": "Alternative", "id": "less", "intent": "spend less"},
    {"type": "Alternative", "id": "own", "intent": "set my own budget", "input": "Price"}
  ]
}
```

The same IR becomes a card with one primary button on a phone, a spoken summary plus "say confirm" by
voice, three scannable targets for a switch user, or three numbered lines in a terminal.

Replies flow back as events: `{ "experience": "approve_campaign", "node": "go", "act": "confirm" }`.

## 7. Composer rules (first set)

1. One primary act per experience. A second primary is a validation error.
2. `IrreversibleAction` always shows its consequence verbatim and needs a deliberate act: hold, confirm or a spoken keyword. It is never the default focus.
3. `Recommendation` comes first, then alternatives. The recommended choice is preselected unless the act is irreversible.
4. `importance: critical` is never hidden behind expansion.
5. Density follows `persona.density` within the brand's density axis. `capability.precision: low` raises target size to at least 44 px and spacing to match.
6. `capability.output.audio: unavailable` puts every audio-only cue into text. `capability.output.visual: unavailable` routes to `manifest-voice` or `manifest-text`.
7. `persona.explanation: brief` collapses `expandable`. `detailed` opens it.
8. `reducedMotion` from the OS always wins over brand motion.
9. Text that fits in one line, with no decision, renders as text. No card.
10. Contrast meets WCAG 2.2 AA in every theme. AAA where `capability.vision: low`.

## 8. Milestones

Each milestone ships on its own. Targets are the exit gate.

### L0. Independent repo (week 1)
- Create the repo `aleeforoughi/feather`, a pnpm monorepo, and CI (typecheck, unit, Storybook build, a11y, visual regression).
- Import Feather 1.6.0 into `@feather/tokens` and `@feather/react` with history if possible.
- Port the hygiene gate, and publish 1.7.0 to a private registry or as a git dependency.
- **Exit:** `qooe-core` builds against the package with no visual diff on both reference themes. Hygiene passes. CI is green.

### L1. Experience IR v0 (week 2)
- Write the JSON Schema and TS types for every node in section 6, plus a validator with readable errors.
- Write 40 fixture IRs: purchase approval, ad launch, a choice among three, a missing fact, a status update, an error, a progress stream, a referential correction, and more.
- **Exit:** every fixture validates, 20 invalid fixtures are rejected with the right error, and the schema is versioned and documented.

### L2. Decision organisms (weeks 2–3)
- Build `Recommendation`, `AlternativeList`, `Tradeoff`, `IrreversibleAction`, `Approval`, `PredictedChoice`, `ExploreMore` and `CorrectionInput` as React organisms on top of the existing atoms. `AttentionCard`, `StepList` and `ActivityFeed` become their base.
- **Exit:** every organism has stories in every theme, passes axe with 0 violations, works by keyboard alone, and passes hygiene.

### L3. The liquid composer (weeks 3–5)
- Build `@feather/context` types and `@feather/liquid` `compose(ir, context)`.
- Implement the rules in section 7 as named, tested rules, plus a rule trace that explains why each choice was made.
- Add `manifest-web`: LayoutPlan to React.
- Add `apps/playground`: paste an IR, then flip persona, capability, device and theme live.
- **Exit:**
  - All 40 fixtures compose deterministically, with snapshot tests.
  - Each composer rule has a test.
  - Compose time is under 5 ms per IR in the browser.
  - The playground shows one IR in 4 contexts.

### L4. More than one body (weeks 5–7)
- Build `manifest-text` (terminal and plain text), `manifest-voice` (prompts, confirmations and readback for any speech engine), and `manifest-switch` (scanning order and dwell on web).
- **Exit:** every fixture renders in all four manifestations. A conformance test proves the same acts reach the same reply events in each. An irreversible act needs a deliberate act in every manifestation.

### L5. Person-shaped (weeks 7–8)
- Persona slice dimensions: density, explanation depth, motion, autonomy (how often to autopick), and preferred input mode.
- Define the capability profile: input, output, perception, motor, communication, reading, and temporary state.
- **Exit:**
  - Five reference personas and five capability profiles are defined.
  - Each changes the plan in a measurable way: fewer acts, larger targets, a voice route.
  - No persona data is persisted or logged.

### L6. Ephemeral lifecycle (weeks 8–9)
- Experience lifecycle: `open → update → resolve → collapse`, with streaming node updates (progress, partial results) and collapse to an artifact summary.
- **Exit:** a streamed experience (progress → recommendation → approval → done) runs end to end in the playground, and leaves only the artifact and a one-line summary.

### L7. Ready for callers (week 10)
- Write the IR documentation site, an SDK (`@feather/client`: build IR, validate, receive reply events), and a reference integration with a mock caller.
- **Exit:**
  - A new caller renders its first experience in under 30 minutes using only the docs.
  - The IR is frozen as `feather.ir/1`.

## 9. Targets

| Target | Measure | Goal |
|---|---|---|
| Interaction cost | acts needed to settle one decision | ≤ 1 for a recommendation, ≤ 2 for an irreversible act |
| One IR, many bodies | fixtures rendering in all 4 manifestations | 100% |
| Determinism | same IR + context → identical plan | 100% of fixtures |
| Accessibility | axe violations; keyboard-only completion; contrast | 0; 100%; WCAG 2.2 AA everywhere, AAA for low vision |
| Speed | compose time; first paint of an experience | < 5 ms; < 100 ms after IR arrives |
| Size | `@feather/liquid` + `manifest-web` gzipped, excluding React | < 60 KB |
| Discipline | hygiene findings on release | 0 |
| Adoption | time for a new caller to first experience | < 30 min |

## 10. Non-goals for now

- No model calls inside Feather. Godpip decides; Feather renders.
- No persona storage, accounts or analytics of people.
- No native mobile manifestation yet (web first, responsive).
- No visual page builder.
- No Godpip or QOOE imports. The IR is the only connection.

## 11. The team for this repo

Building runs on subscriptions. API credits are for evaluation only.

| Work | Model |
|---|---|
| IR schema, composer rules, accessibility rules, final review | Opus (main Claude Code session) |
| Organisms, manifestations, playground, tests | Sonnet subagents |
| Stories, fixtures, hygiene runs, visual diffs | Haiku subagents |
| Second-opinion and attack reviews, bulk fixture writing | Grok 4.7 via `cursor-agent --mode ask` |
| Fast UI iteration | Composer 2.5 in Cursor (own worktree) |
| Research on accessibility patterns and voice UX | ChatGPT Plus Deep Research (paste files) |

Rules: the builder never reviews itself, writes from Cursor go through a worktree and an Opus
review, and every delegated task names its files and its exit test.

## 12. Decisions for the owner

**Decided 2026-10-02:**

1. Repo `aleeforoughi/feather`, private.
2. GitHub Packages. Its npm scope must be the repo owner, so the packages are `@aleeforoughi/feather-*`
   (`@aleeforoughi/feather-tokens`, `@aleeforoughi/feather-react`, …) wherever this plan says `@feather/*`.
   They can be renamed once, at L7, when the IR freezes.
3. `feather-tokens/2` keeps the `qooe-tokens/1` semantic role names; only the schema id changes, and
   `qooe-tokens/1` migrates on read.
4. `qooe-core` switches to the packages at L0.
5. Proprietary (all rights reserved) for now.

The original questions:

1. Repo name and visibility (`aleeforoughi/feather`, private to start?).
2. Package registry: GitHub Packages, npm private, or git dependency.
3. Keep `qooe-tokens/1` names or rename the semantic roles in `feather-tokens/2`.
4. Whether `qooe-core` switches to the package at L0, or after L3.
5. License, if Feather will be open later.

## 13. Connecting Godpip later

- Godpip emits `feather.ir` JSON from its interaction records: a recommendation, alternatives, "decide for me", and authority approvals become `IrreversibleAction`.
- Godpip never sends pixels or component names.
- Feather reply events go back to Godpip as the human's decision.
- The connection starts after Feather L3 and Godpip's interaction work, against the frozen `feather.ir/1`.

## 14. Kickoff prompt for the new session

Paste this into the first message of the new session, inside the new repo:

```text
Read FEATHER_HANDOFF.md. You are building Feather, the first liquid design system, as an
independent repo. Start with milestone L0: set up the pnpm monorepo, import Feather 1.6.0 from
/Users/craxive/Documents/qooe-core/qooe/feather/web into @feather/tokens and @feather/react (keep
history if possible), port the hygiene gate, and get CI green. Follow the principles in section 3
and the team rules in section 11. Ask me the decisions in section 12 before you start.
```
