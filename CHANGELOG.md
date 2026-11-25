# Feather — changelog

## 1.21.0 — 2026-11-25

**Wave 3: sound, the pointer, and micro-motion on every atom.** Sound that is off until the person turns it on,
pointer interactions that never hide the native cursor, and a finished press, toggle, loading, success and error on
every interactive atom of product UI, with no box moving and nothing changing at rest. Values come from the award
winners' shipped code (Qooler file 27 sections 7 and 8); the code is Feather's own, on the Web Audio API with no new
dependency.

### Sound (`@aleeforoughi/feather-expression`)
- **`createMixer` / `getMixer`:** one Web Audio graph with three buses (`bed`, `effects`, `ui`), a master, a low-pass
  and a compressor (-6 dB, ratio 12).
  - Files load once, in stages.
  - One-shots are rate-limited to 5 a second.
  - Loops fade, buses duck, and an overlay muffles everything (20 kHz to 100 Hz over 400ms).
  - `bands(n)` drives audio-reactive visuals.
- **When it sounds:** nothing exists before a gesture, the tab going hidden silences it at once, and every call is a
  safe no-op without Web Audio.
- **`SoundToggle`** now goes through the page's mixer, and its bars follow the sound. It is the one mute, always in
  the nav when a page has sound.
- **`SoundScene`:** a section's loop fades in while the section fills the view.
- **Hooks:** `useSoundCue` gives hover and press sounds (never on touch hover or key repeat). `useMuffleWhile` muffles
  while an overlay is open, and the OverlayMenu uses it.

### Pointer
- **`Cursor` states:** any element can say `data-cursor="view|drag|play|link"` with an optional label. The follower
  grows and labels it, never on fields, and the native cursor always stays.
- **New components:**
  - `PointerTilt`: leans toward the pointer, 8° by default and 12° at most; keyboard focus lifts it instead;
  - `PointerField`: items yield within 300px, with falloff 1-(d/r)²;
  - `PointerTrail`: a pool of 8 to 12 decorative images follows the pointer, at loudness 3;
  - `UnderlineLink` and `RollText`.
- **Where they run:** only on fine pointers, with motion allowed, from loudness 2.

### Micro-motion on every interactive atom (`@aleeforoughi/feather-react`)
- **Press:** goes in fast and releases over the hover duration; transform only.
- **Toggles:**
  - checkbox checks draw on, and radio dots grow in;
  - switch thumbs spring with the brand's bounce only where its theme overshoots (playful brands); everywhere else they
    keep the one curve;
  - tabs and accordion chevrons move on the motion roles.
- **Loading:** `Button` `loading` (`aria-busy`, still focusable, presses ignored, its box unchanged, a spinner in its
  own colour).
- **Errors:** fields shake once by 3px as `aria-invalid` arrives, and `FieldError` fades in.
- **Success:** the new `FieldSuccess` (`role="status"`) draws its check.
- **Menus:** menu marks draw on, and the success toast's icon draws.
- **Tooltip:** leaves on its fast duration.
- **Proof:**
  - every touched atom's existing stories are pixel-identical at rest (296 compared);
  - the rendered audit passes on all 79 touched stories in all 7 themes (553 runs: no box moves on hover or focus);
  - reduced motion keeps the feedback as colour and an instant press.
- **New stories:** `States` stories show each moment.

### Fixes
- **The clock kept doubling its pending frames.** A tick that schedules the next frame from inside a frame, which is
  how the World renders on demand, requested a frame of its own on top of the loop's. Pending frames doubled every
  frame and each tick saw a zero delta, which kept render-on-demand scenes from settling and the quality ladder from
  measuring. There is now exactly one pending frame, and a test holds it (shipped since 1.18).

- **The web bundle works under any path.** `feather-page.css` pointed at its fonts from the site root (`/fonts/…`),
  so a host serving the bundle under a path lost every face. Its `url()`s are now relative to the stylesheet, and
  CI fails on any root URL or any font file missing beside it.

### Pages
- **`cursor` page knob:** `native` by default, or `follower`, which labels the work links. A page without it renders
  byte for byte as before.
- **The loud reference page** has a sound bed (a pad generated for the showcase) and the follower.
- **e2e:**
  - sound is off by default;
  - the toggle is in the nav, reached by Tab, and remembered;
  - the follower labels work links and never hides the native cursor;
  - there is no follower under reduced motion.

## 1.20.0 — 2026-11-25

**Wave 2: type, scroll, variety and a product you can pick up.** Kinetic type, scroll choreography, three more route
transitions, `feather-tokens/4` with loudness, the page knobs and a variant set for every block, so directions differ
by more than their brand. The release now ships the page runtime itself, and the docs, Storybook and a theme builder
make Feather read as one organised product. Values come from the award winners' shipped code (Qooler file 27
sections 7 and 8); the code is Feather's own. The owner accepted the plan's decisions
([docs/proposals/2026-11-24-range.md](docs/proposals/2026-11-24-range.md) §10), and FEATHER.md now holds the
clean-room rule and the pattern-request intake.

### Type and scroll (`@aleeforoughi/feather-expression`)
- **`DisplayTitle` `effect`:** `rise`, `mask`, `skew`, `oval`, `blink`, `scramble` and `swap` (with `words`,
  `interval`, `paused`, `trigger`). The text is always one accessible name and complete without script; under
  reduced motion the title is plain.
- **`Stage` `steps` and `snap`:** pinned storytelling. The steps stack in flow without script or motion, and a pin is
  never longer than 4 viewports.
- **`ScrollLayers`:** `parallax`, `stack`, `horizontal` and `scale`.
  - The horizontal track is a native snap rail on touch and under reduced motion, and never takes over the wheel.
  - The scale caption stays outside the clipped layer.
- **`ImageSequence`:** scroll-scrubbed canvas frames.
  - Frames load in priority order: first and last, then midpoints.
  - The poster with its alt is the no-script, reduced-motion and data-saver form.
  - It uses the capped pixel ratio and sleeps when off screen or hidden.
- **Route variants:** `slide`, `sheets` and `circle` (from the last tap), with `POINTER_WINDOW`.
- **Loudness:** `loudnessOf(el)` and `allows(level, what)`. Section reveals, kinetic effects, pins and sequences,
  and World scenes each ask for their level, and fall back to their static forms below it.
- Storage is read on first use, never at import, so a server render or a CLI never touches it.

### `feather-tokens/4` (`@aleeforoughi/feather-tokens`)
- Additive: `/2` and `/3` theme CSS is unchanged byte for byte, which the golden themes prove.
- **`loudness`** (0–3) becomes `--loudness`.
- **Colour blocks:** `colors.blocks` (up to 4 surface and ink pairs, each at 4.5:1) give `bg-block-N` and
  `text-block-N-ink`.
- **Media text:** `colors.mediaScrim` and `colors.inkOnMedia` give `bg-media-scrim` and `text-ink-on-media` (the
  scrim rises until the ink holds 4.5:1). `bg-scrim` stays the dialog scrim.
- **`personality`** (calm, precise, playful, cinematic) sets pace and signature together; anything written
  explicitly wins.
- **House layers and opacity:** `z-layer-*`, `opacity-dim` and `opacity-muted`.
- **Matched fallbacks for foundation families:** each of the 15 gets a metric-matched fallback face, so a `/4` theme
  swaps fonts without a shift. `src/fallbacks.mjs` is generated from the installed font files.
- **`LATEST_SCHEMA`:** the reference themes Studio, Portrait and Seed are now `/4`. `feather-brand --migrate --to 4`
  upgrades a file only if the result builds.
- **`feather-font add <family>`:** any open font, self-hosted with a fallback matched to it.
  - It downloads the font once from Fontsource into a cache and prints its licence.
  - The fallback is matched to the width of English text and to the font's vertical metrics.
  - It can write the result straight into a brand file.

### Variety (`feather.page/1`, `@aleeforoughi/feather-page`)
- **Knobs:**
  - page level: `loudness` and `defaults`;
  - every block: `variant`, `loudness`, `tone` (including block-1..4), `space`, `scale`, `align`, `crop`, `motion`
    and `scroll`;
  - new codes `unknown-variant`, `out-of-range`, `unsupported` and `contradiction`;
  - `/0` pages render byte for byte as before.
