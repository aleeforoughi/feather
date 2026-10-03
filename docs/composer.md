# The liquid composer (milestone L3)

```text
compose(experience, context) → LayoutPlan
```

`@aleeforoughi/feather-liquid` turns an Experience IR and the context it is rendered in into a **layout plan**: what
renders, in what order, how strongly, with what detail open, how an irreversible act is confirmed, where focus
starts, and which body (manifestation) the experience takes. A manifestation (web, voice, text, switch) renders the
plan; it never re-decides.

The composer is pure and deterministic (principle 9). The same IR and context always give the same plan. It uses
no clock, no randomness and no model call, and it composes an experience in well under a millisecond. It
validates the IR first and refuses an invalid one, returning the validator's issues.

## Context

`@aleeforoughi/feather-context` holds types only. The host passes them per render, and Feather stores none of them
(principle 11). Every field is optional.

| Part | Fields |
|---|---|
| `persona` | `density`, `explanation` (brief, standard, detailed), `motion` (full, reduced), `inputMode`, `source` (explicit or learned) |
| `capability` | `input` (pointer, touch, keyboard, voice, switch), `output` (visual, audio: available or unavailable), `vision` (typical, low), `precision` (typical, low) |
| `device` | `surface` (phone, tablet, desktop, watch, speaker, terminal), `width`, `reducedMotion`, `colorScheme` |
| `brand` | the brand's `density` and `motion` axes |
| `locale` | for formatting; defaults to the experience's locale, then `en` |

`REFERENCE_CONTEXTS` names four contexts for tests, the playground and documentation:

- `phone`;
- `desktop-detailed`;
- `low-vision-low-precision`;
- `screenless`.

## Deciding

Every value in the plan is a **decision**. The rules offer candidates, each at a priority level from principle 8:

1. safety;
2. accessibility;
3. user setting;
4. OS;
5. task;
6. learned preference;
7. aesthetics;
8. default.

The highest level wins, and among equals the first candidate offered wins. The plan's `trace` records each decision:
the winning rule, the value, why, and what it overrode.

```json
{ "rule": "critical-never-hidden", "subject": "node rec.expanded", "value": true,
  "because": "critical detail is never hidden behind expansion",
  "overrode": [{ "rule": "explanation-depth", "value": false, "because": "the person wants brief explanations" }] }
```

A preference the host marks `source: "learned"` ranks below an explicit setting. One deliberate exception: a request
to **reduce** motion counts as an accessibility need whoever makes it, so `motion: "full"` never overrides it.

## The rules

| Rule | Decides |
|---|---|
| `one-primary` (7.1) | `plan.primary`: the node the caller marks, or else the first IrreversibleAction, Approval, Recommendation, Choice, Input or Action. Its emphasis is `primary`. |
| `irreversible-explicit` (7.2) | An irreversible act never gets `plan.focus`. An act that commits by itself (an IrreversibleAction, or an irreversible act with its own consequence) gets `confirm`: `confirm` on screen, `spoken-keyword` by voice, `typed-keyword` in text. An irreversible Choice is never preselected. |
| `recommendation-first` (7.3) | Alternatives follow in the `secondary` region as one AlternativeList. A Choice preselects its predicted option, or the caller's selection. Focus starts on a reversible primary act. |
| `critical-never-hidden` (7.4) | A critical node has emphasis `critical`, and its detail shows open (`expanded: true`), whatever the persona. |
| `density-and-targets` (7.5) | `plan.density` comes from the person, then the brand, then `comfortable`. Low precision gives `spacious` density and 44 px targets. Touch surfaces get 44 px targets; others get the 24 px minimum (`plan.minTarget`). |
| `output-routing` (7.6) | `plan.manifestation`: no visual output gives `voice`, or `text` when there is no audio either. Switch access gives `switch`, a speaker gives `voice`, a terminal gives `text`, and anything else gets `web`. No audio output makes `plan.cues` `text-only`. |
| `explanation-depth` (7.7) | `expanded` on nodes with detail: brief closes it, detailed opens it. |
| `reduced-motion` (7.8) | `plan.motion` is `reduced` when the OS or the person asks, over any brand motion. |
| `text-without-decision` (7.9) | `plan.chrome` is `none` (plain text, no card) for one line of text with no decision. |
| `contrast` (7.10) | `plan.contrast` is `AAA` where vision is low, otherwise `AA`. |
| `structure` | A PredictedChoice merges into its Choice (organism `PredictedChoice`). A Tradeoff attaches to the option it describes, and an Approval's requester to the approval. |
| `defaults` | What the composer assumes when no rule applies, stated in the trace. |

Every rule has tests in `packages/liquid/test/rules.test.ts`. Every valid conformance fixture, composed in every
reference context, is snapshot in `packages/liquid/test/plans/`, so a rule change shows up as a diff.

## The plan

```ts
interface LayoutPlan {
  plan: "feather.plan/0"
  experience: string
  locale: string
  manifestation: "web" | "switch" | "voice" | "text"
  chrome: "card" | "none"
  density: "compact" | "comfortable" | "spacious"
  minTarget: 24 | 44
  motion: "full" | "reduced"
  contrast: "AA" | "AAA"
  cues: "audio-and-text" | "text-only"
  primary: string | null
  focus: string | null
  regions: [{ id: "main"; nodes: PlanNode[] }, { id: "secondary"; nodes: PlanNode[] }]
  trace: TraceEntry[]
}

interface PlanNode {
  id: string                      // the IR id; a group's id starts with "~"
  type: NodeType | "AlternativeGroup"
  organism: Organism              // what renders it
  emphasis: "critical" | "primary" | "default" | "quiet"
  expanded?: boolean              // on nodes with expandable
  confirm?: "confirm" | "spoken-keyword" | "typed-keyword"   // on acts that commit
  preselected?: string            // on a Choice
  attached?: PlanNode[]           // a Tradeoff on its option, the requester on an Approval
  items?: PlanNode[]              // the members of a group
  node?: IRNode                   // the IR node it renders
  merged?: IRNode[]               // the PredictedChoice of a Choice
}
```

## Rendering on the web (`@aleeforoughi/feather-manifest-web`)

The web manifestation renders a plan with Feather's organisms and atoms. It must:

- **Render every region in order:** `main`, then `secondary`. Each plan node renders inside a wrapper with
  `data-feather-node={id}`, `data-organism` and `data-emphasis`. Every IR node type renders: organisms for decision
  nodes, and atoms for content nodes.
- **Apply the plan:**
  - `chrome` `card` wraps the experience in a Card, and `none` renders it bare.
  - `density` sets the theme's spacing for the experience.
  - `minTarget` 44 makes every control at least 44 px.
  - `motion` `reduced` makes every organism move as if the OS asked for reduced motion.
  - `contrast` is exposed as `data-contrast`, a hint until themes can promise AAA (L5).
  - `expanded` opens or closes "Why?" at first render.
  - `confirm` chooses the IrreversibleAction mode.
  - `preselected` preselects the option.
  - `focus` moves focus to that node's first control once, on mount, and never otherwise.
- **Turn every act into a reply:** an organism's `onAct(act, value?)` becomes `{ experience, node, act, value }`.
  It is checked with `validateReply` before `onReply` receives it, and a reply that fails is never emitted.
- **For `voice` and `text` plans, which arrive at L4,** render a plain, accessible summary of the plan: what is
  asked, the consequence of any irreversible act, the acts available. Never render a broken page.
