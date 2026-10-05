# @aleeforoughi/feather-embed

Feather in any web page, with one script import. No React, no npm and no bundler on the page: the bundle carries
React, Base UI and Feather, and renders an Experience IR (`feather.ir/1`) inside an element you choose. It hands the
person's reply back as a validated event.

```html
<div id="slot"></div>
<script type="module">
  import { mount, validate, validateReply, version } from "/static/feather/feather-embed.js"

  const view = mount(document.getElementById("slot"), experience, {
    context,             // RenderContext: persona, capability, device, brand… (optional)
    theme: "feather",    // "feather" | "feather-dark" | a feather-tokens/2 brand tokens object
    onReply(reply) {},   // the validated reply { experience, node, act, value? }
    onIssues(issues) {}, // the IR was invalid; nothing renders
  })
  view.update(nextExperience, nextContext?) // render something else in place
  view.unmount()                            // remove everything Feather added to the page
</script>
```

Other options: `autoFocus` (default `false`: an embed never takes focus from the page) and `css` (a stylesheet URL, or
`false` when the page links `feather-embed.css` itself). `view.ready` resolves when the stylesheet has loaded and the
first render is in; `view.root` is the element Feather renders in. `validate(ir)` and `validateReply(experience, reply)`
are the IR validators. Types are in `dist/feather-embed.d.ts`.

## Serving it

Serve the `dist/` folder from any path and import the script from there; nothing is absolute.

```text
feather/
  feather-embed.js     the module (everything bundled, no imports)
  feather-embed.css    loaded by the script, from next to itself, on the first mount
  fonts/*.woff2        JetBrains Mono, referenced by the CSS with relative URLs
```

Give `.js`, `.css` and `.woff2` their usual content types. The stylesheet is added as a `<link>` by the first view and
removed with the last.

## It does not touch the page

- Everything Feather renders is inside one `<div class="feather-root" data-feather>` that `mount` creates in your
  element. Popups (menus, selects, popovers, tooltips, dialogs, sheets) go to one
  `<div class="feather-root" data-feather-portal>` at the end of `<body>`, which is removed with the last view.
- The stylesheet is scoped. `:root`, `html`, `body` and `:host` rules become `.feather-root`. Tailwind's preflight and
  Feather's base rules (`*`, `::before`, `button`, `h1`, `[type=button]`…) only match inside a `.feather-root`, at
  element specificity (`:where(.feather-root) button`), so a utility class still wins over them. Utilities stay class
  selectors. `.dark` only counts on a Feather root. `@font-face`, `@property` and `@keyframes` stay global: they are
  harmless. No custom property is declared on `:root`, `html` or `body`.
- Cascade layers are flattened. A page's unlayered CSS beats every layered rule, whatever its specificity, which would
  let a host's `button { font: inherit }` win inside Feather. Without layers, Feather's classes win over the host's
  element selectors.
- No `localStorage`, no keyboard shortcuts, no `<html>` class, no listeners left on `window` or `document`
  after `unmount` (React keeps one `selectionchange` listener on the document for the life of the page).
- `prefers-reduced-motion` is respected, as in Feather's own surfaces.

`e2e/` proves it against a copy of Godpip's real page and stylesheet, which uses the same custom property names as
Feather (`--border`, `--muted`, `--radius`, `--accent`…).

## Themes

`theme` is `"feather"` (default), `"feather-dark"` (adds `dark` to the root) or a `feather-tokens/2` brand tokens
object. A brand's CSS is built in the browser by Feather's theme engine and rewritten to the roots that carry its id
(`.feather-root[data-feather-theme="…"]`): one `<style>` per brand in use, shared by the views that use it, removed with
the last. Two views may use different themes; a popup follows the theme of the view that opened it. Brand fonts are not
bundled: load the brand's font files in the page (the CSS names the family); JetBrains Mono is included.

## Known limits

- While a modal popup is open (a menu, select, dialog or sheet), Base UI locks the page's scroll with an inline
  `overflow` on `<html>` and `<body>`. It is removed on close, and an empty `style` attribute it leaves is removed too.
- Motion that is driven from JavaScript reads its durations from `<html>`, where the embed declares nothing, so it uses the
  calm defaults whatever the brand's motion axis says. Motion done in CSS follows the brand.
- Unclassed elements inside Feather can still be styled by a host's element selectors (an `h2 { font-size }`, say) when
  Feather leaves them unstyled; Feather's own components style every element they render.

## Build and test

```sh
pnpm --filter @aleeforoughi/feather-embed build     # dist/feather-embed.{js,css,d.ts} and dist/fonts
pnpm --filter @aleeforoughi/feather-embed test      # the CSS scoper
CHROMIUM_PATH=/path/to/chrome pnpm --filter @aleeforoughi/feather-embed test:e2e
```