- **Variants for every block:**
  - hero: stacked, giant-type, split, film, product, index;
  - statement: plain, centred, offset, marquee, fill, swap;
  - work: grid, hover-list, stack, rail;
  - case: editorial, scale;
  - numbers: counter, plain, lead;
  - process: list, pinned, rows;
  - logos: grid, marquee;
  - quote: large, rail, pull;
  - offer: cards, table;
  - timeline: list, horizontal.
- **The loud reference page:** `examples/studio-of-one-loud.page.json` is the reference page at loudness 3, served at
  `sites.html?page=loud`.
- **Fixes:**
  - The static build never writes the loader (it hung at 0% with nothing to mount it).
  - Pages now emit the brand's own `@font-face` rules (open fonts never loaded before).
  - Footer and nav links are at least 48px wide as well as tall.
- **`feather-page build --runtime <href>`:** pages hydrate with the release runtime, so the loader, the menu, the
  motion and the Living Page all run.

### The page runtime as release assets (`apps/release`)
- `feather-page-<version>.mjs` is the CLI as one self-contained Node file.
- `feather-page-web-<version>.zip` holds `feather-page.css` (every block and edge, with the foundation fonts as
  files) and `feather-page-runtime.js` (`hydrate`, `mount`, `validatePage`).
- CI builds the CLI and runs it standalone.

### A product you can pick up
- **README:** a front door.
- **Guides:**
  - `docs/getting-started.md`: install, theme, first page, first product screen, Python;
  - `docs/theming.md`: the brand file from primitives to roles to component tokens, the axes, loudness, fonts, what
    the engine refuses;
  - `docs/packages.md`: every package, its entry points and the release assets;
  - `docs/patterns.md`: which catalog patterns are built, and in which release.
- **Storybook:**
  - The sidebar runs Foundations, Atoms, Molecules, Organisms, Experiences, Website, Living, Pages.
  - Foundations pages: Introduction, Tokens (live swatches of the current brand), Motion, Loudness, Three tiers,
    Accessibility floor.
  - Theme builder: build a brand live, see every problem the engine reports, preview real components and blocks, and
    copy or download the JSON.
  - Block variants appear in real brands with real content.
- **Issue template:** `.github/ISSUE_TEMPLATE/pattern-request.yml`.

## 1.19.0 — 2026-11-24

**Wave 1: the page edges, and the runtime under them.** The moves the 2026 award winners name most (Qooler file 27
sections 6 and 7: of 492 winning sites, page transitions 49, loaders 47, 404 scenes 45, intro scenes 37, the
overlay menu 36, the footer 32), each a finished block in every brand, with the access work the winners skip built
in: a keyboard path, labels, a no-script tier, a reduced-motion tier, and pausing while hidden. Values come from the
winners' shipped code; the code is Feather's own. The plan for the waves after this one is
[docs/proposals/2026-11-24-range.md](docs/proposals/2026-11-24-range.md).

### The edges

- **`Loader`** (`@aleeforoughi/feather-expression`):
  - `counter` is an honest percentage that lifts off with a curved wipe;
  - `dock` is a bar that fills along a stop-and-go curve and moves into the header (`[data-loader-dock]`);
  - with `sound`, it asks Sound off / Sound on at the end; off is first and focused;
  - it is `role="status"` with a label, holds the page `inert` and still while it shows, and is never shown without
    script (`noscript:hidden`) or under reduced motion.
- **Route transitions:** `createTransitions().go(update, { variant })` takes `view`, `push`, `columns`, `fade` or
  `none`.
  - `view`: the old page recedes to 0.9 while the new one wipes up, 0.95s on `--ease-wipe`;
  - `push`: the old page drifts up 25vh under a veil while the new one rises, 1.2s on `--ease-push`;
  - `columns`: four columns cover the page and lift off the new one, 0.06s stagger, each leg within the 1.2s cap.

  Every variant is instant under reduced motion. On arrival, focus moves to the new `h1` and its title is announced.
  `view` and `push` are CSS on the view-transition pseudo-elements (foundation.css), so cross-document transitions
  get them too.
- **`OverlayMenu`:** a minimal bar whose Menu opens a full-screen list of large links. Without script it is a plain
  list. Open, it is a modal dialog: focus trapped, Escape, the rest of the page `inert`, focus returned. A clip
  reveal and masked link rise, or a fade under reduced motion.
- **`SoundToggle`:** one ambient bed, off until the person turns it on, `aria-pressed`, remembered, silent while
  the tab is hidden.
- **`Footer`** (`plain`, `wordmark` set to the full width, and `reveal`, which waits behind the page; focus moving
  into it scrolls the page to its end so a focused link is never covered) and **`NotFound`** (`type`, `minimal`)
  in `@aleeforoughi/feather-page`.

### `feather.page/1`

- Top-level edges `nav`, `footer`, `notFound`, `loader`, `transition` and `sound`. Every `/0` page is still valid.
  An edge on a `/0` page reports `needs-schema-1`. The new field kinds are `enum` and `boolean`.
  `schema/feather.page-1.json` is generated beside `-0`, which is unchanged.
- `FeatherPage` places the loader, the nav before `main` and the footer after it. A page without edges renders as
  before. `PageNotFound` serves the 404, and `feather-page build` writes `404.html`.
- Static builds get cross-document View Transitions when the page names a `transition` (off under reduced motion).
- `mountPage(...).swap(node)` commits a route's new page at once, for the update inside `go()`.
- `PAGE_SCHEMA` is now `feather.page/1`. `PAGE_SCHEMAS` lists both.

### The runtime (`@aleeforoughi/feather-expression/core`)

- **The clock:** a tick never sees more than 1/20s (`MAX_DELTA`).
- **Pixel budget:** `cappedPixelRatio(quality, dpr, width, height)` keeps the tier cap and adds a budget. A canvas
  never draws more than 2560×1440 pixels (`PIXEL_BUDGET`) or drops below a 0.5 ratio.
- **`createQualityLadder`:**
  - steps down below 50fps (measured over 1s);
  - tries one step up after 10s of comfort, doubling the wait after a failed try;
  - never measures while hidden, and reports when the last level still struggles.

  `createWorld` runs one, through the renderer's new `levels` and `setLevel`, or by lowering its own pixel ratio in
  three steps.
- **`capabilityGate` and `retire`:**
  - the heavy tier needs more than 4 cores and more than 4 GB, a fine pointer, WebGL, no data saver and no reduced
    motion;
  - a retired effect stays on the light tier for 30 days.

  `World` gates itself (the `gate` prop) and retires itself when its ladder runs out.
- **`perFrame`:** one task per frame. `WorldRenderer.prewarm()` and `world.prewarm()` compile shaders behind the
  loader; `World` hands its controller over through `onWorld`.
- **`honestProgress`:** shows the lesser of real readiness and elapsed time over a minimum (2.4s first, 1.4s on
  return), capped at 8s.
- **Sound:** `createSoundPreference`, `sound` and `playBed`.
- **Visibility:** `isHidden` and `onVisibilityChange`.

### Foundation

- The page-change curves `--ease-wipe`, `--ease-route` and `--ease-push`.
- The `scripting:` and `noscript:` variants for the no-script tier.

### Gates

- `apps/showcase/e2e/edges.spec.ts` covers:
  - the menu's keyboard path, and its no-script tier;
  - both loaders: label, inert, the cap, never under reduced motion;
  - all five route variants: arrival, focus, nothing left behind, instant under reduced motion;
  - the footer's reachable links;
  - the 404 in three brands with axe.
- The showcase sites now carry the nav, the footer and a `view` transition, and still meet the mobile budgets.
- New stories: `Website/Loader`, `Website/OverlayMenu`, `Website/SoundToggle`, `Pages/Edges`.

## 1.18.0 — 2026-11-24

**Website craft.** Feather can now build award-grade websites and the Living Page, from the same tokens, without
touching product UI. Brand motion lives only in the new expression roles; product UI keeps `--ease-standard`. The
IR stays `feather.ir/0`. Spec: Qooler's proposal of 2026-11-21 (website craft), evidence in its file 23.

