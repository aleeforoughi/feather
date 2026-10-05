# Manifestations (milestone L4)

A **manifestation** is the body an experience takes: `web`, `switch`, `voice` or `text`. The composer chooses it
(`plan.manifestation`, rule 6). A manifestation renders the plan and turns what the person does into reply events.
It never re-decides anything the plan decides.

The core of L4 is one sentence from the plan (principle 2): **the action is permanent; its manifestation is not.**
The same act must reach the same reply event in every body, and an irreversible act must take a deliberate act in
every body.

```text
@aleeforoughi/feather-dialog         turn-based interaction over a plan: no DOM, no I/O   → intent, liquid
@aleeforoughi/feather-manifest-text  plain text and the terminal (feather-text CLI)        → dialog
@aleeforoughi/feather-manifest-voice prompts, confirmations and readback for any speech    → dialog
@aleeforoughi/feather-manifest-switch scanning and dwell on the web                        → manifest-web
```

`feather-dialog` was not in the plan's package list. Text and voice are the same interaction, a conversation in
turns, and two copies of it would drift. So both are thin bodies over one engine (decision recorded in
docs/PLAN.md section 12).

## 1. The dialog engine (`@aleeforoughi/feather-dialog`)

Pure and deterministic, like the composer. It has no clock, no randomness, no model call, no I/O and no DOM. The
same plan and the same inputs always give the same turns and the same replies.

```ts
function createDialog(plan: LayoutPlan, options?: DialogOptions): Dialog

interface DialogOptions {
  /** The experience the plan came from; replies are checked against it. Default: rebuilt from the plan's nodes. */
  experience?: Experience
  /** Read a value back and ask "is that right?" before it goes out (voice turns this on). Default false. */
  readback?: boolean
}

interface Dialog {
  /** What the body presents now. */
  readonly turn: Turn
  /** True once nothing is left to act on. */
  readonly done: boolean
  /** The person's input, typed or transcribed. Returns the next turn and every reply that went out. Never throws. */
  answer(input: string): Outcome
}

interface Outcome { turn: Turn; replies: ReplyEvent[] }

interface Turn {
  state: "browse" | "value" | "confirm" | "readback" | "review" | "done"
  /** What to present, in order. A body renders each part its own way. */
  parts: Part[]
  /** What the person can do now, numbered from 1. */
  choices: Choice[]
}

interface Part {
  kind: "content" | "consequence" | "question" | "hint" | "problem" | "outcome"
  text: string
  /** The plan node it belongs to, if any. */
  node?: string
  /** The Form field it asks about or reports, if any. */
  field?: string
  emphasis?: Emphasis
}

interface Choice {
  n: number
  /** What the person picks it by, in words: "Approve the budget", "Small". */
  label: string
  /** Words that pick it besides its number and label, case-insensitive: the act ("approve"), the option id. */
  words: string[]
  node?: string
  act?: string
}
```

### Turns

- **browse.** The experience in `plan.order`. Every node's content comes first, as `content` parts, with the
  consequence of each irreversible act as `consequence` parts, verbatim. Then come the choices: one per available
  act, numbered in plan order. The **available acts** are what the plan offers, the same on every body:
  - each node's `actsFor`;
  - except a Choice that merges a prediction, which offers the prediction's `accept` and `change`, not its own
    `choose`;
  - and a `PredictionNote`, which offers nothing. The primary act is listed first, and the others keep their order. An
  IrreversibleAction's `cancel` is not listed; it is reached by backing out of its confirm turn (see below), as
  on the web.
  - **Collapsed nodes** (`collapsed: true`, secondary only): their content is not read and their acts are not
    listed. In their place browse offers one choice, `Other options`, after every other act. Picking it emits
    nothing; it opens them, and browse is shown again with their content and acts in plan order, as if they were
    never collapsed. They stay open for the rest of the experience.
- **value.** An act that needs a value asks for it with one `question` part, and options as choices when they
  exist:
  - Choice: its options. A `multiple` Choice takes several numbers or labels separated by commas.
  - PredictedChoice: `accept` is "Keep {label}"; `change` lists the other options.
  - Input: a question by kind. Its value is encoded as the IR says: number and money as a number, date as an ISO
    8601 string.
  - Form: a short sequence inside one act, see "Forms" below.
  - Alternative with `input`: a question by kind.
  - Correction: free text.
  - Preference: its options, or a typed value.
  - Approval `reject`: an optional reason. "skip" sends no reason.
  - ExploreMore with topics: its topics, or "skip" for none.

  `back` returns to browse.
