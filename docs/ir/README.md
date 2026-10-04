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

There are 25 node types in two families:

- **Content:** `Text`, `Action`, `Choice`, `Input`, `Form`, `Price`, `Person`, `Date`, `Location`, `Status`, `Progress`,
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
`label` is optional, Feather uses the `intent`. Text fields hold at most 4,000 characters unless the
reference gives a lower limit. Length is counted in Unicode code points, not UTF-16 units, so a simple emoji
counts as one.

References point at other nodes by id, and each points at the kinds of node it means. An Alternative is `for`
a Recommendation, Choice, Action, Approval or IrreversibleAction, and comes after it. A PredictedChoice is `of`
a Choice. A Comparison's `items` are the options compared, each listed once. A Correction's `target` is
whatever was misunderstood. The [node reference](nodes.md) lists the allowed kinds for each field.

**Dates** are ISO 8601. A date-time with `Z` or an offset names an instant; one without names a wall-clock
time. Feather never compares the two kinds, because the answer would depend on where it runs.

**`primary`** marks the main act and gets the emphasis. Where focus starts is the composer's decision
(`docs/composer.md`). Focus can start on a reversible primary act, but never on an irreversible one (composer rule
2).

## Acts and replies

When the person acts, Feather sends a reply to the caller:

```json
{ "experience": "approve_campaign", "node": "go", "act": "confirm" }
{ "experience": "approve_campaign", "node": "own", "act": "choose", "value": 800 }
```

Each node type takes a fixed set of acts. For example, `IrreversibleAction` takes `confirm` or `cancel`,
`Choice` takes `choose`, and `Approval` takes `approve` or `reject`. The [node reference](nodes.md) lists them
all. Every manifestation must produce the same reply for the same act, whether the person clicked, spoke,
scanned with a switch or typed a number, so each value has one encoding:

| Act | Value |
|---|---|
| `choose` on a Choice | the option id; an array of distinct ids when `multiple` |
| `change` on a PredictedChoice | another option id (the predicted one is `accept`) |
| `submit` on an Input | a string for the text kinds (respecting `maxLength`, and a valid email, phone or URL for those kinds); a number for `number`, and for `money` in the Input's `currency`, within `min` and `max`; an ISO 8601 string for `date` |
| `skip` on an Input | none; only when the Input is not `required` |
| `submit` on a Form | an object from field id to answer, each encoded as an Input of the field's kind; a field left out was not answered, every `required` field is present, and at least one is |
| `skip` on a Form | none; only when no field is `required` |
| `choose` on an Alternative with `input` | `{ "amount", "currency" }` for Price, an ISO 8601 string for Date, words for Text, Location and Person |
| `set` on a Preference | a string, number or boolean, one of its `options` when it has them |
| `reject` on an Approval, `submit` on a Correction, `expand` on an ExploreMore | a string (for `expand`, one of its `topics` when it has them) |

An irreversible Recommendation that states no consequence of its own is committed by its IrreversibleAction:
`accept` on the recommendation only moves on to that confirmation, and never commits by itself. An Autopick's
`undoWithin` is enforced by the caller, which owns time.

`validateReply(experience, reply)` validates the experience first, then checks the reply's node, act and value,
and rejects fields other than `experience`, `node`, `act` and `value`.

## The rules

The validator checks structure, and these rules across nodes:

1. **One primary act.** At most one node has `"primary": true`. Only Action, Choice, Input, Form,
   Approval, Recommendation and IrreversibleAction can be primary. `"primary": false` is allowed anywhere and means
   nothing.
2. **Irreversible means explicit.** An `IrreversibleAction` must state its `consequence` (`spend`, `publish`,
   `send`, `consent`, `delete` or a `statement`), so Feather can show it verbatim and ask for a deliberate act.
   Its importance is `high` or `critical`. An act that states a consequence is irreversible by definition, so
   `reversible: true` next to a consequence is an error. Any other act marked `reversible: false` either states a consequence
   of its own (Approval and Recommendation take one) or is confirmed by an IrreversibleAction. The
   IrreversibleAction names that act in `confirms`; when the experience has exactly one IrreversibleAction, it
   confirms implicitly.
3. **Every medium has a text equivalent.** An image or video has `alt`, audio has a `transcript`, and video
   also has `captions` or a `transcript`.
4. **References resolve** to a node of a kind the field allows, never to the node itself. An Alternative comes
   after what it is an alternative to. With several Recommendations, every Alternative says which one it is
   `for`.
5. **Preselection is decided once.** A Choice has at most one PredictedChoice, and it agrees with the Choice's
   `selected` when there is one.
6. **No presentation.** Fields such as `color`, `style`, `component`, `size` or `position` are rejected with a
   pointer to principle 1. Unknown fields are rejected too, with a suggestion when they look like a typo.

Some rules belong to the composer and are documented here so callers can rely on them. For example, a
`critical` node is never hidden behind expansion: if it has `expandable` detail, Feather shows that detail
(composer rule 4).

The structure is also published as a JSON Schema, `@aleeforoughi/feather-intent/schema/feather.ir-0.json`,
for editors and for callers in other languages. The schema checks the shape of every node. It cannot check
rules that span several nodes or fields, so these codes come only from `validate()`: `duplicate-id`,
`dangling-reference`, `self-reference`, `wrong-reference-type`, `out-of-order`, `ambiguous-alternative`,
`unneeded-confirmation`, `multiple-primary`, `irreversible-without-consequence` (for acts other than an
IrreversibleAction), `missing-text-equivalent`, `duplicate-option`, `unknown-option`, `too-many-selected`,
`conflicting-prediction`, `duplicate-step`, `duplicate-field`, `empty-tradeoff`, `comparison-mismatch`, `out-of-range` (a date
range or `min` above `max`), `invalid-date` (a well-formed but impossible date, such as February 30),
and `too-many-issues`.

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
says what to change. `validate()` never throws, and reports at most 100 issues; past that, a last issue,
`too-many-issues`, says to fix those first.

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
| `too-few-items`, `duplicate-item`, `empty-experience`, `empty-expandable`, `empty-consequence`, `empty-tradeoff` | Not enough content to mean anything, or the same thing twice. |
| `multiple-primary`, `not-primary-capable` | Rule 1. |
| `irreversible-without-consequence`, `irreversible-marked-reversible`, `unneeded-confirmation` | Rule 2. |
| `unreadable` | The document could not be read as JSON data at all (a value JSON cannot hold, a circular reference). |
| `missing-text-equivalent` | Rule 3. |
| `dangling-reference`, `self-reference`, `wrong-reference-type`, `out-of-order`, `ambiguous-alternative` | Rule 4. |
| `conflicting-prediction` | Rule 5. |
| `duplicate-option`, `unknown-option`, `too-many-selected`, `duplicate-step`, `duplicate-field`, `comparison-mismatch` | Rules of single node types. |
| `too-many-issues` | More than 100 problems; the rest are not listed. |

## Fixtures

`conformance/ir/valid` holds at least 40 realistic experiences, covering every node type.
`conformance/ir/invalid` holds documents with one deliberate mistake each, made from a valid fixture, and lists
exactly the issues the validator must report. The fixtures are the contract's examples, and later milestones compose and render them
in every manifestation.

## Versioning

`feather.ir/0` is the working version. It may still change, and every change is recorded in `CHANGELOG.md`. At
milestone L7 it freezes as `feather.ir/1`. From then on a version never changes, and a new one is added beside
it. A Feather reads the versions it names and rejects others with `unsupported-version`, never by guessing.