### W1. `feather-tokens/3`

Additive. `migrateTokens` reads `/2` and `qooe-tokens/1` unchanged, and a `/2` brand's theme CSS is byte for byte
what it was (the golden themes prove it). The expression block is written only for a document that says
`"schema": "feather-tokens/3"`. The rules are in [docs/visual-system.md §14](docs/visual-system.md).

- **Open type:** `fontFamily.display | body | mono` and `voiceFace` take a font object. Fonts are self-hosted
  WOFF2 only, with a metric-matched local fallback (`size-adjust` and the ascent, descent and line-gap overrides).
  Only display faces may be preloaded: `buildTheme().preload`, and `feather-brand` writes `brand-preload.html`.
- **The fluid display scale** `xl | l | m | s`, compiled to `clamp()` between 360 and 1440px, with fluid tracking
  that tightens as the type grows. Bounds are checked. New utilities: `type-display-*`, `font-voice`, `text-prose`
  and `numeric`.
- **Type features:** `tabularNums`, `balanceTitles` and `prettyBody`, all on by default.
- **Motion:**
  - a `signature` curve (`expo-out`, `quint-out`, `sine-out`, `scout`, `sheet`, `standard`, or a bounded custom
    cubic-bezier);
  - `overshoot`, off by default and capped at `(.34, 1.56, .64, 1)`;
  - `pace: calm | snappy | cinematic`. Cinematic stretches only the expression roles;
  - the expression roles reveal, media, scene, stagger, hover-out and spring (`motion-reveal`, `motion-media`,
    `motion-scene`, `motion-hover-out`), each with a reduced-motion mapping (a 150ms cross-fade or nothing) that a
    brand can only make quieter. Every sequence ends within 1.2s.
- **Axes:** `contrast` (`quiet` 500 / `bold` 700 display), `surface` (`flat`, `paper`, `glass` with an 8 to 30px
  overlay blur, `film` with one grain), and `focus` (`accent` by default, checked at 3:1; a migrated brand keeps
  `primary`). New utility `focus-ring`.
- `schema/feather-tokens-3.json`, the `/3` types, and three `/3` reference themes: `studio`, `portrait` and `seed`.

### W2. `@aleeforoughi/feather-expression`

A new package, the website layer ([docs/expression.md](docs/expression.md)). It has a framework-free core
(`/core`: no React and no dependencies), with thin React bodies over it.
- **Primitives:** `Section`, `Stage`, `Split`, `Grid`, `Bento`/`BentoCell`, `DisplayTitle`, `MediaFrame`, `Marquee`,
  `Reel`, `Counter`, `Magnetic`, `Cursor`, `ScrollProvider`/`ScrollProgress`, `TransitionProvider`/`PersistentSlot`
  and `World`. Each has stories (`Website/*`), tests and a reduced-motion path.
- **One clock** (`core/clock.ts`), the only `requestAnimationFrame` in the layer. It runs only while something is
  subscribed, and rides GSAP's ticker when a site has one. Lenis (lerp 0.1, native on touch) and GSAP are the site's
  own; Feather wires them, with `lagSmoothing(0)`.
- **World:** the device pixel ratio is capped per tier (2, 1.5 or 1), with quality tiers from device hints. It
  renders on demand, pauses off screen and in a hidden tab, and shows a still under reduced motion.
- `formatCount` keeps one `Intl.NumberFormat` per locale and decimals; it built a new one on every frame.
- **New foundation utilities:** `page-grid`, `section-space-*`, `rounded-concentric`, `rounded-inset`, `media-edge`,
  `overlay-surface`, `film-grain`, `motion-marquee` and `composer-edge`.
- **Gates:**
  - the hygiene gate scans the website packages with Gate 1, plus new rules: `scale-zero`, `dpr-cap`, `raf`,
    `reduced-motion`, `focus-visible` and `lcp-lazy`;
  - the rendered audit stays product UI's law and skips the `Website/*`, `Living/*` and `Pages/*` stories;
  - Storybook gains the three `/3` themes. In `soft`, where the control radius is already xs, the tooltip's arrow
    and key cap now use `rounded-inset` (one step under the control, so square there), as `radius.nesting` requires.

### W3. `@aleeforoughi/feather-living`

A new package, the Living Page shell ([docs/living.md](docs/living.md)). The host streams events; Feather renders
them and keeps nothing.
- `Composer`: the disclosure line is visible before the first word and describes the field (EU AI Act, Article 50).
  Send turns into Stop in the same place. Enter sends, and IME composition never does.
- `LivingTurn`: a named phase before the first word (never typing dots), the spoken line in the voice face word by
  word, one to three blocks, next asks, and a fold to a receipt that reopens.
- `LivingPage` and `useConversation`:
  - a turn is inserted after the section in view;
  - the question anchors at the top;
  - the page follows only while the reader is at the bottom, and Jump to latest shows only away from it;
  - "Back to the page" folds every turn.
- `Presence`: the brand's slot, which leans in while thinking.
- The block registry (`createRegistry`, with IR nodes mapped to blocks).
- Prepared scenes: `matchPrepared`, `preparedRoutes` and `PreparedSceneView`, as static routes that work with the
  model off.
- A pure core (`conversationReducer`, placement, registry, prepared scenes, disclosure), with stories (`Living/*`)
  and tests.

### W4. `feather.page/0` and `@aleeforoughi/feather-page`

Websites from a schema ([docs/page.md](docs/page.md)).
- `src/core/spec.ts` is the one table of the 13 blocks. The block set is the Living Page library, and a test holds
  the two equal. `validatePage` reads the table and also checks library references, unique ids, safe links and
  media, alt text, scene sizes, prepared scenes and the honesty floor (a living page names its speaker).
  `schema/feather.page-0.json` is generated from the table.
- A default block library built on the expression primitives: hero, statement, work, case, numbers, timeline,
  process, logos, quote, offer, faq, contact and signature. A brand overrides any block.
- `FeatherPage` renders a whole site in the brand's tokens, with the Living Page layered on when the document has
  one. Hero starters play the prepared scenes. `PreparedPage` renders a scene as its own route.
- The `feather-page` CLI: `validate`, `routes`, and `build` (static HTML, one route per prepared scene, readable
  with no script).
- `mountPage(container, node)` puts a page on screen: it renders in a React transition, so the long first render
  yields to the main thread. A plain `root.render` of the reference page built it in one long task: TBT 208 to
  216ms on the 4× throttled phone profile in CI, over the 200ms budget.
- `useLivingAsk()` in `@aleeforoughi/feather-living` lets a block in the base page ask.
- **Showcase:** `apps/showcase/sites.html` renders one document (`examples/studio-of-one.page.json`) in Studio,
  Portrait and Seed. Only the tokens change.

### W5. Gates

- **Hygiene (Gate 1):** the website rules `scale-zero`, `dpr-cap`, `raf`, `reduced-motion`, `focus-visible` and
  `lcp-lazy`, together with Gate 1 over the three website packages (in W2). `transition: all` was already a rule.
- **`pnpm test:sites`** runs the showcase sites, in every brand, on a 4× CPU-throttled phone profile:
  - LCP ≤ 2.5s, CLS ≤ 0.1 and TBT < 200ms;
  - a scroll performance trace with a median of at least 55fps;
  - axe (WCAG 2.2 AA), one h1, the native cursor and a focus-visible ring;
  - nothing moving under reduced motion;
  - the LCP image is never lazy.
- **CI:** a `sites` job runs it, plus Lighthouse CI on the same budgets (`apps/showcase/lighthouserc.json`).

## 1.17.0 — 2026-10-05

**The experience lifecycle (milestone L6).** An experience now lives as long as its purpose: it opens, changes in
place while the work behind it moves, ends, and collapses to what it leaves behind. Feather stays pure: the caller
owns time and state and sends small updates, and nothing about the person is kept. The contract is
[docs/lifecycle.md](docs/lifecycle.md).

