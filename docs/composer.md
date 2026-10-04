# The liquid composer (milestone L3)

```text
compose(experience, context) → LayoutPlan
```

`@aleeforoughi/feather-liquid` turns an Experience IR and the context it is rendered in into a **layout plan**: what
renders, in what order, how strongly, with what detail open, how an irreversible act is confirmed, where focus
starts, and which body (manifestation) the experience takes. A manifestation (web, voice, text, switch) renders the
plan; it never re-decides.

The composer is pure and deterministic (principle 9). The same IR and context always give the same plan. It uses
no clock, no randomness and no model call. A typical experience composes in well under a millisecond, and one ten
times the largest fixture in under 5 ms. It validates the IR first and refuses an invalid one, returning the
validator's issues. It never throws: an experience it cannot read (a circular object, a BigInt, a throwing getter)
comes back as an `unreadable` issue.

## Context

`@aleeforoughi/feather-context` holds types only. The host passes them per render, and Feather stores none of them
(principle 11). Every field is optional.

| Part | Fields |
|---|---|
| `persona` | `density`, `explanation` (brief, standard, detailed), `motion` (full, reduced), `inputMode`, `learned` (which of those fields the host learned rather than the person set) |
| `capability` | `input` (pointer, touch, keyboard, voice, switch), `output` (visual, audio: available or unavailable), `vision` (typical, low), `precision` (typical, low) |
| `device` | `surface` (phone, tablet, desktop, watch, speaker, terminal), `width`, `reducedMotion`, `colorScheme` |
| `brand` | the brand's `density` and `motion` axes |
| `locale` | a BCP 47 tag, for formatting and the confirm keyword; defaults to the experience's locale, then `en` |

The context comes from the host, so the composer checks it. A field outside its type (`density: "huge"`, a
negative width, a `locale` that is not a language tag, a context that is not an object) is dropped, and the trace
records it under `defaults` with the subject `context.<field>`. Unknown fields are ignored.

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

Each trace entry also carries the `level` it won at. A persona field listed in `learned` decides at the `learned`
level, below an explicit setting; the others decide as user settings. This is decided field by field, so a learned
density does not weaken an explicit explanation depth. One deliberate exception: a request to **reduce** motion
counts as an accessibility need whoever makes it, so `motion: "full"` never overrides it.

**What counts as irreversible.** An act is irreversible when it is an IrreversibleAction, is marked
`reversible: false`, or states a `consequence`: an effect worth stating cannot be undone, and the validator refuses
`reversible: true` beside a consequence. Importance includes the IR's defaults: an IrreversibleAction is `critical`
and a Warning `high` unless they say otherwise.

## The rules

