# The experience lifecycle (milestone L6)

> Feather renders the next necessary human interaction, and **dissolves it when its purpose is done**.

An experience is not a screen. It opens, changes while the work behind it moves, ends, and then collapses to what it
leaves behind:

```text
open → update → update → … → resolve → collapse
```

The caller owns time and state. Feather stays pure: no clock, no I/O, no storage. The caller sends the experience
once, then small updates. Feather applies each one, composes again, and every body changes in place without
losing the person's place.

## 1. The contract

### The experience

Two optional top-level fields (`packages/intent/src/types.ts`, schema `schema/feather.ir-1.json`):

| field | meaning |
|---|---|
| `revision` | The caller's version: `0` (or absent) when opened, one more with each update. |
| `resolved` | Set when the experience is over: `{ outcome, summary, artifact? }`. |

- `outcome` is `done`, `cancelled` or `failed`.
- `summary` says what happened, in one line of at most 120 code points. It is all that stays.
- `artifact` is what the experience leaves behind: `{ label, href?, kind? }`. A body renders `href` only when it is an
  `http:` or `https:` URL. `kind` is one of `document`, `image`, `video`, `audio`, `link` or `data`.

A resolved experience may have no nodes. It takes no replies: `validateReply` answers `resolved`.

### The update (`feather.update/1`)

```json
{ "update": "feather.update/1", "experience": "plan_trip", "revision": 2,
  "ops": [
    { "op": "patch", "id": "work", "set": { "value": 1 } },
    { "op": "add", "node": { "type": "Recommendation", "id": "rec", "intent": "take the recommended flight", "summary": "Direct, 9:40" } },
    { "op": "resolve", "outcome": "done", "summary": "Booked: direct flight, 9:40." }
  ] }
```

| op | does |
|---|---|
| `add` | Adds `node`, after the node named by `after`, or at the end. Its id must be new. |
| `replace` | Puts `node`, whole, in place of the node with its id. |
| `patch` | Changes fields of the node `id` in place, from `set`. A field set to `null` is removed. Never `id` or `type`. |
| `remove` | Removes the node `id`. |
| `resolve` | Ends the experience with `outcome`, `summary` and `artifact`. Always the last op. |

`applyUpdate(experience, update)` (`packages/intent/src/update.ts`) is pure:
- it never changes the experience it is given;
- every op lands, or none does;
- the result is valid `feather.ir/1`, or the update is refused with every reason.

Each issue has a code and a JSON Pointer. Problems in the experience the update would make are under `/result`.

| code | when |
|---|---|
| `stale-revision` | `revision` is not exactly one more than the experience's. The caller and Feather have drifted: send the whole experience again. |
| `wrong-experience`, `unsupported-version`, `empty-update`, `unknown-op` | The update itself is wrong. |
| `unknown-node`, `duplicate-id`, `invalid-value` | An op names a node that is not there, adds an id that is, or patches `id` or `type`. |
| `already-resolved`, `after-resolve` | An update to an ended experience, or an op after `resolve`. |
| any `feather.ir/1` code under `/result` | Each op was fine, but what they make together is not valid. |

The fixtures are in `conformance/update`. `valid/streamed-trip.json` is the exit scenario of L6: progress, then a
recommendation and an approval, then done, leaving only the artifact and a one-line summary.

### The plan

`compose()` adds `plan.revision` and `plan.lifecycle`, decided by the composer rule `lifecycle`:
- **open:** the plan is as before.
- **collapsed** (the experience is resolved): `plan.resolution` holds the outcome, summary and artifact. Regions are
  empty, and `primary`, `focus` and `order` are null or empty. `chrome` is `none`.

The body still follows the person, so a collapsed plan is spoken, typed or shown like any other.

## 2. Every body: changing in place

The caller applies each update (`applyUpdate`), and hands the body the new experience or plan. In every body:

1. **The person keeps their place.** A node whose id survives keeps its state: an organism stays mounted, and in
   text and voice it is not asked again. A node replaced by one of another type starts over.
2. **Nothing moves the person.** `plan.focus` applies once, when the experience first renders, never on an update.
   If the element that has focus is removed, focus moves to the experience's root, never to the page body. If the
   experience collapses while it has focus, focus moves to the summary.
3. **Safety first.** If an update changes or removes a node whose irreversible act is armed, the act is disarmed and
   the person is told. Confirming then commits nothing.
   - Web: the organism's confirm control is gone, and a polite message says it changed.
   - Text and voice: a `problem` part says it changed, then browse.
   - Switch: the armed control is no longer a target.

   An act on a node already replied to is not offered again unless an update changed that node's content. A
   patched or replaced node is a new question.
4. **Changes are told, once, politely.** For each new revision, a body tells the person what is new in one sentence,
   naming each act node that was added by its intent: "New: approve the booking." It says nothing when nothing they
   can act on was added. Progress speaks for itself (a progressbar, or the spoken value in voice), and is never
   announced every tick.
   - Web: a polite live region (`aria-live="polite"`, `data-slot="experience-updates"`).
   - Text and voice: the next turn's first part, `update`.
   - Switch: the web's live region.
5. **Collapse.** A collapsed plan shows its resolution and nothing else:
   - **Web:** one line in a `role="status"` region (`data-slot="experience-resolution"`), with the outcome in words
     (Done, Cancelled or Failed), the summary (`experience-resolution-summary`), and the artifact as a link when its
     `href` is http(s), else as its label (`experience-resolution-artifact`). No card, no controls.
   - **Text and voice:** the `done` turn. Its parts are the summary, then "{label}: {href}", or the label alone. There
     are no choices.
   - **Switch:** the artifact link, when there is one, is the only target, so the person can still open what the
     experience left. Otherwise there are no targets, and scanning stops.
6. **Updates that arrive out of order are not applied.** That is the caller's `stale-revision`. A body handed a plan
   whose revision is lower than the one it shows keeps what it shows. The same revision replaces it: the caller
   re-sent it, or the context changed.
7. **An open experience with nothing to act on is not over.** A progress-only experience waits for its next update.
   The dialog's `done` turn means only that nothing is left to act on now. `Dialog.resolved` is true only for a
   collapsed plan, and a text or voice run ends only then.

## 3. Conformance

`conformance/manifest` drives `streamed-trip` through all four bodies, applying each update between acts. It proves
the same replies, the same final collapse, and that nothing remains to act on. A safety scenario arms the approval,
then applies an update that changes its consequence, and proves that confirming commits nothing in any body.