- **IR:**
  - two optional fields: `revision` (0 when opened, one more with each update) and `resolved` (`outcome`, a one-line
    `summary` of at most 120 code points, and an optional `artifact` with `label`, `href` and `kind`);
  - a resolved experience may have no nodes, and takes no replies (`validateReply` answers `resolved`).
- **Updates, `feather.update/0`:**
  - ops `add` (after a node, or at the end), `replace`, `patch` (`null` removes a field; never `id` or `type`),
    `remove`, and `resolve` (always last);
  - `applyUpdate(experience, update)` is pure and all or nothing, and re-validates what it makes. Problems in the
    result are reported under `/result`;
  - new codes: `stale-revision`, `wrong-experience`, `empty-update`, `unknown-op`, `unknown-node`,
    `already-resolved`, `after-resolve`;
  - a generated JSON Schema, `schema/feather.update-0.json`.
- **Composer:** a new rule, `lifecycle`. `plan.revision` and `plan.lifecycle` (`open` or `collapsed`); a collapsed plan
  carries `plan.resolution` and nothing to act on, focus or read but its summary. It still follows the person's body.
- **Every body changes in place** (web, switch, text and voice; conformance proves the same replies in all four):
  - the person keeps their place: surviving nodes keep their state, and focus never moves on an update;
  - **safety:** an update that changes or removes an armed irreversible act disarms it and says so; confirming then
    commits nothing;
  - what is new is told once, politely ("New: approve the booking."), and progress is never announced every tick;
  - collapse: the summary and the artifact, with the artifact a link only when it is http(s). Switch keeps the link
    as its only target;
  - a lower revision is ignored, the same one replaces;
  - an open experience with nothing to act on waits for its next update (`Dialog.resolved`).
- **Python (`feather-sdk`):** `apply_update`, the `update()` builder and op helpers (`feather_sdk.ops`), and
  `experience(revision=, resolved=)`. They match TypeScript case for case on a new parity corpus: 273 update
  cases, plus lifecycle cases in the IR and reply corpora.
- **Embed:** `mount()` returns `apply(update)`. It applies the update to what is shown and renders in place, or keeps
  what is shown and calls `onIssues`. It returns the result either way. `onIssues` now receives update issues too:
  a TypeScript caller that typed its callback `Issue[]` widens it to `Array<Issue | UpdateIssue>`.
- **Playground:** a "Stream" view plays the streamed trip in any body, with Next update, Restart and a Play control
  that never starts on its own and pauses at the approval. A paste box applies your own update, and shows
  `stale-revision` and the other refusals. The L6 exit test runs there end to end: progress, recommendation,
  approval, then only the summary and the artifact remain.
- **Stories:** Experiences/Lifecycle shows each stage of the streamed trip.
- **Conformance:**
  - `conformance/update`: the streamed trip (progress → recommendation → approval → done), and 13 refused updates
    with their exact issues;
  - two resolved IR fixtures, and five invalid ones.

## 1.16.0 — 2026-10-05

**Person-shaped (milestone L5).** The same experience now follows how a person likes to work and what they can do
right now, in every body, without Feather keeping anything about them.

- **Context** (`@aleeforoughi/feather-context`):
  - `persona.autonomy`: `ask`, `suggest` (the default) or `delegate`, and it can be `learned`;
  - `capability.reading`: `plain`;
  - `capability.temporary`: `eyesBusy`, `handsBusy` and `noisy`. These are needs that hold for now, as binding as
    lasting ones while they hold.
- **Composer** (`@aleeforoughi/feather-liquid`), two new rules and three routing cases:
  - **autonomy.** With `ask`, a reversible prediction shows as a note and nothing is preselected for the person.
    With `delegate`, other ways to go fold behind one "Other options" disclosure (`PlanNode.collapsed`). It never
    folds anything beside an irreversible primary act or a critical node, and never touches an irreversible Choice.
  - **reading.** Plain reading keeps detail closed (critical detail still shows) and folds other ways to go, above
    the person's own settings.
  - A person who cannot speak is never routed to voice: with no screen they get text, and confirm by typing.
  - Busy eyes or hands route to voice when speech works both ways.
  - A noisy room makes every cue text.
- **Reference personas and capability profiles.** `REFERENCE_PERSONAS` has five: delegator, deliberate,
  touch-first, calm and switch-preferred. `REFERENCE_CAPABILITIES` has six: low-vision, low-precision,
  no-screen-speaking, no-screen-typing, plain-reading and hands-busy. Each is proven to change the plan:
  - fewer acts in view;
  - larger targets;
  - a voice or text route;
  - AAA contrast.
- **Privacy.** Tests prove that composing never changes the context, writes no globals, logs nothing, carries
  nothing from one render to the next, and keeps no persona object in the plan.
- **Every body folds the same way:**
  - **Web:** one "Other options" button, whose contents are not rendered until it is opened.
  - **Text and voice:** one "Other options" choice after every act.
  - **Switch:** that button is one target.
  - **Conformance:** a folded Alternative reaches the same reply in all four bodies.
- **AAA contrast is delivered.** Every theme ships a `[data-contrast="AAA"]` block (`AAA_FLOORS`), and a low-vision
  plan now gets 7:1 text instead of a hint:
  - secondary text, the destructive red and the primary move toward the text color until they reach 7:1;
  - the a11y suite checks every story that renders an AAA plan with axe's enhanced contrast rule.
- **Playground:** a "By person" tab. Pick a reference persona, a capability profile and a device; the plan renders
  live in its body, with what each one changes and the trace filtered to the rules a person shapes. The choice is
  never stored or put in the URL, and an end-to-end test proves it.
- **Stories:** Experiences/Person-shaped (low vision on five fixtures, deliberate, touch-first) and a delegate flight
  search.
- **Docs:** `docs/composer.md` (context, rules, `collapsed`, AAA on the web), `docs/manifestations.md` (collapsed
  nodes in every body) and `docs/visual-system.md` (AAA contrast).

## 1.15.2 — 2026-10-05

**Destructive text reads on its tint, at rest and on hover.** The destructive Button and Badge laid their red text on
`bg-destructive/10` and hovered on `bg-destructive/20`, opacities outside the visual system; on the 20% tint the
light default red fell to 4.4:1 (the gap 1.15.1 left open). Normalized, not redesigned: the same red on the same
kind of tint, now from tokens.

- **Tokens:**
  - a new `--destructive-muted-hover` (Tailwind `bg-destructive-muted-hover`): the strongest mix of the red into
    `--card`, from 20% down to 14%, that keeps `--destructive` at 4.5:1;
  - the rest tint is `--destructive-muted` (12%, unchanged).
