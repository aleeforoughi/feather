# The Living Page: `@aleeforoughi/feather-living`

One full, scrolling website, complete before anyone types. An agent speaking as the person, company or product
itself expands it in place with designed blocks from the page's own library, then folds them back. Feather never
calls a model: the host streams `TurnEvent`s, Feather renders them deterministically, and nothing about the person is
kept (PLAN principle 11). The doctrine is Qooler's file 22 §2–§4; the measured values are file 23 §4 and §6.

## Parts

| Part | Behaviour |
|---|---|
| `Composer` | A rounded card (`rounded-dialog`), up to 768px wide, its edge 10% → 25% of the text color on focus with no glow (`composer-edge`), 16px text growing from 40 to 192px. Enter sends, Shift+Enter adds a line, IME composition never sends. Send becomes Stop in the same place. **The disclosure line is visible before the first word** and describes the field (`aria-describedby`). A custom line must say it is an AI agent (`isDisclosure`), or the default is used |
| `LivingTurn` | The visitor's words as a quiet caption; the speaker's byline; a named phase before the first word (never dots); the spoken line in `font-voice`, word by word; one to three blocks through the registry; two or three next asks; an inline error with a plain next step; fold to a one-line receipt that reopens |
| `LivingPage` | Inserts each turn after the section in view (`sectionInView`, the reading line 40% down), anchors the question at the top (`anchorScroll`), follows the stream only while the reader is at the bottom (`followDecision`), shows Jump to latest only when they are away from it, and "Back to the page" folds all. The Composer docks at the bottom after the first turn and never moves again |
| `Presence` | The brand's slot (film, mark or object). It leans in while thinking and breathes while speaking; never a spinner or a stock avatar; decorative to assistive technology |
| Block registry | `createRegistry(blocks)` maps block kinds, and IR nodes (`DEFAULT_IR_MAP`), to the brand's designed blocks. A kind the brand did not design falls back to its Statement, never to a one-off |
| Prepared scenes | `matchPrepared` plays a top intent at once (`preparedEvents`), with no fake slowness; `preparedRoutes` lists them as static, indexable routes; `PreparedSceneView` renders one with no script needed |

## The host contract

```ts
type AskHandler = (ask: string, options: { signal: AbortSignal }) => AsyncIterable<TurnEvent>
type TurnEvent =
  | { type: "phase"; label: string }      // "Looking through the work": before the first word only
  | { type: "word"; text: string }        // words with their own spacing: "Acceptto", " is", …
  | { type: "block"; block: Block }       // at most three per turn
  | { type: "asks"; asks: string[] }      // at most three
  | { type: "done" }
  | { type: "error"; message: string; next?: string }
```

Stop aborts the signal. A new ask stops the turn still streaming, so two answers never grow at once.
`conversationReducer` is the whole state machine, pure and tested.
