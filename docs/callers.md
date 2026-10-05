# Calling Feather

A caller is any system that decides what a person needs to do, and leaves how it looks, sounds and behaves to
Feather. Godpip is the first. A caller sends an **experience** (the [Experience IR](ir/README.md), `feather.ir/1`)
and receives a **reply**: the person's decision, already checked.

```text
caller (server)                      browser                                  person
  build the experience  ─── JSON ──▶  mount(el, experience, { onReply })  ──▶  sees and acts
  validate_reply(reply) ◀── JSON ───  onReply({ experience, node, act })  ◀──  confirms
```

The caller never sends a component, a color or a position, and Feather never calls a model, stores the person, or
logs them. The IR is the only connection.

Two pieces do the work, and one install brings both:

| Piece | Where it runs | What it does |
|---|---|---|
| `feather-sdk` (Python) | the caller's server | builds experiences, validates them and the replies, ships the browser bundle |
| `feather-embed.js` + `.css` | the caller's page | renders an experience for this person and device, and hands back the reply |

`@aleeforoughi/feather-embed` is the same bundle for JavaScript callers, and a React product can use
`<FeatherExperience>` from `@aleeforoughi/feather-manifest-web` directly (see [Rendering on the web](composer.md#rendering-on-the-web-aleeforoughifeather-manifest-web)).

## 1. Install

The SDK is a wheel attached to each Feather release, and a caller pins an exact version. Replace `X.Y.Z` with
the release you use. The repository is private, so use a token that can read it:

```bash
gh release download vX.Y.Z --repo aleeforoughi/feather --pattern 'feather_sdk-*.whl' --dir vendor/
pip install vendor/feather_sdk-X.Y.Z-py3-none-any.whl
```

If you were handed the wheel file, `pip install path/to/feather_sdk-X.Y.Z-py3-none-any.whl` is all it takes.

It has no dependencies and needs Python 3.11 or later. The wheel holds the browser bundle too, so the server and
the page always speak the same version.

## 2. Build and validate an experience (server)

```python
from feather_sdk import experience, format_issues, nodes, validate

approve = experience("approve_campaign", [
    nodes.Recommendation(id="rec", intent="launch the recommended test", importance="high", reversible=False,
                         summary="Recommended test: 7 days, purchase objective",
                         expandable={"why": "Enough to test three creative directions without overspending."}),
    nodes.Price(id="cap", amount=1050, currency="AED", label="Maximum spend"),
    nodes.IrreversibleAction(id="go", intent="confirm spend", importance="critical",
                             consequence={"spend": {"amount": 1050, "currency": "AED"}}),
    nodes.Alternative(id="less", intent="spend less"),
    nodes.Alternative(id="own", intent="set my own budget", input="Price"),
])

result = validate(approve)
if not result.ok:
    raise ValueError(format_issues(result.issues))   # every problem at once, each with a code and a path
```

**Which node do I use?** Say what the person must do, not how it looks:

| The person must… | Use |
|---|---|
| approve or reject something someone asked for (a purchase request, an access request) | `Approval`, with `requester` pointing at a `Person`, and a `consequence` when approving spends, sends, publishes, deletes or grants consent |
| take your recommendation, or pick another way | `Recommendation`, then `Alternative`s with `for` |
| confirm one permanent act (spend, publish, send, delete, consent) | `IrreversibleAction` with its exact `consequence` |
| pick one option, or several | `Choice` (with a `PredictedChoice` when you can guess) |
| give you one fact | `Input`; for several facts at once, one `Form` |
| just be told something | `Text`, `Status`, `Progress`, `Warning`, `Confirmation` |

Anything with a `consequence` cannot be undone. Feather shows the consequence verbatim and makes the person act
deliberately (arm, then confirm, or a keyword by voice and text) before the reply is sent. You never add that
yourself. An approval request:

```python
request = experience("approve_license", [
    nodes.Person(id="maya", name="Maya", role="Finance"),
    nodes.Approval(id="buy", intent="approve the purchase", request="Buy an annual Acme Notes license for 49 USD",
                   requester="maya", scope="Acme Notes, 1 year",
                   consequence={"spend": {"amount": 49, "currency": "USD"}}),
])
```

It replies `{"node": "buy", "act": "approve"}`, or `"reject"`, with an optional reason as `value`.

`validate` is the same validator Feather runs, rule for rule. A conformance suite checks the Python and
TypeScript versions against each other on every fixture and several hundred generated cases, so an experience
that passes here renders in the browser. Every node type and field is in the [node reference](ir/nodes.md); the
builders in `feather_sdk.nodes` have the same names and arguments, with their docs.

## 3. Render it (page)

Serve the whole of `feather_sdk.static_dir()` under one path: the bundle loads its stylesheet and fonts from next
to itself. With FastAPI:

```python
from fastapi.staticfiles import StaticFiles
import feather_sdk

app.mount("/feather", StaticFiles(directory=feather_sdk.static_dir()), name="feather")
```

Any other server works the same way, if it sends the right types: `.js` as `text/javascript` (a module will not
load otherwise), `.css` as `text/css` and `.woff2` as `font/woff2`. With only the standard library, map
`/feather/<file>` to `static_dir() / <file>`, and take the type from `mimetypes.guess_type`, after adding
`mimetypes.add_type("text/javascript", ".js")`.

Then, in plain JavaScript, with no build step. One import is enough: the bundle links its stylesheet (from next
to itself) on the first mount.

```html
<div id="decision"></div>
<script type="module">
  import { mount } from "/feather/feather-embed.js"

  const experience = await (await fetch("/api/experience")).json()
  const view = mount(document.getElementById("decision"), experience, {
    context: { device: { surface: "desktop" } },   // optional: who this is for, and where
    theme: "feather",                              // or "feather-dark", or a brand's feather-tokens/2 object
    onReply: (reply) => fetch("/api/reply", { method: "POST", body: JSON.stringify(reply) }),
    onIssues: (issues) => console.error(issues),   // the experience was invalid; nothing renders
  })
  await view.ready                                 // styled and rendered: a .feather-root is now inside #decision
  // view.update(nextExperience, nextContext) to change it; view.unmount() when it is done.
</script>
```

An experience can change while the work behind it moves ([lifecycle](lifecycle.md)). Send small updates to `apply()`:
it applies each `feather.update/1` to what is shown and renders the result in place, keeping the person's place.

```js
const result = view.apply({
  update: "feather.update/1", experience: "plan_trip", revision: 1,
  ops: [{ op: "patch", id: "work", set: { value: 0.5 } }],
})
if (!result.ok) console.warn(result.issues)   // also passed to onIssues; what is shown stays
// result.experience is the new experience. A "resolve" op collapses the view to its summary and artifact.
// A "stale-revision" issue means the page and the caller have drifted: send the whole experience with view.update().
```

| `mount` option | What it does |
|---|---|
| `context` | Who the experience is for, and where (below). |
| `theme` | `"feather"` (default), `"feather-dark"`, or a `feather-tokens/2` brand object. |
| `onReply(reply)` | The person's decision, already validated in the browser. |
| `onIssues(issues)` | The experience failed validation; nothing renders. |
| `autoFocus` | Move focus into the experience when it renders. Default `false`: an embed never takes focus from the page. |
| `css` | The stylesheet's URL, or `false` when the page links `feather-embed.css` itself. |

**It leaves the page alone.** Everything Feather renders sits in a `.feather-root` element inside the one it is
given, and its menus and popups open in one Feather layer at the end of `<body>`. Its styles and CSS variables are
scoped to those roots, so the page's styles, fonts and variables are untouched (a test proves it on Godpip's own
stylesheet). It never writes to storage and leaves no listeners behind. `unmount()` returns the document to
exactly what it was. Limits:
- While a modal menu or dialog is open, it locks the page's scroll, as any modal does.
- A page's own rules for bare elements, such as `h2 { … }`, still reach unclassed elements inside Feather.
  Feather's components style everything they render.
- A brand's fonts, other than JetBrains Mono, must be loaded by the page.

**Context** says who the experience is for and where: `persona` (density, explanation depth, motion), `capability`
(vision, motor precision, input), `device` (surface, input mode). It is passed on every render and never stored.
The [composer](composer.md) uses it to choose the layout, the emphasis and the body.

**Theme** is `"feather"` (the default, black and white), `"feather-dark"`, or a brand's `feather-tokens/2`
object, the same file `feather-brand` reads. Each view takes its own, and its popups follow it.

**Asking several things?** Use one `Form` (`nodes.Form(id=…, intent=…, fields=[{"id": "venue", "prompt": "Venue
address", "kind": "long-text", "group": "Place"}, …])`), not several Inputs. It sends every answer with one act, as
`{"act": "submit", "value": {"venue": "…"}}`, so nothing the person typed is lost, and it asks in turns by voice and
text.

## 4. Receive the reply (server)

```python
from feather_sdk import format_issues, validate_reply

@app.post("/api/reply")
async def reply(request: Request):
    result = validate_reply(approve, await request.json())
    if not result.ok:
        status = 409 if result.issues[0].code == "resolved" else 400
        raise HTTPException(status, format_issues(result.issues))
    if not claim_once(approve["experience"], result.reply["node"]):   # your store: an atomic "first answer wins"
        raise HTTPException(409, "already answered")
    decide(result.reply)   # {"experience": "approve_campaign", "node": "go", "act": "confirm"}
```

Never act on a reply without `validate_reply`: it checks that the node exists, the act is one that node takes, and
the value has the right shape. The browser already checked it once; the server is where it counts.

- **The result:** `result.ok`, and then either `result.reply` (the checked reply) or `result.issues`, each with a
  `code` and a `message`. The codes are `invalid-experience`, `resolved`, `not-an-object`, `unknown-field`,
  `wrong-experience`, `unknown-node`, `unknown-act`, `missing-value`, `unexpected-value` and `invalid-value`.
- **Status codes:** 400 for an invalid reply and 409 once the experience is resolved or the act was already
  answered. The TypeScript `createReplyHandler` answers 400 and 409 (resolved) the same way. Claiming each act once
  is up to your `onReply`, as it is here.
- **Accept each act once.** A reply is a decision, and Feather keeps no state. Validate first, so a bad reply
  always gets its issues. Then claim the act atomically in your own store, and only then act on it. A second copy
  of the same reply, whether retried, double-sent or from another tab, gets 409.
- **Then end it.** Once you have acted on the decision, resolve the experience (section 5) with a one-line summary.
  The page collapses to it, and any late reply gets `resolved`.

Every act a node can reply with is listed in the [node reference](ir/nodes.md). An irreversible act (anything with
a `consequence`) only ever replies after a deliberate confirmation, in every body.

## 5. Updating an experience

The caller owns time. When the work behind an experience moves, send a small update instead of the whole experience;
each body changes in place and keeps the person's place. `apply_update` is pure (it changes neither argument and holds
no state), so you keep the current experience and replace it with what comes back. The contract is
[lifecycle.md](lifecycle.md).