- **Engine:** `CONTRAST_FLOORS.destructive` now checks `--destructive` on `--background`, `--card`, and both tints
  laid on either. A red that misses it at rest is still refused; one that holds at rest but not at 20% hovers on a
  lighter tint instead (rich-brand's `#B91C1C` hovers at 19%, as it reaches 4.49:1 at 20%). New exports:
  `DESTRUCTIVE_TINTS` and `oklabMix`.
- **Components:**
  - Button and Badge (destructive): `bg-destructive-muted`, with `bg-destructive-muted-hover` on hover.
  - DropdownMenu's destructive item focuses on `bg-destructive-muted`, not `bg-destructive/10`.
- **Docs:** the floor and the tints are in `docs/visual-system.md` section 5.
- The destructive stories change, so their visual baselines are re-recorded.

## 1.15.1 — 2026-10-04

**The 1.7.0 accessibility debt is paid, and the size target is a gate.**

- **Destructive contrast.** A theme that names no `destructive` color got `#e5484d`, which reaches only 3.7:1 on a
  light background. The atoms set error and destructive text in it (Badge, Button, Field), so paper-sharp failed
  `color-contrast` in four stories. The default red is now chosen per side of the theme: `#b42318` on a light
  background and `#ff6b62` on a dark one, the same reds as `foundation.css` and the default theme.
- **A new contrast floor:** `--destructive` reaches 4.5:1 on the background, the surface and its own 12% tint
  (`CONTRAST_FLOORS.destructive`). A brand red that misses it is refused with the ratio it reached. A brand red
  between about 4.0:1 and 4.5:1 that built before is now refused; pick a darker red on a light background.
  - Not covered yet: the hover tint of the destructive Badge and Button (`bg-destructive/20`, an opacity outside the
    visual system) brings the light default to 4.4:1 over paper-sharp's background. The fix is to put those tints on
    tokens in the atoms, in a later release.
- **`a11y-known.json` is empty.** No accessibility debt remains in either reference theme.
- **Size gate:** `pnpm size` (in CI after hygiene) bundles `liquid` and `manifest-web` as a product would, minified
  and gzipped, with React and the component library left out. Budget: 60 KB (PLAN.md section 9). Today: 29.7 KB.
  It also prints the figure with the component library bundled in, 176 KB, which is not gated.
- Visual change: paper-sharp and void-pill render their destructive parts in the new reds, and their baselines are
  re-recorded. feather and feather-dark name their own reds and do not change.

## 1.15.0 — 2026-10-04

**Form: several answers, one act.** A caller that asked several things with separate Inputs gave the person a "Send
answer" button per field. An answer that was typed but not sent was lost silently when the person pressed the main
action, and a sent answer showed no confirmation. Godpip's first Feather integration ran into this. A Form makes it
impossible.

- **IR: `Form`** (content, act, may be primary):
  - an optional `prompt`;
  - `fields`, each asked exactly as an Input of its kind is (same kinds, `required`, `min`/`max`, `maxLength`,
    `currency`), with an optional `group` heading;
  - an optional `submitLabel`.

  It takes two acts:
  - `submit`, with an object from field id to answer;
  - `skip`, only when no field is required.

  Fields left out were not answered. Every required field is present, and at least one field is answered.
- **Validation:**
  - a new code, `duplicate-field`;
  - each field obeys the Input rules;
  - the JSON Schema now also says that a money Input or field needs a currency.

  Replies are checked field by field with the Input's own checks. Python matches TypeScript on the regenerated
  parity corpus: 2501 experiences and 3655 replies.
- **Composer:** with nothing marked primary, a Form ranks after a Choice and before an Input.
- **Web: `FormGroup`** (organism):
  - one `<form>`, one submit button, and Enter submits;
  - field groups under headings, and "Optional" or "Required" in words;
  - inline errors with focus on the first one, and nothing is sent until every answer is valid;
  - after sending, the answers stay visible, read-only, with "Sent. N answers were sent.";
  - a reply the page refuses keeps the form open.
- **Text and voice:**
  - The fields are asked in turns inside one act, with group headings announced.
  - Optional fields can be skipped, and a required one is re-asked with the reason.
  - A read-back lists every answer. The person sends it, or changes one by number or name.
  - Only then is one reply produced.
  - Voice understands spoken numbers, amounts, phone digits and spelled email or URL symbols.
- **Switch:** a sent form leaves nothing to scan.
- **Conformance:** the form fixtures and a synthetic one with every kind reach the same reply in web, switch, text and
  voice, each submitted with a field left out, with every field answered, and skipped where that is allowed.

## 1.14.0 — 2026-10-03

**Callers can use Feather.** A system that decides what a person must do, Godpip first, can now install Feather and
use it without React, npm or a build step. The guide is [docs/callers.md](docs/callers.md).

- **`feather-sdk` (Python 3.11+, no dependencies)**, a wheel attached to every release from now on:
  - `experience()` and one typed builder per node type (`feather_sdk.nodes`, generated from spec.ts with the field
    docs);
  - `validate()`, `validate_reply()` and `format_issues()`;
  - `static_dir()`, the browser bundle shipped inside the wheel, so the server and the page are always one
    version.
- **The Python validators are Feather's validators.** They give the same issue codes, JSON Pointer paths, order,
  messages and issue limit as the TypeScript ones. A parity corpus, written from the TypeScript validators by
  `packages/intent/scripts/parity.ts`, proves it on every conformance fixture plus 2389 generated experiences, 3512
  replies and 94 URLs. A test fails when the corpus is stale.
- **`@aleeforoughi/feather-embed`**: Feather in any web page with one `<script type="module">` import.
  - `mount(element, experience, { context, theme, onReply, onIssues })` returns `update()`, `unmount()` and
    `ready`. It is also published to GitHub Packages.
  - The bundle is self-contained: React and Base UI are inside it. It weighs 254 kB gzipped, plus 16 kB of CSS.
  - It leaves the host page alone. Styles and CSS variables are scoped to `.feather-root`, and popups open in one
    scoped layer.
    - Nothing is written to `<html>`, `<body>` or storage.
    - `unmount()` restores the document exactly.
    - A test checks this against Godpip's own stylesheet.
- **Popups can be given a container:** `FeatherProvider portalContainer`, or `FeatherPortalProvider`. Every Feather
  popup (select, menu, popover, tooltip, dialog, sheet, navigation) uses it.
- **Reference caller:** `examples/python-caller` is a complete caller in one file of standard-library Python. CI runs
  it end to end on the installed wheel, and the server accepts only validated replies.
- **Gates.** CI adds the Python SDK on 3.11 and 3.13, and a callers job: the embed in a foreign page, and the
  reference caller on the wheel. Publish attaches the wheel to the release.

## 1.13.1 — 2026-10-03

*Not released on its own; it ships in 1.14.0.*

**JetBrains Mono everywhere.** Every font Feather sets on its own is JetBrains Mono.

- `font-mono` (code, data, the playground's IR editor and plan) is JetBrains Mono. It used to be the platform's
  monospace (SF Mono, Menlo, Consolas), which differs from the body text.
- The fallbacks behind the brand fonts (`--font-sans`, `--font-heading` and the heading roles) are JetBrains Mono
  instead of Geist. foundation.css no longer bundles Geist; a brand that picks Geist still gets it through
  `brand-fonts.css`.
- Storybook's own chrome and its docs pages use JetBrains Mono and the default theme's black and white, instead of
  Storybook's Nunito Sans.
- The showcase's brand sets JetBrains Mono for display and body.
- **Dropdowns match the controls.**
  - The playground's selects were native `<select>`s with their own classes: 32px tall, a 10px corner, 8px padding
    and 14px text. They are now Feather's `Select`, on the same control frame as inputs and buttons (44px, the
    control radius, the control padding), and their open list follows the system rather than the operating system.
  - In Feather itself, select items now use the trigger's 16px type, not 14px. Select, dropdown-menu and navigation
    items are `min-h-control` (new utility), so they follow the density like every control. Before, they had fixed
    12px padding.
  - A select's list grows to fit its longest option instead of clipping it.
  - The playground's own layout is on the visual system: type roles, 1px borders, region insets, and label and field
    gaps.
- The reference brands `paper-sharp` and `void-pill` keep their own fonts. They exist to show that a brand
  reshapes Feather through tokens.

## 1.13.0 — 2026-10-03

**A default theme: feather.** What Feather looks like with no brand.

- `themes/feather.json` (light) and `themes/feather-dark.json` (dark):
  - Black and white. The primary is ink, near-black in light and near-white in dark, and there is no accent.
    Color appears only where it carries meaning: success, warning, info, errors and the destructive act.
  - Warm-neutral greys: a #F7F7F5 page under white surfaces, and #0C0C0E under #16161A in dark.
  - JetBrains Mono throughout, for headings and text alike.
  - The system defaults on every other axis: rounded 8/12/16, comfortable density (44px controls), soft
    elevation, calm motion.
  - Every emphasis color meets its contrast floor. The destructive red is the theme's own (#B42318 light, #FF6B62
    dark), so error text passes AA on the page and on its tint, with no accessibility debt.
- **The fallback is the theme.** foundation.css's `:root` and `.dark` blocks are generated from the two files by
  `scripts/default-theme.mjs` (`pnpm --filter @aleeforoughi/feather-tokens theme:default`), and a test fails on
  drift. A product that applies no brand gets exactly this theme.
- **Geist Mono** joins the foundation font set. A mono family now falls back to `monospace` for display as well
  as body.