- **confirm.** Picking any act on a plan node with `confirm` (the committing act; never `cancel` or `reject`)
  arms it. The turn shows the consequence verbatim and one `question` part: `Type "{keyword}" to go ahead, or
  "cancel".` (a body may reword it).
  - Only an input equal to `planNode.keyword` (after normalizing, §1.2) commits. The keyword is `"confirm"`
    when the plan gives none (web plans).
  - A number, "yes", the act's own words, or anything else **never** commits. It leaves the turn armed, adds a
    `problem` part ("Nothing was done."), and re-asks.
  - `cancel`, `back` or `no` disarms. Backing out of an IrreversibleAction emits its `cancel` reply, exactly as
    the web organism's Cancel does. Backing out of another armed act emits nothing.
- **readback** (only with `readback: true`). After a valid value, the turn says it back ("You said 42 AED.") and
  asks yes or no. "yes" (or the plan's keyword) sends the reply. "no" asks for the value again.
- **done.** Nothing is left to act on. Its parts hold the outcomes.

### Forms

A Form is asked as a sequence inside ONE act. Picking its `submit` starts it; nothing is sent until the person sends.

1. **The first turn** (`value`) says the form's `prompt` (if any) and how many questions there are ("5 questions."),
   then asks the first field.
2. **Each field** is one `value` turn, asked as an Input of its kind is ("Stall fee (an amount in AED of at least 0)"),
   numbered ("Question 4 of 5: …"; "Question 1 of 4, required: …"). The question part carries `field`. A group heading
   ("Schedule:") is said when the group changes. The value is parsed and checked exactly as an Input's is, and a bad
   one is asked again with the validator's reason. There is no per-field read-back, even in voice.
3. **Skip.** On an optional field, `skip` leaves it unanswered. A required field cannot be skipped: it is asked again
   with "This one is required, so it cannot be skipped." When no field is required, the whole form is skipped at its
   start by its `skip` choice in browse, or by saying `skip all` at question 1: one `skip` reply.
4. **The read-back** (`review`). After the last field, every answer is said once, numbered, an unanswered one as "not
   answered", then: `Say "send" to {submitLabel or intent}, or "change" and a number or a field name.` It takes `send`,
   `submit`, `yes` or the submit label; `change 2`, `change venue address`, or the bare number or name asks that one
   field again and returns to the read-back (`skip` there takes an optional answer out). Anything else sends nothing.
5. **One reply.** Sending produces ONE `submit` reply whose value holds only the answered fields, in field order. If
   nothing is answered, `skip` at the read-back sends the `skip` reply instead. If the plan puts `confirm` on the form,
   the confirm turn follows the read-back.
6. **Back and cancel.** `back` goes to the question before (from question 1, it drops the form; from the read-back, it
   reopens the last question; while changing one answer, it keeps that answer). `cancel` drops the form. Dropping
   sends nothing and forgets the answers.

### Inputs

1. **Normalize** every input: Unicode NFC, trimmed, inner whitespace collapsed, case folded with the plan's
   locale. Trailing `.`, `!` and `?` are dropped.
2. **Match**, in this order:
   1. the global words: `help` and `?` repeat the turn with a hint, `repeat` repeats it, `back` and `cancel`
      back out;
   2. a choice number;
   3. a choice's label or words, exactly;
   4. a value, in a value turn.

   Nothing else matches. There is no fuzzy or partial match: an input that is not understood changes nothing and
   gets a `problem` part saying what is possible.
3. **Every reply goes through `validateReply`** before it is sent. If it fails, nothing is sent: the validator's
   message becomes a `problem` part, and the same question is asked again.
4. **Each node is answered once.** After a reply on a node, its acts leave the choices, except ExploreMore, which
   can be asked again. The node's outcome becomes an `outcome` part: "Approved.", or "Confirmed: spends AED
   1,050". When no choices are left, the dialog is `done`.

The global words are English for now. The confirm keyword is in the plan's language. A body may add words for
its language, such as spoken numbers in voice.

### Words

`feather-dialog` owns the sentences every non-visual body uses:

- `sentences(planNode)`: what a node says;
- `consequenceSentences(consequence, locale)`;
- `formatMoney`, `formatDate`.

`manifest-web` moves its `format.ts` and `summary.ts` logic here and imports them, so web's plain summary and the
dialog say the same thing. A consequence must read exactly as the web organism's `ConsequenceStatement` reads it.
Conformance checks that for every fixture, so the two can never drift.

## 2. Text (`@aleeforoughi/feather-manifest-text`)

- **`renderTurn(turn, { width? }) → string`.** Plain text:
  - content first, wrapped at `width` (default 80) without breaking words;
  - consequences as their own lines;
  - then numbered choices (`1. Approve the budget`);
  - then the question or hint, with a `> ` prompt.

  No meaning depends on color or styling. ANSI bold is used only when the output is a TTY and `NO_COLOR` is not
  set, and only on what the plan emphasizes as `critical` or `primary`.
- **`runText(plan, { input, output, onReply, experience? })`.** A readline loop over a dialog. It ends when the
  dialog is done or the input closes.
- **CLI `feather-text <experience.json> [--context <context.json>] [--width N]`.** Composes with `compose()`.
  - An invalid experience prints the issues (`formatIssues`) and exits 1.
  - The conversation goes to **stderr**, and every reply goes to **stdout** as one JSON line, so `feather-text
    exp.json > replies.jsonl` captures exactly the replies.
  - It runs whatever the plan's manifestation is, since text is always possible.

## 3. Voice (`@aleeforoughi/feather-manifest-voice`)

Engine-agnostic: it speaks and listens through whatever the host provides.

- **`speechFor(turn, plan) → Speech[]`**, where `Speech = { text, lang, kind, pauseAfterMs? }`:
  - Choices are said as words: "Say approve, or reject." A list of more than 3 options is numbered: "Say one for
    Small, two for Medium, …".
  - Nothing depends on seeing anything.
  - The consequence of an irreversible act is always spoken in full before the keyword is asked for.
- **`createVoiceDialog(plan, options)`.** A dialog with `readback: true`, plus `hear(transcripts: string[]) →
  { speech, replies }`.
  - It takes the engine's alternatives in order. The first one that matches a choice or a value wins. In a
    confirm turn, only an exact keyword match commits, and nothing is guessed.
  - Before matching, it maps spoken numbers to digits: in English, zero to twenty, "first" to "tenth", and
    "option two". In a value turn it also maps spoken answers the way they would be typed, by the kind the turn asks for (an Input or
    a Form field): numbers and money in words ("twenty five", "one hundred and four", "two point five") to digits;
    a phone said as digit words ("plus nine seven one …") to digits; an email or web address said with "at", "dot",
    "slash" and "colon" to symbols. Dates and text are left as said. In a Form's read-back, "change two", "number two"
    and "two" mean 2, and "yeah" means yes.
- **`runVoice(plan, engine, onReply)`**, with `VoiceEngine = { speak(speech: Speech[]): Promise<void>;
  listen(): Promise<string[]> }`. A Web Speech adapter is optional and lives outside the package's core.
- Voice uses the plan's locale for `lang`.

## 4. Switch (`@aleeforoughi/feather-manifest-switch`)

Switch access on the web, built on `manifest-web` (`PlanView`).

- **`<SwitchExperience plan … scan="auto" | "step" scanMs={1500} dwellMs?>`**, plus a `FeatherExperience`-like
  wrapper that composes.
- **Targets** are the enabled controls of the rendered experience, in DOM order (which is `plan.order`). Scanning
  goes over the targets one by one, wrapping at the end.
  - The highlighted target gets real focus, so assistive technology reads it, plus a visible highlight: a
    focus-ring token, `data-variant="scanned"`, and no colour-only signal.
- **Inputs:**
  - **auto (one switch):** the highlight advances every `scanMs`. Space or Enter selects (clicks) it.
  - **step (two switches):** Tab or Space moves to the next target, and Enter selects.
  - The keys are configurable. Scanning pauses while a text field has focus, and typing goes to it.
  - **`listen`** (`"experience"` by default, or `"document"`) says where the keys are heard. By default only a key
    pressed inside the scanner, or inside a popup it owns, is taken; the rest of the page keeps Tab, Space and Enter.
    The scanner itself is focusable (`tabIndex=0`, named "Switch scanning: press Space or Enter to start"), so a
    switch user starts there. `"document"` hears keys anywhere, for a page that is nothing but the experience.
    Shift+Tab is never captured.
- **Leaving a text field.** In a text field, Escape belongs to the scanner. It is caught before the organism sees
  it, never backs out of a form, and never clears what was typed. Scanning resumes on the next target after the
  field. In step mode, a "next" key that is not a printable character (Tab) does the same. Backing out of a form is
  done by selecting its own Back or Cancel control.
- **Popups.** While a control the scanner selected has an open popup (`aria-expanded="true"` with
  `aria-controls`, or focus has moved into a menu, listbox or dialog outside the scanner's root), the targets are
  the popup's controls only. When it closes, scanning returns to the experience.
- **Dwell** (`dwellMs` set): resting the pointer on a target for `dwellMs` selects it. Dwell never selects the
  committing control of an armed irreversible act (the organisms' `*-confirm` slots). That control needs the
  switch itself. Dwell may arm; it may not commit.
- **Motion:**
  - With `plan.motion === "reduced"`, the highlight moves without animation.
  - Auto-scan starts only after the person's first switch press. It never starts on mount, so a page never moves
    on its own.
  - It stops when the experience is done.
- **Irreversible acts** keep the organism's two deliberate acts: arm, then confirm. Each is a separate selection.
- **Collapsed nodes** render inside the web's "Other options" disclosure. Its button is one target; once it is
  selected, the nodes inside become targets in plan order.
- **A Form** is operated as any other fields and buttons: each field is a text target (typing pauses scanning, Escape
  resumes it), then the submit control, and the skip control when it exists. All answers go with the one selection of
  the submit control.

## 5. Conformance (`conformance/manifest`)

The L4 exit test. Each fixture is composed for each body with a context that routes to it:
- web: `{ device: { surface: "desktop" } }`;
- switch: `{ capability: { input: { switch: true } } }`;
- voice: the `screenless` reference context;
- text: `{ device: { surface: "terminal" } }`.

Then, for **every valid fixture** and **every available act** (§1, browse), including an IrreversibleAction's
`cancel` (reached by arming, then backing out):

1. **The scenario.** It is derived from the IR: the node, the act, and a valid value when the act needs one. Use
   the first option, a number within `min`/`max`, today's date as a fixed `2026-01-15`, and so on.
2. **Each body is driven through its own means:**
   - web: clicks and typing with Testing Library;
   - switch: switch presses;
   - text: typed lines into a dialog;
   - voice: transcripts into a voice dialog.
   A **Form** scenario is its fields in order: every field answered except the first optional one, which is left
   out (`submit`), every field answered (`submit-all`), and `skip` when no field is required. Web and switch type into
   `[data-slot=form-group-control]` of each `[data-slot=form-group-field][data-field-id]` and select
   `[data-slot=form-group-submit]` (named by `submitLabel` or the intent) or `[data-slot=form-group-skip]`; text and
   voice answer each question in turn, then say `send` at the read-back. A body that replies before the send, asks a
   question out of order, or leaves a field out of the read-back fails. On the web, an empty required field or an
   invalid answer shows `[data-slot=form-group-error]` and sends nothing, and the sent form shows
   `[data-slot=form-group-status]`.
3. **Assertion:** the replies emitted equal exactly `[{ experience, node, act, value? }]`, identical in all four
   bodies.
4. **Deliberate acts.** For a node with `confirm` in the plan, the body's single act (one click, one selection, one
   typed choice, one spoken choice) must emit **nothing**. The reply comes only after the deliberate act: the
   confirm button, the keyword, or the second selection.
5. **Rendering.** Every fixture renders in every body without throwing. Every node in `plan.order` is present in
   what each body renders or says.

The drivers live in `conformance/manifest` and use each package's public API and the documented DOM contract
(`data-feather-node`, `data-slot`). The bodies' builders do not write them.