```python
from feather_sdk import apply_update, nodes, ops, update

change = update("plan_trip", current.get("revision", 0) + 1, [
    ops.patch("work", value=0.5),                       # change fields in place; None removes one
    ops.add(nodes.Recommendation(id="rec", intent="take the recommended flight", summary="Direct, 9:40")),
])
result = apply_update(current, change)
if result.ok:
    current = result.experience          # revision is now one more; send it to the page as you did the first
else:
    ...                                   # nothing was applied: every op lands, or none does
```

The ops are `add`, `replace`, `patch`, `remove` and `resolve` (always last). Refusals carry every reason, each with a
JSON Pointer into the update; problems in the experience the update would make are under `/result`.

**Stale revision.** An update must carry exactly one more than the experience's `revision` (`0` when it has none).
If it does not, `result.stale` is true and the issue code is `stale-revision`: the caller and Feather have drifted,
for example after a restart or a lost update. This is the 409 of the lifecycle. Do not retry the update; send the whole
experience again (with its current `revision`) and continue from there.

**Resolving.** When the work is over, end the experience with a one-line summary, and an artifact if it leaves
something behind:

```python
done = apply_update(current, update("plan_trip", current.get("revision", 0) + 1, [
    ops.resolve("done", "Booked: direct flight, 9:40.", artifact={"label": "Booking", "href": "https://example.com/b/42", "kind": "document"}),
]))
```