- **Corner radius is a hierarchy** (docs/visual-system.md §7). The button radius is the base and the minimum;
  every enclosing level adds one 4px step, so curves inside curves are always tighter (control 8 → card 12 → card
  holding a card 16 → dialog 20). `rounded-card` and `rounded-dialog` compute this from their content with
  `:has()`, so every component follows it without knowing where it sits. A list that insets its items by 4px is
  exactly concentric with them. The `pill` shape's cards and dialogs are now 16 and 20, and the rendered audit
  checks the hierarchy (`radius.nesting`).
- **Spacing belongs to regions** (docs/visual-system.md §3a). A surface divided into regions (dialog, sheet, card,
  the organism cards) has no padding of its own; each region owns an inset by role, scaled by density:
  - content (axis, 20/32);
  - header (directional: 24 above, 16 below);
  - action (perimeter, 20 all sides);
  - utility (axis, 12/16);
  - display (perimeter, 32).

  Gaps have roles too: action 8, label 8, field 16, heading↔body 12. Content directly under a header attaches to
  it, so the heading sits 16px above the body. `p-card` and `p-dialog` are retired. New: `DialogBody` and
  `SheetBody`. Hygiene checks that every region uses its inset; the audit checks each region's values and that
  shells have no padding.
- **Tooltip:** a surface's radius starts at the control radius, so tooltips are 8 and their arrow stays a step
  tighter.
- **Table:** a table wider than its container becomes a focusable, named region while it scrolls, so a keyboard
  user can reach it. Mono text made the comparison table scroll and exposed this.
- **Gates.** Storybook opens in feather. Accessibility runs in all four reference themes, and visual regression
  and the rendered audit cover them too.

## 1.12.0 — 2026-10-03

**Visual hygiene (milestone V1).** Every pixel, gap, radius, type size, border, shadow, duration and curve now
comes from one finite system, `docs/visual-system.md`. Brand themes choose values inside it and can never step
outside it. Every component was normalized onto the system. Normalized means the values moved; nothing was
redesigned, and anatomy, API and behaviour are unchanged. **This is a deliberate visual release:** most
components look different.

- **Tokens** (`@aleeforoughi/feather-tokens`):
  - a fixed 4px spacing unit;
  - three densities (tight, default, spacious) with 36, 44 and 52px controls, as CSS variables on `:root` and per
    `[data-density]`;
  - radius tiers per brand shape that always nest. The default shape is now `rounded`;
  - one emphasis scale for text, icons and borders (`text-fg-*`, `border-line-*`, `bg-surface-*`). The engine
    derives each emphasis color by exact oklab search and checks it against its contrast floor; the primary
    border reaches 3:1;
  - four elevation levels. This also fixes shadows that never reached Tailwind's utilities;
  - one easing curve and six durations per motion axis. A brand's motion setting now scales durations only;
  - type roles on a 4px line grid, font rendering, reduced motion built in, one 2px focus ring, a scrim, 2px
    selection indicators, and layout tokens.
  - `headingWeight` is limited to 400–700 and component border widths to 0 or 1px.
- **Components** (`@aleeforoughi/feather-react`):
  - Buttons, inputs, selects, toggles and tabs share one frame at the density height.
  - Every control, checkbox, radio, switch, menu row, link and disclosure reaches a 44px hit area through an
    invisible extension. A text field is its own target.
  - Motion roles replace every ad-hoc transition. There is no `transition-all` and no layout animation; the
    accordion animates a grid track, and progress and hold fills scale.
  - Dialogs, tables and galleries sit on whole pixels.
  - New: `Icon`, which renders glyphs in a pixel-aligned slot, with an optical registry for asymmetric glyphs.
  - `cn` now merges the system's own utilities.
- **Manifestations:**
  - The web manifestation sets `data-density` from the plan instead of rescaling spacing.
  - Switch scanning uses the same focus ring.
- **Three gates** (docs/visual-system.md §12):
  - **Static hygiene** fails on any off-system value.
  - **A new rendered audit** measures every story in both themes and all three densities: control heights,
    targets, borders and focus, layout shift, type, radius, icons, whole pixels and motion. It is a CI job, and
    its self-test (56 fixtures) proves that each rule fires.
  - **A principle review** is recorded below.
- **Results.** The rendered audit went from 8,158 failures to 0, static findings from 403 to 0, with zero
  optical exceptions. Axe passes in both themes, and all 960 conformance tests still pass.
- **Principle review for this release:**
  - Alignment: the Recommendation and IrreversibleAction headings now share one left edge with their content (the
    icon moved into the eyebrow).
  - Hierarchy, emphasis, consistency, rhythm, depth and accessibility hold across both reference themes.
  - Follow-ups: a "warm" warning tint for the budget bar; reduced motion for JS-driven loops when the OS
    preference changes after load; Sonner's own toast offsets.

## 1.11.0 — 2026-10-03

**More than one body (milestone L4).** The action is permanent; its manifestation is not. One experience now
takes four bodies (web, switch, voice and text), and a conformance suite proves they agree.

- `@aleeforoughi/feather-dialog`: the turn-based engine text and voice share.
  - Its turns are browse, value, confirm, readback and done.
  - It is pure, with no I/O, no DOM and no clock, and every reply is checked with `validateReply`.
  - Only the plan's keyword commits an irreversible act. A number, "yes", or the act's label never does.
  - It owns the sentences every non-visual body says. They match the web organisms' consequences word for word.
- `@aleeforoughi/feather-manifest-text`: `renderTurn`, `runText`, and the `feather-text` CLI.
  - The conversation goes to stderr and replies go to stdout as JSON lines.
  - No meaning depends on colour, and plan text is stripped of control characters.
- `@aleeforoughi/feather-manifest-voice`: `speechFor`, `createVoiceDialog().hear(alternatives)` and
  `runVoice(engine)`, for any speech engine.
  - Spoken numbers, readback of values, and the consequence in full before the keyword.
  - The caller's words are said verbatim.
  - A misheard alternative never changes state.
- `@aleeforoughi/feather-manifest-switch`: scanning over the web body.
  - One switch (auto-scan, started only by the first press) or two (step). Dwell is optional.
  - The highlight is real focus, a ring and a description, never colour alone.
  - Escape in a text field belongs to the scanner, so no form is backed out by accident. Open popups are scanned.
  - Dwell may arm an act; it never commits one.
- `conformance/manifest`, the L4 exit test (960 tests): every valid fixture, plus synthetic ones for paths the
  fixtures miss, and every available act, driven through all four bodies by their own inputs.
  - The same reply in every body.
  - For anything irreversible, the single act emits nothing until the deliberate step: the confirm button, the
    typed or spoken keyword, or a second switch selection.
  - The suite was written independently of the bodies, and its first run found three switch defects, now fixed.
- The playground shows each context in its own body.
- `manifest-web` takes its wording and formatting from `feather-dialog`, so every body says the same thing.

## 1.10.0 — 2026-10-03

**The liquid composer (milestone L3).** Semantics in, the right experience out: one Experience IR, composed for
the person, their abilities and their device. Three new packages.

- `@aleeforoughi/feather-context`: the render context types (persona, capability, device, brand, locale). It is
  types only. The host passes the context per render, and Feather stores none of it.
- `@aleeforoughi/feather-liquid`: `compose(experience, context) → LayoutPlan`.
  - It is pure and deterministic, with no clock, no randomness and no model call, and it never throws.
  - Every value in the plan comes from a named rule (`RULES`) at a principle 8 priority level (safety,
    accessibility, user setting, OS, task, learned, aesthetics, default). The plan's `trace` records the rule,
    the reason and what it overrode.
  - The rules cover:
    - one primary act;
    - irreversible acts, which are confirmed once and never take the default focus;
    - the recommendation first, then its alternatives;
    - critical detail, which is never hidden;
    - density and target size;
    - routing by output: web, switch, voice or text;
    - explanation depth;
    - reduced motion;
    - plain text without a card;
    - contrast;
    - importance;
    - structure.
  - The plan gives `order`, the reading, speaking and scanning order, and a confirm `keyword` in the plan's
    language. Audio and video get `textEquivalent` when there is no sound.
  - Every rule has tests. Every valid fixture in every reference context is snapshot-tested. Invariants (every
    node once, focus never on an irreversible act, no body the output cannot carry) hold for every fixture in 64
    contexts.
  - An experience ten times the largest fixture composes in under 5 ms.
