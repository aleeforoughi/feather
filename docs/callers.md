# Calling Feather

A caller is any system that decides what a person needs to do, and leaves how it looks, sounds and behaves to
Feather. Godpip is the first. A caller sends an **experience** (the [Experience IR](ir/README.md), `feather.ir/0`)
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
`<FeatherExperience>` from `@aleeforoughi/feather-manifest-web` directly (see the [README](../README.md)).

## 1. Install

The SDK is a wheel attached to each Feather release (the repository is private, so use a token that can read
it), and a caller pins an exact version:

```bash
gh release download v1.14.0 --repo aleeforoughi/feather --pattern 'feather_sdk-*.whl' --dir vendor/
pip install vendor/feather_sdk-1.14.0-py3-none-any.whl
```

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

`validate` is the same validator Feather runs, rule for rule. A conformance suite checks the Python and
TypeScript versions against each other on every fixture and several hundred generated cases, so an experience
that passes here renders in the browser. Every node type and field is in the [node reference](ir/nodes.md); the
builders in `feather_sdk.nodes` have the same names and arguments, with their docs.

## 3. Render it (page)

Serve the bundle from the wheel. With FastAPI:

```python
from fastapi.staticfiles import StaticFiles
import feather_sdk

app.mount("/feather", StaticFiles(directory=feather_sdk.static_dir()), name="feather")
```

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
  await view.ready                                 // styled and rendered
  // view.update(nextExperience, nextContext) to change it; view.unmount() when it is done.
</script>
```

| `mount` option | |
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

## 4. Receive the reply (server)

```python
from feather_sdk import format_issues, validate_reply

@app.post("/api/reply")
async def reply(request: Request):
    result = validate_reply(approve, await request.json())
    if not result.ok:
        raise HTTPException(422, format_issues(result.issues))
    decide(result.reply)   # {"experience": "approve_campaign", "node": "go", "act": "confirm"}
```

Never act on a reply without `validate_reply`: it checks that the node exists, the act is one that node takes, and
the value has the right shape. The browser already checked it once; the server is where it counts.

Every act a node can reply with is listed in the [node reference](ir/nodes.md). An irreversible act (anything with
a `consequence`) only ever replies after a deliberate confirmation, in every body.

## Reference integration

`examples/python-caller` is a complete caller in one file of standard-library Python: it serves a page, sends
the ad campaign experience, and validates the reply. CI runs it end to end in a browser.

```bash
pnpm build && pnpm build:wheel           # the bundle, into the SDK
python3 examples/python-caller/server.py   # then open http://localhost:8765
```

## Versions

The IR is `feather.ir/0` until milestone L7, where it freezes as `feather.ir/1` and stops changing. Until then a
minor Feather release may change it, and the changelog says how. Pin the wheel to an exact release, and upgrade
the server and the page together (one wheel holds both).
