# The Experience IR (`feather.ir/0`)

The Experience IR is the one contract between Feather and the systems that use it. A caller says what must
happen, how much it matters and whether it can be undone. Feather decides how that becomes an interface, for
this person, on this device: a card with one button, a spoken question, three switch targets or three lines
of text.

> **Semantics in, the right experience out.** A caller never names a component, a color or a position.

Every node type, with its fields and replies, is in the [node reference](nodes.md). This page explains how the
pieces fit, and what the validator checks.

## An experience

```json
{
  "ir": "feather.ir/0",
  "experience": "approve_campaign",
  "locale": "en",
  "nodes": [
    { "type": "Recommendation", "id": "rec", "intent": "launch the recommended test",
      "importance": "high", "reversible": false,
      "summary": "Recommended test: 7 days, purchase objective",
      "expandable": { "why": "Enough to test three creative directions without overspending." } },
    { "type": "Price", "id": "cap", "amount": 1050, "currency": "AED", "label": "Maximum spend" },
    { "type": "IrreversibleAction", "id": "go", "intent": "confirm spend", "importance": "critical",
      "consequence": { "spend": { "amount": 1050, "currency": "AED" } } },
    { "type": "Alternative", "id": "less", "intent": "spend less" },
    { "type": "Alternative", "id": "own", "intent": "set my own budget", "input": "Price" }
  ]
}
```

- `ir`: the IR version. This Feather reads exactly `feather.ir/0`.
- `experience`: names the interaction. Replies carry the name back.
- `locale`: optional. The BCP 47 language of the words in it.
- `nodes`: the interaction, in order of meaning. Order is meaning, not layout: a Recommendation comes before its
  Alternatives.

## Nodes

There are 24 node types in two families:

- **Content:** `Text`, `Action`, `Choice`, `Input`, `Price`, `Person`, `Date`, `Location`, `Status`, `Progress`,
  `Media`, `Confirmation`, `Warning`, `Approval`.
- **Decision:** `Recommendation`, `PredictedChoice`, `Alternative`, `Tradeoff`, `Autopick`, `Correction`,
  `Preference`, `Comparison`, `IrreversibleAction`, `ExploreMore`.

Every node carries:

| Field | Meaning |
|---|---|
| `id` | Stable within the experience. Replies and references use it. |
| `intent` | What the human is doing here, in a few words. Required on **act** nodes, the ones a person acts on. |
| `importance` | `low`, `normal` (default), `high` or `critical`. Feather never hides a `critical` node behind "Why?". |
| `reversible` | Whether the effect can be undone. Defaults to `true`; an `IrreversibleAction` is always `false`. |
| `expandable` | Detail on demand: `why` and/or `detail`, behind "Why?". |

Words the person sees (`label`, `summary`, `prompt`, `text`) are content, so the caller writes them. Where
`label` is optional, Feather uses the `intent`.

References point at other nodes by id: an Alternative `for` a Recommendation, a PredictedChoice `of` a Choice,
a Comparison's `items`, a Correction's `target`. They must resolve inside the same experience.

## Acts and replies

When the person acts, Feather sends a reply to the caller:

```json
{ "experience": "approve_campaign", "node": "go", "act": "confirm" }
{ "experience": "approve_campaign", "node": "own", "act": "choose", "value": 800 }
```

Each node type takes a fixed set of acts. For example, `IrreversibleAction` takes `confirm` or `cancel`,
`Choice` takes `choose` with the option id (an array when `multiple`), and `Approval` takes `approve` or
`reject`. The [node reference](nodes.md) lists them all. Every manifestation must produce the same reply for
the same act, whether the person clicked, spoke, scanned with a switch or typed a number. `validateReply`
checks a reply against its experience.

## The rules

The validator checks structure, and these rules across nodes:

1. **One primary act.** At most one node has `"primary": true`. Only Action, Choice, Input, Approval,
   Recommendation and IrreversibleAction can be primary.
2. **Irreversible means explicit.** An `IrreversibleAction` must state its `consequence`: `spend`, `publish`,
   `send`, `consent`, `delete` or a `statement`, so Feather can show it verbatim and ask for a deliberate act. Any
   other act marked `reversible: false` needs a consequence of its own (Approval and Recommendation take one) or
   an `IrreversibleAction` in the same experience.
3. **Every medium has a text equivalent.** An image or video has `alt`, audio has a `transcript`, and video
   also has `captions` or a `transcript`.
4. **References resolve** to a node of the right type, never to the node itself.
5. **No presentation.** Fields such as `color`, `style`, `component`, `size` or `position` are rejected with a
   pointer to principle 1. Unknown fields are rejected too, with a suggestion when they look like a typo.

The structure is also published as a JSON Schema, `@aleeforoughi/feather-intent/schema/feather.ir-0.json`,
for editors and for callers in other languages. The schema covers structure only. Rules 1–4 need
`validate()`.

## Validating

```ts
import { validate, formatIssues, validateReply } from "@aleeforoughi/feather-intent"

const result = validate(json)
if (!result.ok) console.error(formatIssues(result.issues))
else render(result.experience)          // typed as Experience
```

From a shell:

```bash
npx feather-ir validate experience.json
```

Every issue has a stable `code`, a JSON Pointer `path`, the `node` id when there is one, and a `message` that
says what to change:

```text
- /nodes/2/consequence: IrreversibleAction "go" cannot be undone, so it must state its consequence exactly (spend, publish, send, consent, delete or a statement). Principle 6: irreversible means explicit. [irreversible-without-consequence]
- /nodes/3/color: "color" describes presentation; Alternative "less" carries meaning only, and Feather decides how it looks (principle 1: semantics, not pixels). [presentational-field]
```

| Code | Meaning |
|---|---|
| `not-an-object`, `wrong-type`, `missing-field`, `empty-text`, `too-long` | The shape of a value. |
| `unsupported-version` | `ir` is not `feather.ir/0`. |
| `unknown-node-type`, `unknown-field` | Not part of the IR (with a suggestion for likely typos). |
| `presentational-field` | Presentation, not meaning. |
| `invalid-id`, `duplicate-id` | Ids start with a letter and are unique. |
| `invalid-value`, `out-of-range`, `invalid-currency`, `invalid-date` | A value outside what the field accepts. |
| `too-few-items`, `empty-experience`, `empty-expandable`, `empty-consequence`, `empty-tradeoff` | Not enough content to mean anything. |
| `dangling-reference`, `self-reference`, `wrong-reference-type` | References that do not resolve. |
| `multiple-primary`, `not-primary-capable` | Rule 1. |
| `irreversible-without-consequence`, `irreversible-marked-reversible` | Rule 2. |
| `missing-text-equivalent` | Rule 3. |
| `duplicate-option`, `unknown-option`, `too-many-selected`, `duplicate-step`, `comparison-mismatch` | Rules of single node types. |

## Fixtures

`conformance/ir/valid` holds at least 40 realistic experiences, covering every node type.
`conformance/ir/invalid` holds documents with one deliberate mistake each, and lists exactly the issues the
validator must report. The fixtures are the contract's examples, and later milestones compose and render them
in every manifestation.

## Versioning

`feather.ir/0` is the working version. It may still change, and every change is recorded in `CHANGELOG.md`. At
milestone L7 it freezes as `feather.ir/1`. From then on a version never changes, and a new one is added beside
it. A Feather reads the versions it names and rejects others with `unsupported-version`, never by guessing.