- `@aleeforoughi/feather-manifest-web`: `<FeatherExperience>` and `<PlanView>` render a plan with Feather's
  organisms and atoms.
  - They apply every decision in the plan, and move focus once, on mount.
  - Every act becomes a reply checked with `validateReply`; a refused reply is never sent.
  - Voice and text plans render a plain summary until their own manifestations arrive (L4).
  - Its stories are the new *Experiences* in Storybook, and pass axe in both reference themes.
- `apps/playground`: pick or edit an experience, change the person and the device, and see the result in four
  reference contexts, with the plan, the trace and the compose time. Its end-to-end tests run in CI.

Changes to existing packages:

- **IR:**
  - An act that states a `consequence` is irreversible: `"reversible": true` beside one is an error, and an
    IrreversibleAction may confirm it.
  - An IrreversibleAction's `confirms` may name any irreversible act, including a Choice.
  - Spec defaults (IrreversibleAction `critical`, Warning `high`) are documented and applied by the composer.
  - `validate()` never throws: a document it cannot read gives the issue `unreadable`.
  - Validation is faster on large experiences.
- **Organisms:**
  - Recommendation, IrreversibleAction and Approval take `defaultExpanded`.
  - Approval and Recommendation take `arm`, and arm whenever they state a consequence that nothing else confirms.
  - `useThemeMotion` honors a `MotionPreference` set by the plan.
- **Hygiene** checks the new packages' boundaries: the composer imports only the IR and the context; the web
  manifestation imports only Feather and React, and uses no raw colors.

## 1.9.0 — 2026-10-03

**Decision organisms (milestone L2).** Ten components that each render one Experience IR node as a complete,
accessible interaction, the pieces the composer will assemble at L3. `foundation.json` gains the level
`organism`; there are now 28 atoms, 7 molecules and 10 organisms.

- `Recommendation`, `IrreversibleAction`, `Approval`, `Tradeoff`, `AlternativeList`, `PredictedChoice`,
  `ExploreMore`, `CorrectionInput`, plus the shared `ConsequenceStatement` and `WhyDisclosure`.
- One contract for all of them, `docs/organisms.md`:
  - props mirror the IR node's fields;
  - one `onAct(act, value?)` callback carries exactly the node's reply acts and value encodings, so the composer
    wires replies with no translation;
  - `data-slot` and `data-variant` on every part, so brands restyle states such as
    `"irreversible-action.armed"`.
- Irreversible acts:
  - the consequence always shows verbatim ("Spends AED 1,050") and describes the act for screen readers;
  - confirming takes a deliberate act: arm and then "Yes, …", or a 1.5 s hold by pointer or key;
  - an irreversible act never takes the default focus, and happens once: afterwards the organism shows the
    outcome, offers no control that could act again, and moves focus to the outcome;
  - accepting an irreversible recommendation never commits.
- Critical detail is never hidden behind "Why?". Meaning never depends on color: the destructive color fails AA
  contrast for text in both reference themes, so it marks borders and icons only, and the danger state is
  spoken and written ("Cannot be undone").
- Every organism passes axe with zero violations in both reference themes, and completes its main act by
  keyboard alone in a play test that asserts the reply (208 stories, 0 new accessibility debt).
- Visual baselines: the recording workflow gains a `missing` mode that adds baselines for new stories only.

## 1.8.0 — 2026-10-03

**The Experience IR, `feather.ir/0` (milestone L1).** The public contract: what a caller asks Feather to render,
as meaning. New package `@aleeforoughi/feather-intent`, with no dependencies.

- 24 node types (14 content, 10 decision), the common fields (`id`, `intent`, `importance`, `reversible`,
  `expandable`), references between nodes, and the acts each node takes in its replies
  (`{ experience, node, act, value? }`).
- One table (`src/spec.ts`) drives the validator, the JSON Schema (`schema/feather.ir-0.json`) and the node
  reference (`docs/ir/nodes.md`); a test fails if the generated files drift. TypeScript types in `src/types.ts`.
- `validate()` reports every problem at once, each with a stable code, a JSON Pointer and a sentence saying what
  to change. Beyond structure it checks one primary act per experience, that irreversible acts state their
  consequence (principle 6), that every medium has a text equivalent, that references resolve, and it rejects
  presentational fields (principle 1) and unknown ones, suggesting the name a typo meant. `validateReply()`
  checks a reply against its experience. `feather-ir validate <file>` runs it from a shell.
- Contract rules settled after an adversarial review:
  - `primary` gives emphasis, never default focus.
  - An irreversible act without its own consequence is committed by the IrreversibleAction that `confirms` it,
    implied when there is only one; accepting such a recommendation never commits.
  - An IrreversibleAction is `high` or `critical`.
  - References are typed, and an Alternative follows what it replaces (and names it when there are several
    Recommendations).
  - One PredictedChoice per Choice, agreeing with `selected`.
  - Option and step ids follow the id pattern.
  - Text fields are capped at 4,000 code points.
  - Zoned and wall-clock date-times are never compared.
  - Every reply value has one encoding (money as a number in the Input's currency, a Price alternative as
    `{ amount, currency }`, dates as ISO 8601), and an optional Input can be skipped.
- Hardened: validate() and validateReply() never throw (prototype-named types and fields included), report at
  most 100 issues, escape JSON Pointer segments, and check every node, including those with a bad id.
  validateReply() validates the experience first and checks each value against its node.
- Conformance fixtures in `conformance/ir`: 43 realistic valid experiences that together cover every node type
  and IR feature, and 52 invalid ones, each a valid fixture with one deliberate mistake. Together they cover
  every issue code except `too-many-issues`, and each lists exactly the issues the validator must report.
- Docs: `docs/ir/README.md` (how the IR works, the rules, the codes, versioning).
- `docs/PLAN.md`: the `qooe-core` switch is set aside; Feather builds on the 1.7.0 handoff alone.

## 1.7.0 — 2026-10-03

**Feather becomes independent (milestone L0).** The 1.7.0 components, unchanged, move out of qooe-core into
this repository as packages: `@aleeforoughi/feather-tokens` and `@aleeforoughi/feather-react` on GitHub Packages.
Every story renders pixel-identical to 1.7.0 in both reference themes.

- `@aleeforoughi/feather-tokens`: the theme engine (was `scripts/apply-brand.mjs`; the same CSS, byte for byte),
  the `feather-brand` CLI, the foundation CSS (the semantic tokens and their Tailwind mapping, was the top of
  `src/index.css`), the reference themes, and the 14 fonts. Fonts now resolve through this package
  (`@aleeforoughi/feather-tokens/fonts/<font>.css`), so a product no longer installs Fontsource itself.
- Token schema `feather-tokens/2`: the same fields and semantic role names as `qooe-tokens/1`, now declared with
  `"schema": "feather-tokens/2"`. `qooe-tokens/1` brands (no `schema` field) still work: they migrate on read, or
  in place with `feather-brand --migrate`. A JSON Schema ships for editors (`schema/feather-tokens-2.json`).
- `@aleeforoughi/feather-react`: every component from one entry point, one ES module per component, with type
  declarations; `styles.css` for a product's Tailwind CSS v4 stylesheet; `foundation.json`. `FeatherProvider`
  (color mode, tooltips, toasts) replaces QOOE's `FoundationProviders`; data fetching (React Query) stays in the
  product.
- Moved out of the component system: the app dependencies (`better-auth`, `@tanstack/react-router`,
  `@tanstack/react-query`, `openapi-fetch`, `react-hook-form`, `zod`) belong to products. The copy-a-branch tools
  (`feather-branch`, `check`, `shot`, `BranchSheet`) are kept in `legacy/branch-tools` for QOOE branches that have
  not switched to the packages.
- Gates: hygiene now also checks the packaging (no `@/` imports in published code, every component exported,
  every import a dependency, one version across packages). New in CI: axe on every story in both reference themes
  (in a real browser) and visual regression of every story in both themes. The axe run found 19 violations
  1.7.0 already had (contrast of destructive and muted text, unnamed progress bars); they are recorded in
  `apps/storybook/.storybook/a11y-known.json`, and the gate fails on any new one.