`outcome` is `done`, `cancelled` or `failed`; the summary is one line of at most 120 characters. A resolved experience
collapses to the summary and artifact, takes no more updates (`already-resolved`) and no more replies
(`validate_reply` answers `resolved`). `experience(..., revision=3, resolved={...})` builds one that is already over.

## TypeScript and JavaScript

`@aleeforoughi/feather-client` is the same caller API for Node servers and browsers (its one dependency is the IR
package; it calls no model and logs nothing). Install it from GitHub Packages and pin an exact version. Pair it with
`@aleeforoughi/feather-embed` on the page, as the Python SDK pairs with the bundle.

```ts
import { createServer } from "node:http"
import { add, applyUpdate, createReplyHandler, experience, formatIssues, nodes, patch, resolve, update, validate } from "@aleeforoughi/feather-client"

let current = experience("approve_campaign", [
  nodes.Recommendation({ id: "rec", intent: "launch the recommended test", importance: "high", summary: "7 days, purchase objective",
                         expandable: { why: "Enough to test three creative directions." } }),
  nodes.Price({ id: "cap", amount: 1050, currency: "AED", label: "Maximum spend" }),
  nodes.IrreversibleAction({ id: "go", intent: "confirm spend", importance: "critical", consequence: { spend: { amount: 1050, currency: "AED" } } }),
])
const checked = validate(current)
if (!checked.ok) throw new Error(formatIssues(checked.issues))   // every problem at once, each with a code and a path

// Receive the reply: 200 when valid, 400 with the issues when not, 409 once the experience is resolved.
const onReply = createReplyHandler({ experience: () => current, onReply: (reply) => console.log(reply.node, reply.act) })
createServer((req, res) => (req.url === "/api/reply" ? onReply(req, res) : res.writeHead(404).end())).listen(8765)
// Fetch runtimes (Next.js, Hono, Deno, Bun, Workers): export const POST = (request: Request) => onReply(request)

// The work moves: change it in place, then end it. applyUpdate is pure; keep what it returns.
for (const ops of [[patch("cap", { amount: 900 }), add(nodes.Text({ id: "note", text: "Budget lowered." }))], [resolve("done", "Campaign launched.")]]) {
  const result = applyUpdate(current, update(current.experience, (current.revision ?? 0) + 1, ops))
  if (!result.ok) throw new Error(formatIssues(result.issues))   // a stale revision: send the whole experience again
  current = result.experience
}
```

The builders (`nodes.*`) take one object and have the names, fields and docs of the [node reference](ir/nodes.md); a
missing required field is a type error. They do not validate: `validate`, `applyUpdate` and `validateReply` do, with
the same words as Python. `parseReply(experience, body)` checks a reply you read yourself (an object, or JSON text)
and returns `validateReply`'s result. The ops are `add`, `replace`, `patch`, `remove` and `resolve`, as in
[lifecycle.md](lifecycle.md).

## Reference integration

`examples/python-caller` is a complete caller in one file of standard-library Python: it serves a page, sends
the ad campaign experience, and validates the reply. CI runs it end to end in a browser.

```bash
pnpm build && pnpm build:wheel           # the bundle, into the SDK
python3 examples/python-caller/server.py   # then open http://localhost:8765
```

## Versions

The IR is frozen as `feather.ir/1` (updates as `feather.update/1`). A document that is valid today stays valid, and
keeps its meaning, in every later Feather. What that promises is in [the freeze](ir/FREEZE.md). `feather.ir/0`,
the name before the freeze, is still read. How an experience looks and is composed keeps improving. Pin the wheel
to an exact release, and upgrade the server and the page together, since one wheel holds both.