| Rule | Decides |
|---|---|
| `one-primary` (7.1) | `plan.primary`: the node the caller marks, or else the first IrreversibleAction, Approval, Recommendation, Choice, Form, Input or Action. Its emphasis is `primary`. |
| `irreversible-explicit` (7.2) | An irreversible act never gets `plan.focus`. Whatever commits the effect gets `confirm`, once: an IrreversibleAction, or an irreversible act that no IrreversibleAction confirms (by its `confirms`, or implied when there is only one). The mode is `confirm` on screen, `spoken-keyword` by voice and `typed-keyword` in text, and the keyword modes carry `keyword` in the plan's language (English when Feather has none for it). An irreversible Choice is never preselected, and its prediction shows beside it as a `PredictionNote`. |
| `recommendation-first` (7.3) | Alternatives follow in the `secondary` region, one AlternativeList per node they are alternatives to (`~alternatives:<for>`, or `~alternatives` when they name none). A reversible Choice preselects its predicted option, or the caller's selection. Focus starts on a reversible primary act. |
| `critical-never-hidden` (7.4) | A critical node (with the IR's defaults) has emphasis `critical`, and its detail shows open (`expanded: true`), whatever the persona. |
| `density-and-targets` (7.5) | `plan.density` comes from the person, then the brand, then `comfortable`. Low precision gives `spacious` density and 44 px targets. Touch surfaces get 44 px targets; others get the 24 px minimum (`plan.minTarget`). |
| `output-routing` (7.6) | `plan.manifestation` follows output first: no visual output or a speaker gives `voice` (`text` when there is no audio either), and a terminal gives `text`. Switch access, needed or preferred, gives `switch` only where there is a screen. Anything else gets `web`. An input preference never removes a screen, so `inputMode: "voice"` keeps `web`. No audio output makes `plan.cues` `text-only`, and an audio or video Media gets `textEquivalent: true`. |
| `explanation-depth` (7.7) | `expanded` on nodes with detail: brief closes it, detailed opens it. |
| `reduced-motion` (7.8) | `plan.motion` is `reduced` when the OS or the person asks, over any brand motion. |
| `text-without-decision` (7.9) | `plan.chrome` is `none` (plain text, no card) for a single Text, Confirmation or Status with no expandable detail, at most 120 code points and one line. |
| `contrast` (7.10) | `plan.contrast` is `AAA` where vision is low, otherwise `AA`. |
| `importance` | High importance gives emphasis `high`, low gives `quiet`. A group of alternatives stands out as much as its strongest member. |
| `structure` | A PredictedChoice merges into its reversible Choice (organism `PredictedChoice`), composed as a plan node. A Tradeoff attaches to the option it describes, and the requester attaches to every Approval it asks for. |
| `defaults` | What the composer assumes when no rule applies, stated in the trace. |

Every rule has tests in `packages/liquid/test/rules.test.ts`. Every valid conformance fixture, composed in every
reference context, is snapshot in `packages/liquid/test/plans/`, so a rule change shows up as a diff.
`packages/liquid/test/invariants.test.ts` checks what must hold whatever the rules decide, for every fixture in the
reference contexts and 60 generated ones:

- every IR node appears once in `order`;
- focus never lands on an irreversible act;
- critical detail is always open;
- every IrreversibleAction confirms in its body's own way;
- no plan takes a body its output cannot carry.

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
  order: string[]                 // every IR node id once: reading, speaking and scanning order
  regions: [{ id: "main"; nodes: PlanNode[] }, { id: "secondary"; nodes: PlanNode[] }]
  trace: TraceEntry[]             // { rule, level, subject, value, because, overrode? }
}

interface PlanNode {
  id: string                      // the IR id; a group's id starts with "~"
  type: NodeType | "AlternativeGroup"
  organism: Organism              // what renders it
  emphasis: "critical" | "primary" | "high" | "default" | "quiet"
  expanded?: boolean              // on nodes with expandable
  confirm?: "confirm" | "spoken-keyword" | "typed-keyword"   // on whatever commits an irreversible effect
  keyword?: string                // the word to say or type, with the keyword modes
  textEquivalent?: true           // audio or video with no audio output: render its text equivalent
  preselected?: string            // on a Choice
  attached?: PlanNode[]           // a Tradeoff on its option, the requester on an Approval, a PredictionNote
  items?: PlanNode[]              // the members of a group
  node?: IRNode                   // the IR node it renders
  merged?: PlanNode[]             // the PredictedChoice of a reversible Choice
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
  - `confirm` chooses the confirm mode of whatever commits. An Approval or Recommendation with `confirm` arms
    first, like an IrreversibleAction. An act with no `confirm` never commits by itself.
  - `textEquivalent` renders the Media's transcript in place of the player.
  - A `PredictionNote` shows the prediction beside the Choice as text, and never preselects.
  - `preselected` preselects the option.
  - `focus` moves focus to that node's first control once, on mount, and never otherwise. Organisms themselves
    never move focus on render.
- **Turn every act into a reply:** an organism's `onAct(act, value?)` becomes `{ experience, node, act, value }`.
  It is checked with `validateReply` before `onReply` receives it, and a reply that fails is never emitted.
- **For `voice` and `text` plans,** which have their own bodies (`manifest-voice`, `manifest-text`; see
  [`manifestations.md`](manifestations.md)), the web renders a plain, accessible summary of the plan: what is
  asked, the consequence of any irreversible act, the acts available. Never a broken page.
