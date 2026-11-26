# The package map

Feather is one repository and one version (every package moves together), published as these packages. This page
says what each is for, what you import from it, how they depend on each other, and which one to start from.

```text
foundations   feather-tokens                         (no Feather dependencies)

product UI    feather-react            ──►  tokens
              feather-manifest-web     ──►  react, liquid, dialog, intent, context, tokens
              feather-manifest-switch  ──►  manifest-web, react, liquid, intent, context, tokens

websites      feather-expression       ──►  tokens
              feather-living           ──►  expression, intent, tokens
              feather-page             ──►  expression, living, tokens

callers       feather-intent, feather-context           (no Feather dependencies)
              feather-liquid           ──►  intent, context
              feather-dialog           ──►  intent, liquid
              feather-manifest-text    ──►  dialog, intent, liquid      (CLI feather-text)
              feather-manifest-voice   ──►  dialog, intent, liquid
              feather-embed            one built bundle of the web body (manifest-web and its parts)
              feather-sdk (Python)     a wheel: the validators, and the embed bundle inside
```

## Where to start

| You are building | Start from | Then add |
|---|---|---|
| **A product** (an app, a dashboard, a tool) | `@aleeforoughi/feather-react` and `@aleeforoughi/feather-tokens` | `feather-manifest-web` when a caller sends experiences to render |
| **A website** (a portfolio, a studio, a launch) | `@aleeforoughi/feather-page`: one JSON document, a brand file | `feather-expression` directly when you build pages in code; `feather-living` for an on-page agent |
| **A caller** in Python (a service that decides what a person must do) | `feather-sdk`, a wheel from a release | nothing: the wheel carries the browser bundle |
| **A caller** in JavaScript or in any page | `@aleeforoughi/feather-embed`: `mount(el, experience)` | `feather-intent` to validate on the server |
| **A theme only** (a brand for someone else's Feather) | `@aleeforoughi/feather-tokens` and the `feather-brand` CLI | nothing |

[Getting started](getting-started.md) walks each of these in minutes.

## The packages

### Foundations

| Package | What it is for | Entry points |
|---|---|---|
| `@aleeforoughi/feather-tokens` | The brand: token schema (`feather-tokens/4`, with `/3`, `/2` and `qooe-tokens/1` read as they are), the theme engine, the foundation CSS, the reference themes and the fonts. Browser-safe, no dependencies of its own. | `.` (`buildTheme`, `migrateTokens`, the scales and axes), `./foundation.css`, `./themes/*` (`feather`, `feather-dark`, `paper-sharp`, `void-pill`, `studio`, `portrait`, `seed`), `./fonts/*`, `./schema/*` (JSON Schema per version), CLIs `feather-brand` and `feather-font` (any open font, self-hosted, with a metric-matched fallback) |

### Product UI

| Package | What it is for | Entry points |
|---|---|---|
| `@aleeforoughi/feather-react` | Atoms, molecules and organisms on Base UI and Tailwind CSS v4, styled only through tokens. | `.` (the components and `FeatherProvider`), `./styles.css` (the one stylesheet to import), `./foundation.json` (the component manifest: level, slots, stories) |
| `@aleeforoughi/feather-manifest-web` | Renders a layout plan on the web: `FeatherExperience` and `PlanView`. Turns every act into a validated reply. | `.` |
| `@aleeforoughi/feather-manifest-switch` | Switch access over the web body: scanning (one or two switches) and dwell. | `.` |

### Websites

| Package | What it is for | Entry points |
|---|---|---|
| `@aleeforoughi/feather-expression` | The primitives an award-grade website is made of: sections, the stage, display type and kinetic effects, media, marquee, scroll layers and image sequences, route transitions, the loader, the overlay menu, the World slot. | `.` (React components and everything in core), `./core` (framework-free: the clock, the scroll engine, the quality ladder, the capability gate, route transitions, loudness) |
| `@aleeforoughi/feather-scene` | 3D and WebGL scenes as World renderers ([scene.md](scene.md)): shader backgrounds and image-to-depth on raw WebGL, and on Three.js (an optional peer) the object viewer, particles, camera rails and post. | `.` (`shaderBackground`, `depthImage`, `useScene`), `./three` (`objectViewer`, `attachKeys`, `particleField`, `cameraRail`, `studioPost`) |
| `@aleeforoughi/feather-living` | The Living Page: one scrolling site that an agent expands in place with designed blocks, then folds back. Feather never calls a model; the host streams events. | `.` |
| `@aleeforoughi/feather-page` | A website from one JSON document, `feather.page/1`: the block library and the page blocks (media, product flows), the page edges (nav, footer, loader, 404, sound), the knobs and layouts, six templates, the validator, the static builder. | `.` (`FeatherPage`, `mountPage`, `validatePage`, `checkLayout`, `PageNotFound`), `./schema/*` (`feather.page-0.json`, `feather.page-1.json`), `./templates/*` (`index.js`: `TEMPLATES`, and each `<name>.page.json`), CLI `feather-page` (`init`, `validate`, `routes`, `build`) |

### Callers and the liquid layer

| Package | What it is for | Entry points |
|---|---|---|
| `@aleeforoughi/feather-intent` | The Experience IR `feather.ir/0`: types, `validate()`, `validateReply()`, the update protocol. No dependencies. | `.`, `./schema/*` (`feather.ir-0.json`, `feather.update-0.json`), CLI `feather-ir` (`validate <file.json>...`) |
| `@aleeforoughi/feather-context` | Who an experience is rendered for, and where: persona, capability, device and brand types. Types only. | `.` |
| `@aleeforoughi/feather-liquid` | The composer: `compose(experience, context)` gives a layout plan by named rules, with a trace. Pure and deterministic. | `.` |
| `@aleeforoughi/feather-dialog` | The turn-based engine text and voice share. No I/O. | `.` |
| `@aleeforoughi/feather-manifest-text` | The experience in a terminal or as plain text. | `.`, CLI `feather-text <experience.json>` |
| `@aleeforoughi/feather-manifest-voice` | Prompts, spoken confirmations and readback for any speech engine. | `.` |
| `@aleeforoughi/feather-embed` | Feather in any page with one import: `mount(element, experience, { onReply })`. Self-contained, and scoped so it never changes the host page. | `.`, `./feather-embed.css` |
| `feather-sdk` (Python 3.11+, import `feather_sdk`) | Build and validate experiences and replies, and serve the browser bundle. No dependencies. A wheel on every release. | `feather_sdk` (`experience`, `nodes`, `validate`, `validate_reply`, `apply_update`, `static_dir`) |
| Release assets (`feather-page-<version>.mjs`, `feather-page-web-<version>.zip`) | For page callers that do not install packages (Qooler): the `feather-page` CLI as one Node file, and the web bundle: `feather-page.css` with every block's and edge's classes and the foundation fonts as files, and `feather-page-runtime.js`, which hydrates a page `feather-page build --runtime` wrote (motion, the loader, the menu, the Living Page) or mounts a page document anywhere (`mount(el, doc, { tokens, onAsk, blocks })`: `onAsk` is the host's model for the Living Page, `blocks` the brand's own block designs; `hydrate` takes the same). Built by `apps/release`. | `node feather-page-<version>.mjs init|validate|routes|build` (the templates are bundled in), `import { mount, hydrate } from "./feather-page-runtime.js"` |

`@aleeforoughi/feather-documents` (document templates and the render kit) is private and not published.

## How they depend on each other

Dependencies point one way, and the hygiene gate holds them there.

- `feather-tokens`, `feather-intent` and `feather-context` have no Feather dependencies.
- `feather-liquid` imports only intent and context. `feather-dialog` imports intent and liquid.
- `feather-react` imports only tokens. It never imports the IR: an organism mirrors a node's fields by convention.
- `feather-manifest-web` joins them: context, dialog, intent, liquid, react and tokens.
- The website layer stacks: `feather-expression` reads tokens; `feather-living` adds expression and intent;
  `feather-page` adds living.
- Nothing in Feather calls a model, stores a person, or imports a product.

React 19 is a peer dependency of every package that renders; Tailwind CSS v4 is a peer dependency of
`feather-react`.

## Not packages

| Where | What |
|---|---|
| `apps/storybook` | Every component in every reference brand, the Foundations pages and the theme builder; home of the accessibility and visual suites. |
| `apps/showcase` | The component sheet and the three reference sites, built against the packages exactly as a product would. |
| `apps/playground` | One experience in four contexts, with the plan and the trace. |
| `conformance` | IR fixtures, the cross-body suite, the Python parity corpus. |
| `examples/python-caller` | A complete caller in one file of standard-library Python. |
