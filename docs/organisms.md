# Decision organisms (milestone L2)

An organism renders one Experience IR node (see [`ir/nodes.md`](ir/nodes.md)) as a complete, accessible
interaction. The composer (L3) will map nodes to organisms. Products may also use organisms directly.

This page is the contract every organism follows. Stories, tests and review check each organism against it.

## Rules for every organism

**Shape**

- File `packages/react/src/components/ui/<name>.tsx`, with stories in `<name>.stories.tsx`
  (`title: "Organisms/<Name>"`). Pure helpers go next to it, tested in `<name>.test.ts`. It is exported from
  `packages/react/src/index.ts`.
- **Props mirror the IR node.** Fields keep the node's names and meanings (`intent`, `importance`,
  `expandable: { why?, detail? }`, `summary`, `consequence`…), so the composer passes a node through with no
  translation. Content props are strings or React nodes. A prop never names a color, size or position.
- **One callback, `onAct(act, value?)`.** It uses exactly the node's reply acts and value encodings
  (`docs/ir/README.md`, "Acts and replies"), so a reply event is `{ experience, node: id, act, value }` with
  nothing changed. TypeScript narrows `act` to the node's acts. An organism holds only interaction state
  (open, armed, typing); the caller owns everything else.
- **No imports from `@aleeforoughi/feather-intent`.** `@aleeforoughi/feather-react` depends only on tokens.
  Mirror the IR's names by convention.
- **Built on Feather.** Use the existing atoms and molecules (Card, Button, Badge, RadioGroup, Field,
  Textarea, Input, Accordion, RoleAvatar/RoleChip, AttentionCard, StepList, BudgetBar) and semantic tokens only.
  No raw colors.
- **Every visible part has a `data-slot`, and every state a `data-variant`.** This lets brands restyle
  `"recommendation"`, `"irreversible-action.armed"` and so on without code. Slot names start with the
  organism's file name and are unique across Feather (hygiene enforces it).
- **Motion comes from `useThemeMotion()`** and honors reduced motion. Nothing an organism communicates depends
  on animation.

**Importance and detail**

- `importance` is set on the root as `data-importance`.
- `critical` is never hidden behind expansion: `expandable` content of a critical node shows open, with no
  control to close it (composer rule 4).
- `expandable` otherwise sits behind a "Why?" disclosure, closed by default. It is a real button with
  `aria-expanded` and `aria-controls`, and the shared `WhyDisclosure` renders it. "Expand on Why?, collapse on
  Continue": acting on the organism (accept, choose, confirm) closes it.

**Irreversible acts**

- A `consequence` always shows **verbatim** before the act, through the shared `ConsequenceStatement`:
  - spend: "Spends AED 1,050";
  - publish: "Publishes to {audience}";
  - send: "Sends to {to}" (with "by {channel}" when given);
  - consent: "Gives {to} access to {scope}";
  - delete: "Deletes {what}";
  - statement: as written.

  Format money with `Intl.NumberFormat` in the organism's `locale` (default: the document's `lang`, else
  `en`).
- Irreversible acts never take the default focus and never auto-submit. Where focus starts is the composer's
  decision (`plan.focus`), applied once on mount by the manifestation; an organism never moves focus on render.