- Dependencies are held at the exact versions 1.7.0 shipped with; installs need a release to be a day old.

Status tokens plus two more molecules promoted from Qoco Panel (its SpendBar and CrewAvatar, made generic).

- Semantic status tokens: `--success`, `--warning` and `--info`, each with a `-foreground`, in light and dark (Tailwind classes `bg-success`, `text-warning`…). Status colors (approved, sent back, budget zones, live states) now theme with the brand instead of using fixed palette classes. The theme engine (`scripts/apply-brand.mjs`) now writes them: a brand may set `colors.success|warning|info` (and `successText`…), otherwise light/dark defaults apply.
- `BudgetBar`: a meter for budgets, quotas and storage. Fill = used, optional target and cap markers with labels, optional striped reserved segment, overshoot drawn beyond the cap; zones `ok | warm | hot | over` as `data-variant` (success / warning / destructive tokens); `size` default | mini; `format` prop (no currency assumed); `role="meter"` with aria values. Slots `budget-bar`, `budget-bar-track`, `budget-bar-fill`, `budget-bar-reserved`, `budget-bar-overshoot`, `budget-bar-marker`, `budget-bar-caption`. Pure helpers `budgetZone` and `budgetGeometry` are exported with tests.
- `RoleAvatar` (+ `RoleChip`, `RoleCard`, `RoleAvatarGroup`): an avatar for a person or agent role. The caller passes `title` and any `icon` (initials when none); `emphasis` rings a distinct role in the primary color; cards take `kind`, `state` (idle, working pulsing, waiting, done), a `meta` line and `metrics`; the group collapses members past `max` into "+n". Slots `role-avatar`, `role-chip`, `role-card`, `role-state`, `role-avatar-group`; helpers `overflow` and `roleInitials` tested.

## 1.6.0 — 2026-10-02

First molecules. Promoted from Qoco Panel after the owner asked for a live view of agents at work: each is
generic (any product can use it), themed only through tokens, and animated at the theme's motion pace.

- `Lightbox`: one image of a set, large, previous / next (buttons and arrow keys), download, a checkerboard
  so transparency shows. Slots `lightbox`, `lightbox-stage`, `lightbox-caption`, `lightbox-nav`.
- `MediaGallery` (+ `MediaTile`): images in titled sections, tiles fading in, any one opening in the
  Lightbox. Slots `media-gallery`, `media-gallery-section`, `media-tile`, `media-tile-label`.
- `ActivityFeed` (+ `ActivityItem`, `LiveDot`, `WorkingDots`, `TypedText`): a live log, newest at the bottom,
  older lines fading out, following new lines until the user scrolls up; tones `info | good | warn | bad |
  ask` as `data-variant`, so `"activity-item.ask"` can be themed alone.
- `AttentionCard`: a rare, important question that pulses until answered, choices on the card; variants
  `default | danger`. Slots `attention-card`, `attention-card-icon`, `attention-card-title`,
  `attention-card-actions`.
- `StepList` (+ `StepItem`): an ordered plan with each step's status `pending | active | done | blocked`
  as `data-variant`. Slots `step-list`, `step-item`, `step-marker`, `step-item-detail`.
- `src/lib/motion.ts`: `useThemeMotion()` reads `--motion-duration` / `--motion-ease` (the brand's motion
  axis) and honours the user's reduced-motion setting; every animated component uses it.
- foundation.json marks these `"level": "molecule"`. Admission rules for new components: FEATHER.md.

## 1.5.0 — 2026-10-01

Found on qoco_panel: the app rendered blank in QOOE's screenshots — Better Auth's client threw
"Invalid base URL: null" because a file:// page has no origin, and the whole app failed to mount.

- Added `src/foundation/runtime.ts`: `isPreview` (QOOE's file:// render) and `appOrigin` (the page's origin
  when served, a placeholder in preview). Build API and auth clients from `appOrigin`; serve fixtures when
  `isPreview`.

## 1.4.0 — 2026-10-01

Closes the visual blocker the design-system designer recorded on qoco_panel: outline buttons could not be
themed apart from filled ones.

- Component tokens per variant: `"button.outline": { "borderColor": "primary", "foreground": "text" }`
  themes only that variant and wins over the slot's own tokens. `Button` now exposes `data-variant` and
  `data-size` (Badge already did, through Base UI).
- Still open from the same report: size-scoped button tokens, a segmented Tabs variant, an emphasis Card,
  status Badge variants, and a responsive navigation recipe.

## 1.3.0 — 2026-10-01

Feather becomes a base for full web apps (QOOE's new web_app product kind; first: Qoco Panel).

- Added: `@tanstack/react-router` (screens; hash history so every screen renders from the built files),
  `openapi-fetch` (API calls typed from a contract; QOOE generates the types, the crew never hand-writes
  them), and `better-auth` (its React client: GitHub, Google, email and password, account settings).
  All pinned and past the minimum release age.
- `shot` renders every screen listed in `design/screens.json`, full page, at 390 and 1280; a single page is
  still `home`.

## 1.2.0 — 2026-10-01

Closes the gap for QOOE's own brand (Qoco Panel): titles in Poppins, body in Figtree.

- Added fonts: **Figtree** (variable) and **Poppins** (fixed weights 400–800; it has no stable variable cut).
- The theme engine supports fixed-weight fonts: it loads only the listed weights and uses the font's own
  family name.

## 1.1.0 — 2026-10-01

Closes two gaps the design-system designer recorded on `sayease_v2`, where the approved designs' extra-heavy
headlines and bright supporting copy could not be themed and QA (rightly) rejected the theme twice.

- Added `typography.headingWeight` (100–900): every `font-heading` element takes the brand's heading weight;
  component tokens (e.g. `card-title.fontWeight`) still override a single component.
- Added `colors.mutedForeground`: the brand's own supporting-text color. Without it, supporting text stays
  a quiet mix of text and background, as before.
- Still open from the same report: per-size button tokens, a circular CTA size, a step indicator, an
  image-label overlay, and an upload drop zone (see the project's design/theme.md).

## 1.0.3 — 2026-10-01

- Fixed: product screenshots (`shot`) captured only the first window, so QA could not see sections
  below the fold and failed a correct section order. Home shots are now full-page (capped at 6,000px),
  via the installed playwright-core driving the same offline headless Chromium.
- Pinned `playwright` to 1.63.0 (was `latest`).

## 1.0.2 — 2026-10-01

Gap closed from the first live project (SayEase landing page).

- Fixed: the themed component sheet rendered open-on-load overlay stories (dialog, sheet, popover,
  tooltip), whose backdrop blurred the whole sheet, so neither the designer nor QA could compare
  components. Open-on-load stories are now left out; overlay surfaces use the card and popover tokens
  shown elsewhere on the sheet.

## 1.0.1 — 2026-10-01

Hygiene release (Bootstrap's first): the new hygiene gate audited 1.0.0.

- Fixed: the `motion` theme axis was written by the engine but read by nothing, so calm and snappy
  brands animated the same. Tailwind's default transition duration and easing now follow it.
- Added: `npm run hygiene` (`scripts/feather-hygiene.mjs`), required for every release.
- Reference themes moved to `themes/*.json`, shared by Storybook and the hygiene gate.

## 1.0.0 — 2026-10-01

First release, owner direction: QOOE builds every product on one themeable master design system.

- Engineering foundation: React 19 + TypeScript, Vite 8, Tailwind CSS v4, Base UI, shadcn/ui (generated
  by the official CLI, `base` library, `nova` preset), Lucide, Motion, React Hook Form + Zod,
  TanStack Query, Vitest, Storybook 10 (docs, a11y, Vitest, MCP).
- 28 atoms with 112 Storybook stories; `foundation.json` manifest generated from the Storybook index.
- Theme engine (`scripts/apply-brand.mjs`, token schema `qooe-tokens/1`): primitive → semantic →
  component tokens; axes shape, density, elevation, motion; 12 pre-installed variable fonts.
- Reference themes: `neutral`, `void-pill`, `paper-sharp`.
