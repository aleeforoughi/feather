# feather.ir/1 is frozen

Decided with the owner on 2026-10-05 (docs/PLAN.md section 12, decision 8). From Feather 1.18.0, the Experience IR is
`feather.ir/1`, and updates are `feather.update/1`. A caller can build on them and expect them to hold.

## What the freeze promises

For `feather.ir/1` and `feather.update/1`, in every later Feather:

1. **A valid document stays valid.** If `validate()` accepts an experience, later versions accept it too. The same
   holds for `validateReply()` and a reply, and for `applyUpdate()` and an update. The same document gets the same
   result, the same experience after an update, and the same acts and replies.
2. **An invalid document stays invalid, with the same issue codes and paths.** Messages may be reworded. Codes and
   JSON Pointers do not change.
3. **The meaning of every field holds.** No field is reinterpreted. A node keeps its acts, and every act keeps its
   value encoding.
4. **Nothing is added inside the version.** A new node type, field, act, enum value or op is `feather.ir/2` (or
   `feather.update/2`), never a quiet extension of `/1`. Callers never meet a field that an older Feather would refuse.
5. **TypeScript and Python agree.** Both validators keep matching case for case on the parity corpus
   (`conformance/parity`).

## What can still change

How an experience looks, sounds and is composed can still change: the layout plan (`feather.plan/0`), the composer
rules, the organisms, the themes and the bodies. That freedom is the point of a liquid design system. These changes
still pass the accessibility, visual and conformance gates, and every irreversible act keeps its deliberate act.

## feather.ir/0

`feather.ir/0` is the same contract under its name before the freeze. Feather reads it, and `feather.update/0`, as
is: the documents are identical apart from the version string. Callers built on 1.15–1.17 (Godpip's vendored
`feather_sdk` 1.15.0) keep working. New callers should send `feather.ir/1`. The builders do.

## How a version 2 would start

A change that the promises above rule out starts as a proposal: what a caller cannot say today, and why no
`feather.ir/1` node can say it. If the owner agrees, Feather reads `/2` alongside `/1` for at least one release,
and the parity corpus covers both. `/1` documents are never refused.