- **An irreversible act happens once.** After `confirm` (or an Approval's `approve` or `reject`), the organism
  enters a `done` state (`data-variant="done"`): it shows the outcome ("Confirmed: spends AED 1,050"), and offers
  no control that could act again. The caller collapses the experience. Focus moves to the outcome text
  (`tabIndex={-1}`), so keyboard and screen-reader users land on what happened.

**Accessibility (the gate)**

- **axe reports 0 violations in both reference themes.** Never add an organism to
  `apps/storybook/.storybook/a11y-known.json`.
- **Everything works by keyboard alone:** Tab and Shift+Tab reach every control in reading order, Enter or
  Space acts, Escape backs out of armed or open states, and focus is always visible. Focus never jumps on
  render. After an act that removes a control, focus moves to the next sensible control.
- **Every control has an accessible name** that says the act ("Accept recommendation: 7-day test", not "OK").
  State changes a sighted user would notice are announced through a polite live region, such as "Armed: press
  again to spend AED 1,050".
- **Meaning never depends on color alone.** Gains and costs carry words or icons with text alternatives. The
  danger state carries text ("Cannot be undone"). The destructive color fails AA contrast for text in both
  reference themes, so it is used for borders and icons only, never for text.
- Target size is at least 24×24 px (WCAG 2.2 AA), and density follows the theme's tokens.

**Stories**

Each organism has stories covering its main states:

- default;
- with expandable;
- critical importance, where relevant;
- the states that matter for it (armed, rejected-with-reason, with input…);
- a long-text story, to check wrapping.

Each organism also has at least one story with a `play` function that completes its main act **by keyboard
only** (`userEvent.keyboard`/`tab`) and asserts the `onAct` call (`fn()` from `storybook/test`). Stories render
in both reference themes in Storybook, the axe suite and the visual suite.

## The organisms

### `ConsequenceStatement` and `WhyDisclosure` (shared, in `consequence-statement.tsx` and `why-disclosure.tsx`)

- `ConsequenceStatement({ consequence, locale? })` renders each entry of a consequence as a sentence, as above.
  The text is plain and selectable, and it is the accessible description of the act it belongs to (via
  `aria-describedby` on that act).
- `WhyDisclosure({ expandable, open?, onOpenChange?, forceOpen? })` is the "Why?" control. With `forceOpen`
  (critical) it renders the detail with no control.
- Both export pure helpers (`consequenceSentences(consequence, locale)`), tested.

### `Recommendation` (IR node: Recommendation)

- Props: `intent`, `summary`, `label?`, `confidence?` (0–1), `consequence?`, `arm?`, `reversible?`, `importance?`,
  `expandable?`, `primary?`, `locale?`, `onAct(act: "accept")`.
- It shows the summary. Confidence shows as text ("Confidence: medium (78%)"), never as a bare number or color.
  Labels: below 0.5 "low", below 0.8 "medium", otherwise "high".
- One button, labelled by `label` or the intent, performs `accept`.
- A `consequence`, when given, shows verbatim.
- **`arm?: boolean`: whether accepting arms first (two deliberate acts). Default: when it states a consequence.**
  A consequence makes the act irreversible, so a Recommendation that commits by itself never commits on one
  click. A layout plan passes its `confirm`; a Recommendation that an IrreversibleAction commits does not arm
  (that IrreversibleAction confirms it, so nobody confirms one effect twice). With `arm` true, accept follows the
  IrreversibleAction confirm pattern:
  1. The first button ("Book the venue…") arms: `data-variant="armed"` on the root, announced politely
     ("Armed: press again to book the venue").
  2. "Yes, book the venue" appears next to "Cancel", focus moves to it, and only it calls `onAct("accept")`.
     Escape or Cancel disarms and returns focus to the first button (it calls nothing).
  3. Armed never times out. The consequence stays visible and described by the act.
  4. After accepting it is `done` (`data-variant="done"`): the outcome ("Confirmed: spends AED 1,050"), no
     control that could act again, and focus on the outcome text.
- Without a consequence, the button's description says what happens next: for an irreversible recommendation, "Next,
  you confirm. Nothing is done until you do." (it never commits on accept); otherwise, "Accepting applies it.
  You can undo it."

### `IrreversibleAction` (IR node: IrreversibleAction)

- Props: `intent`, `label?`, `consequence` (required), `importance?` ("high" | "critical", default
  "critical"), `expandable?`, `locale?`, `mode?: "confirm" | "hold"` (default "confirm"), `holdMs?` (default
  1500), `onAct(act: "confirm" | "cancel")`.
- The consequence is always visible before any act.
- **Confirm mode (default): two deliberate steps.**
  1. The first button ("Spend AED 1,050…", from the label or intent plus the consequence) **arms**:
     `data-variant="armed"`, announced politely.
  2. A second button, "Yes, spend AED 1,050", sits next to "Cancel". Focus moves to it, and only it performs
     `confirm`. Escape or Cancel disarms, returns focus to the first button and calls `onAct("cancel")`.
  3. Armed state never times out silently.
- **Hold mode.** One button that must be held, by pointer or with Space or Enter held down, for 1.5 s. Progress
  shows as a fill and is announced at its start and end. Releasing early does nothing. With reduced motion the
  fill steps, but the hold is still required.
- It is never the default focus, and it never confirms on render or on a single click.

### `Approval` (IR node: Approval), built on `AttentionCard`

- Props: `intent`, `request`, `requester?` (`{ name, role?, kind? }`, shown with `RoleChip`), `scope?`,
  `consequence?`, `arm?`, `reversible?`, `importance?`, `expandable?`, `onAct(act: "approve" | "reject", reason?)`.
- Approve performs `approve`. **`arm?: boolean` says whether approving arms first (two deliberate acts).
  Default: when it states a consequence** (which makes it irreversible), and then approve follows the
  IrreversibleAction confirm pattern, arming first. A layout plan passes its `confirm`. An Approval that an
  IrreversibleAction commits does not arm (`arm={false}`): that IrreversibleAction carries the confirmation, so a
  person never confirms one effect twice. The consequence and "Cannot be undone" still show.
- Reject opens an optional reason field (Textarea with a label) with "Send rejection" and "Back". Sending calls
  `onAct("reject", reason || undefined)`. Escape backs out.

### `Tradeoff` (IR node: Tradeoff)

- Props: `summary?`, `gains?: string[]`, `costs?: string[]`, `importance?`.
- Two lists titled "Gains" and "Costs" (words, not only icons). Each item has an icon whose text alternative is
  "Gain:" or "Cost:" for screen readers.
- It takes no acts.

### `AlternativeList` (IR nodes: Alternative, with their Tradeoffs)

- Props: `alternatives: Array<{ id, intent, label?, input?: "Price" | "Date" | "Text" | "Location" | "Person",
  tradeoff?: { gains?, costs?, summary? }, currency? }>`, `onAct(id, act: "choose", value?)`.
- The alternatives show in order, each as a button labelled by its label or intent. Its tradeoff, if any, sits
  under it through `Tradeoff`.
- **An alternative with an `input`** opens an inline labelled field when chosen, before calling `onAct`:
  - Price: a number field plus a currency, giving `{ amount, currency }`;
  - Date: a date field, giving an ISO string;
  - Text, Location, Person: a text field, giving a string.

  "Use this" submits, and it is disabled until the value is valid. Escape cancels.
- When chosen, the alternative reflects `data-variant="chosen"`.

### `PredictedChoice` (IR nodes: Choice with its PredictedChoice)

- Props: `intent`, `prompt`, `options: Array<{ id, label, description? }>`, `predicted: { option, summary?,
  confidence? }`, `onAct(act: "accept" | "change", option?)`.
- A RadioGroup with the predicted option preselected and marked "Likely" with the summary. The mark is text,
  not color only.
- "Keep {label}" performs `accept`. Picking another option and then "Use {label}" performs `change` with that
  option id. Picking the predicted option again shows "Keep" again. The radios work with arrow keys (RadioGroup
  does).

### `ExploreMore` (IR node: ExploreMore)

- Props: `intent`, `label?`, `topics?: string[]`, `onAct(act: "expand", topic?)`.
- With no topics, one button performs `expand`.
- With topics, a "More about…" button opens a short list of topic buttons. Each calls `onAct("expand",
  topic)`. Escape closes it and returns focus. Use the existing Popover or DropdownMenu, whichever keeps focus
  handling correct.

### `CorrectionInput` (IR node: Correction)

- Props: `intent`, `prompt`, `original?`, `onAct(act: "submit", value: string)`.
- It shows "Understood as: {original}" when given, and a labelled text field (the prompt is its label)
  prefilled empty.
- Submit is disabled while the field is blank or whitespace. Enter in the field submits. After submitting, the
  field clears and focus stays in it.

### `FormGroup` (IR node: Form)

- Props: `id?`, `intent`, `prompt?`, `fields`, `submitLabel?`, `importance?`, `expandable?`, `primary?`, `defaultExpanded?`,
  `onAct(act: "submit" | "skip", value?)`. `onAct` may return `{ ok: false, message }` when the caller refuses the reply;
  the form then stays open and says so.
- One real `<form>` (`noValidate`) with one submit button (the label, else the intent) and, only when no field is
  required, a secondary "Skip". Enter in a single-line field submits.
- Submit checks every field the way the IR checks an Input's answer (text trimmed, numbers parsed, dates ISO 8601, an
  empty optional field left out), shows each problem beside its field (`aria-invalid`, `aria-describedby`, the words),
  moves focus to the first invalid field, and calls `onAct` only when every answer is valid and at least one is given.
- After a successful act the root is `data-variant="sent"` (or `skipped`): values stay visible and read-only, the buttons
  go, and a polite status ("Sent. 2 answers were sent.") takes focus. The caller renders a new node to start over.
- Slots: `form-group` (root), `form-group-prompt`, `form-group-section` and `form-group-section-heading`,
  `form-group-field` (with `data-field-id`), `form-group-control`, `form-group-error`, `form-group-submit`,
  `form-group-skip`, `form-group-status`; fields with no group sit in `form-group-ungrouped`.
