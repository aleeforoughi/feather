# Patterns built

Feather's range comes from Qooler's award pattern catalog (`knowledge/27-award-pattern-catalog.md`, with the data in
`knowledge/research/2026-11-24-pattern-catalog.json`, 307 patterns in six families: motion, scroll, UI, 3D, performance
and access). Feather takes the techniques and the measured values, never a site's code, and a pattern becomes a
variant or a knob of something that exists whenever it can: the library grows from need, not from the catalog's
length ([FEATHER.md](../FEATHER.md); the plan is [proposals/2026-11-24-range.md](proposals/2026-11-24-range.md)).

This page lists what is built: waves 1, 2 and 5 in full, and waves 3 and 4 by family (their rows are in the CHANGELOG's
1.21.0 and 1.22.0 entries). How to ask for one that is missing: a `pattern-request` issue.

**Tiers.** Every pattern works in the three tiers of the Foundations "Three tiers" page: **no script** (complete HTML),
**reduced motion** (a short cross-fade or the end state) and **full**. A row says only where a tier differs. **Loudness**
is the lowest level that lets the pattern move (0 quiet, 1 composed, 2 expressive, 3 spectacle); reduced motion beats
any level.

## The edges (wave 1, 1.19.0)

| Catalog id | Feather | Release | Tiers |
|---|---|---|---|
| `loader-counter-preloader`, `skip-intro-affordance` | `Loader variant="counter"`; page `loader: { variant: "counter" }`. An honest percentage (the lesser of real readiness and elapsed time over a minimum), capped at 8s | 1.19.0 | Never shown without script or under reduced motion; `role="status"`; page held `inert` while it shows |
| `preloader-to-hero-handoff` | `Loader variant="dock"`: a bar that fills and becomes the header (`[data-loader-dock]`) | 1.19.0 | As above |
| `nav-overlay-menu`, `menu-open-reveal` | `OverlayMenu`; page `nav` | 1.19.0 | No script: a plain list. Open: a modal dialog, focus trapped, Escape, page `inert`. Reduced: a fade |
| `footer-as-scene` | `Footer variant="plain" \| "wordmark" \| "reveal"`; page `footer` | 1.19.0 | Every link stays text; `reveal` scrolls a focused link into view |
| `404-as-scene` | `NotFound variant="type" \| "minimal"`; page `notFound`; `feather-page build` writes `404.html` | 1.19.0 | A clear way home in every tier |
| `sound-layer` | `SoundToggle`; page `sound: { bed }` | 1.19.0 | Off until the person turns it on, `aria-pressed`, remembered, silent while hidden |
| `vt-crossfade-root`, `nav-page-transition` | `createTransitions().go(update, { variant: "fade" })`; page `transition` | 1.19.0 | Instant where View Transitions are unsupported; focus moves to the new `h1` |
| `curtain-wipe` | Route variant `view`: the old page recedes, the new one wipes up (0.95s, `--ease-wipe`) | 1.19.0 | Static sites get cross-document View Transitions; instant under reduced motion |
| `page-slide-parallax` | Route variant `push`: the old page drifts up 25vh under a veil (1.2s, `--ease-push`) | 1.19.0 | As `view` |
| `multi-curtain-stagger` | Route variant `columns`: four columns cover and lift (0.06s stagger) | 1.19.0 | Needs script: a static site fades |
| `quality-ladder`, `pixel-budget`, `capability-gate`, `shader-prewarm` | The runtime in `@aleeforoughi/feather-expression/core`: `createQualityLadder`, `cappedPixelRatio` and `PIXEL_BUDGET`, `capabilityGate` and `retire`, `perFrame` (shader prewarm behind the loader). `World` runs them | 1.19.0 | A still and the DOM text without WebGL, on data saver, or when the gate says no |

## Type in motion (wave 2, 1.20.0)

| Catalog id | Feather | Release | Tiers / loudness |
|---|---|---|---|
| `split-line-mask-reveal`, `mask-line-reveal` | `DisplayTitle effect="mask"`: lines rise from behind a mask (0.8s, 0.1s per line) | 1.20.0 | Real text in an `sr-only` copy; loudness 2 |
| `split-char-reveal`, `split-word-fade-up` | `DisplayTitle split="char" \| "word"` | 1.18.0 | Loudness 1 |
| (2026 winners' code: character skew-slide) | `DisplayTitle effect="skew"`: characters slide 80px and unskew 14° | 1.20.0 | From 992px up only; below it, `mask`. Loudness 2 |
| `ellipse-line-reveal` | `DisplayTitle effect="oval"`: each line opens through a growing ellipse (1.5s) | 1.20.0 | Loudness 2 |
| `film-blink` | `DisplayTitle effect="blink"`: a 210ms film-cut flicker | 1.20.0 | Loudness 2 |
| `text-scramble` | `DisplayTitle effect="scramble"`: characters cycle and settle left to right | 1.20.0 | The accessible name is the final text; loudness 2 |
| `headline-word-swap` | `DisplayTitle effect="swap" words={[…]}`: one word changes in a masked swap | 1.20.0 | Holds on hover, focus, off screen and in a hidden tab; `paused` for a host's pause control; loudness 2 |
| `counter-roll` (partial), `scroll-counter` | `Counter` (animated number, 600 to 1200ms, tabular figures) | 1.18.0 | The final value is what assistive technology reads |
| `marquee-ticker` | `Marquee`, `Reel` | 1.18.0 | Pause button, pause on hover and focus; static under reduced motion |

## Scroll choreography (wave 2, 1.20.0)

| Catalog id | Feather | Release | Tiers / loudness |
|---|---|---|---|
| `pinned-scrollytelling`, `step-text-sticky-visual`, `pin-and-swap-content` | `Stage steps={[…]}`: text panels scroll past a pinned visual; the active step is passed to the visual and set as `data-step`. Length capped at 4 viewport heights | 1.20.0 | Under reduced motion or without script the steps stack in normal flow, each with its visual; nothing pins. Loudness 2 |
| `section-snap` (partial) | `Stage snap`: `scroll-snap-type: y proximity`, never mandatory | 1.20.0 | Only while pinned; not for pages smoothed by Lenis |
| `layered-parallax` | `ScrollLayers variant="parallax"` with `ScrollLayers.Layer depth={0.8..1.2}` | 1.20.0 | CSS scroll timelines where supported, else the one clock. Static under reduced motion. Never body text in a moving layer. Loudness 2 |
| `sticky-stacking-cards`, `scroll-card-stack` | `ScrollLayers variant="stack"`: earlier cards settle at 0.95 under the next | 1.20.0 | Plain stack in flow without script. Loudness 2 |
| `horizontal-scroll-section`, `native-horizontal-snap-rail` | `ScrollLayers variant="horizontal"`: a pinned track on desktop, a native snap rail on touch. `length` 1 to 4 | 1.20.0 | A scrollable, labelled region (needs an `aria-label`) in every tier. Loudness 2 |
| `scale-to-fullscreen` | `ScrollLayers variant="scale"`: media grows from an inset to full bleed; its caption sits on its own surface so contrast holds at every size | 1.20.0 | Full-bleed and static under reduced motion. Loudness 2 |
| `scroll-scrubbed-image-sequence` | `ImageSequence`: a canvas scrubbed through frames, with a lighter set for phones | 1.20.0 | The poster is a real image and is what no script, reduced motion and data saver show; frames load after the page, near the viewport, two at a time. Loudness 2 |
| `smooth-scroll-inertia`, `native-scroll-passthrough` | `ScrollProvider` (native, CSS timelines, or Lenis you pass in) | 1.18.0 | Native on touch; none under reduced motion |
| `fade-up-reveal`, `css-view-reveal` | `Section` and `useReveal`: CSS `view()` first, an observer as the fallback | 1.18.0 | Loudness 1; simply there without script |

## Route changes (wave 2, 1.20.0)

| Catalog id | Feather | Release | Tiers |
|---|---|---|---|
| `page-slide-parallax` (the layered variant) | Route variant `slide`: the old page stays as a dimmed, receding layer while the new one slides up over it (0.75s) | 1.20.0 | Instant under reduced motion; instant where View Transitions are unsupported |
| `tilted-sheet-transition` | Route variant `sheets`: the new page rises as a sheet tilted -4°; the old one recedes (0.8s, `--ease-route`) | 1.20.0 | As `slide` |
| `clip-path-circle-reveal` | Route variant `circle`: the new page opens as a circle from the last click or tap (the centre after a key press) | 1.20.0 | As `slide`; the origin is the last pointer press within one second |

All route variants are the page's `transition` knob: `none`, `fade`, `view`, `push`, `slide`, `sheets`, `circle`,
`columns`.

## Blocks, variants and knobs (wave 2, 1.20.0)

`feather.page/1` blocks gain named variants (the first is today's rendering) and shared knobs: `loudness`, `tone`
(`base`, `subtle`, `raised`, `inverse`, `block-1` to `block-4`), `space`, `align`, `scale`, `crop`, `motion` (`enter`,
`intensity`, `direction`, `stagger`) and `scroll` (`pattern`, `length`, `snap`). Every knob is an enum or a bounded
number, and the validator rejects contradictions with a code. The page also takes a `loudness` and `defaults`.

| Catalog id | Block variant | Release |
|---|---|---|
| `hero-giant-type` | `hero variant="giant-type"` | 1.20.0 |
| `hero-split` | `hero variant="split"` (needs media) | 1.20.0 |
| `hero-fullbleed-video` | `hero variant="film"` (needs media) | 1.20.0 |
| `hero-product-first` | `hero variant="product"` (needs media) | 1.20.0 |
| (an index hero) and `hero-interactive-webgl` (the DOM tier) | `hero variant="index"`, `"interactive"` | 1.20.0 |
| `marquee-ticker` | `statement variant="marquee"`; `logos variant="marquee"` (`motion.direction` left or right) | 1.20.0 |
| `scroll-fill-text` | `statement variant="fill"` | 1.20.0 |
| `headline-word-swap` | `statement variant="swap"` with `words` | 1.20.0 |
| `work-list-hover-preview` | `work variant="hover-list"` | 1.20.0 |
| `gallery-horizontal-rail` | `work variant="rail"` (implies the horizontal pattern) | 1.20.0 |
| `sticky-stacking-cards` | `work variant="stack"` (implies the stack pattern) | 1.20.0 |
| `scale-to-fullscreen` | `case variant="scale"` (needs media) | 1.20.0 |
| `testimonials` | `quote variant="rail"` (several quotes), `"pull"`, `"large"` | 1.20.0 |
| `pricing` | `offer variant="table"`, `"cards"` | 1.20.0 |
| `timeline-history` | `timeline variant="horizontal"`, `"list"` | 1.20.0 |
| `numbers-stats` | `numbers variant="lead"`, `"counter"`, `"plain"` | 1.20.0 |
| `scroll-storytelling-pinned` | `process variant="pinned"` (implies `pin`) | 1.20.0 |
| `colour-blocking`, `two-colour-ground`, `section-theme-switch` (the ground) | `tone: "block-1".."block-4"`, `"inverse"`; the `/4` block roles | 1.20.0 |
| `layout-editorial-asymmetric` | `align: "offset"` | 1.20.0 |

The authoritative table of variants and what each block accepts is `BLOCK_RANGE` in
`packages/page/src/core/spec.ts`, and the JSON Schema `feather.page-1.json`.

## Media and page blocks (wave 5, 1.23.0)

Page blocks are `feather.page/1` only (`PAGE_BLOCKS` in `packages/page/src/core/spec.ts`): a `/0` page reports
`needs-schema-1`, and a prepared scene cannot hold one. Each is in [page.md](page.md) with its fields.

| Catalog id | Feather | Release | Tiers / loudness |
|---|---|---|---|
| `gallery-horizontal-rail` | `gallery variant="rail"` (a native snap rail, previous and next; `loop` makes it endless) | 1.23.0 | Every image a real link to its file, opening feather-react's `Lightbox` (lazy) with script; a loop's copies `aria-hidden` and inert |
| `gallery-masonry` | `gallery variant="masonry"`, and `"grid"` (the caption on the scrim, on hover and focus) | 1.23.0 | As the rail |
| `work-list-hover-preview` (for pictures) | `gallery variant="hover-list"` | 1.23.0 | Thumbnails on touch |
| `wheel-gallery`, `gallery-3d-disc` (the DOM tier) | `gallery variant="wheel"`: a ring turned by drag, horizontal scroll or the arrow keys | 1.23.0 | Loudness 2, motion allowed and three images, else the rail; only the front image is reachable, and it is announced |
| `comparison` | `comparison variant="slider"`: a native range between two pictures | 1.23.0 | Side by side without script; `aria-valuetext` speaks both shares |
| `scroll-storytelling-pinned`, `step-text-sticky-visual` (with pictures) | `story variant="pinned"` on `Stage`, and `"stacked"` | 1.23.0 | Stacked in reading order below loudness 2, under reduced motion and without script |
| `testimonials` | `testimonials variant="grid" \| "rail"`, on quote's `QuoteCard` | 1.23.0 | A figure, a blockquote and the attribution in every tier |
| `journal-newsletter` | `journal variant="list" \| "featured"`; the newsletter is a `form` | 1.23.0 | A real `<time datetime>`, the title as the link |
| `form-minimal-underline` | `form variant="underline"`: the browser's own controls in the house style | 1.23.0 | A real `<form method="post">` (or `mailto:`) with no script; with script, messages beside each field and a summary |
| `form-conversational-stepper`, `form-field-feedback` | `form variant="conversational"`: one question at a time, its place announced | 1.23.0 | The whole form at once without script |
| `showreel-player`, `video-poster-swap`, `autoplay-on-enter-video` | `showreel variant="player"`: real buttons for play, sound and captions; speech needs captions | 1.23.0 | Muted autoplay only with motion allowed, off data saver, at loudness 1; otherwise the poster waits for Play. No script: the browser's player |
| `hero-fullbleed-video` (the poster) | The film hero's poster is the LCP: eager, high priority, over the media scrim until it decodes | 1.23.0 | The film arrives after mount, only with motion allowed and off data saver |
| `bento-grid` | `work variant="bento"` | 1.23.0 | A grid in every tier |
| `case-fullscreen-preview` | `work variant="fullscreen-cases"` | 1.23.0 | Each piece a full screen, its words on the media scrim |
| `pricing` (a period switch) | `offer variant="toggle"` with `periods` and each item's `prices` | 1.23.0 | CSS only, so it works with no script; the prices are a live region |
| `clip-path-image-reveal`, `blur-to-sharp`, `image-inner-parallax`, `grain-overlay` (on images) | The `treatment` knob: `clip-reveal`, `blur-to-sharp`, `inner-parallax`, `duotone`, `grain` (MediaFrame) | 1.23.0 | Decoration only; the moving ones rest under reduced motion and on the LCP image; loudness 1 (2 for inner-parallax) |
| (responsive images) | `srcset` on any media, with the `sizes` Feather derives from where the image sits (`MEDIA_SIZES`) | 1.23.0 | Without a srcset the markup is as before |

## Product flows in a page (wave 5, 1.23.0)

| Catalog id | Feather | Release | With no script |
|---|---|---|---|
| `interactive-quiz` | `quiz`: one question per step, `tally` or `score`, a result's `match` first | 1.23.0 | Every question, and how the result is decided |
| `booking-flow` | `booking`: service, date and time, details, then a review with Change on every choice; sends to an action, a `mailto` or a booking link | 1.23.0 | One form: radios for services and slots |
| `pricing-calculator` | `calculator variant="split" \| "stacked"`: inputs and a formula in a small safe language; the total is a live region | 1.23.0 | The starting prices |
| (data in a page) | `chart variant="bar" \| "line" \| "area"`: SVG in the text ink, a distinct mark per series, the data as a table | 1.23.0 | The end state and the table |
| `map-navigation` (the honest tier) | `places variant="list" \| "map"`: names, addresses and links, with an optional still map; no map SDK | 1.23.0 | The same list and links |
| `podcast-player`, `audio-led-timeline` (chapters) | `podcast`: native audio, real-button controls, chapters that seek, a transcript that can follow | 1.23.0 | The browser's own controls, the chapters, the transcript |
| `theme-toggle` | Page `scheme: { toggle, colors }`: light, dark and system, a radio group in the nav or the footer, remembered; `feather-page build` writes the no-flash script | 1.23.0 | The system's preference holds; the toggle is not shown |
| `view-mode-switch` | `work views="grid" \| "list" \| "index"`: a segmented radio group, remembered per page and block | 1.23.0 | The view it starts in |

## Layouts and templates (wave 5, 1.23.0)

A layout is one page knob, `layout`, drawn by foundation.css from `main[data-layout]` with the theme's own roles
([page.md](page.md)); a template is a whole page in `packages/page/templates/`, written out by `feather-page init`.

| Catalog id | Feather | Release | Notes |
|---|---|---|---|
| `layout-editorial-asymmetric` | `layout: "editorial"`: every other section hangs from column 4 from 1024px; block titles in the display face (and `align: "offset"` per block, 1.20.0) | 1.23.0 | Off-grid sections keep their own |
| `layout-swiss-grid` | `layout: "swiss"`: a hairline opens every section on the grid's measure, numbered titles (not read), square corners, no shadows | 1.23.0 | |
| `layout-brutalist` | `layout: "brutalist"`: borders and heavy rules in the ink, mono capitals for block titles, a 3px focus ring | 1.23.0 | |
| `poster-layout` | `layout: "poster"`: every section a full screen (`100svh`), its content in the middle, titles at display size | 1.23.0 | No layout shift: the small viewport never changes |
| `colour-blocking` | `layout: "colour-blocking"`: every other section on the next colour block in turn (and `tone: "block-N"` per block, 1.20.0) | 1.23.0 | Each pair measured at 4.5:1 with its secondary tint, or a `contradiction`; blocks with native controls stay on the page ground |
| `two-colour-ground` | `layout: "two-colour"`: the ground and one ink (the primary where it reads, else the text colour) for the whole document; images duotone | 1.23.0 | Measured like colour-blocking; state colours keep their own |
| `case-study-template` and the range's templates (§3.2) | Templates `launch`, `studio`, `editorial`, `service`, `product`, `creator`; `feather-page init <template>`, `init --list` | 1.23.0 | Each in the showcase (`?template=`) and Storybook's "Templates", in three brands |
| (§6, the 2-CPU server) | `scripts/render-gate.mjs`: `feather-page build` of one direction, all routes, ≤ 500 ms on two CPUs (`taskset -c 0,1` in CI) | 1.23.0 | Every template and reference example, in three brands |

## Foundations the patterns stand on

| Catalog id | Feather | Release |
|---|---|---|
| `ease-families`, `duration-scale`, `stagger-system`, `spring-physics` | Signature curves, pace, the expression roles, `--stagger-*`, `spring.bounce`, personality (`/4`) | 1.18.0, `/4` in 1.20.0 |
| `grain-overlay`, `glass-cards-on-scroll` (the surface) | `surface: "film" \| "glass"` | 1.18.0 |
| `layout-brutalist`, `layout-swiss-grid` (the ground) | `shape: "sharp"`, `surface: "paper"`, the page grid | 1.18.0 |
| `magnetic-button`, `custom-cursor-follow` | `Magnetic`, `Cursor` | 1.18.0 |
| `in-page-ai-assistant` | `@aleeforoughi/feather-living` | 1.18.0 |

## Waves

| Wave | Families | Release |
|---|---|---|
| 1 | The edges | 1.19.0 |
| 2 | Text and scroll, route changes, block variants and knobs | 1.20.0 |
| 3 | Sound and pointer: cues and the mixer, the cursor and magnetic family, hover media; the micro-motion layer on every interactive atom | 1.21.0 |
| 4 | `feather-scene`: shader backgrounds, particles, the object viewer, depth images, camera on rails | 1.22.0 |
| 5 | The rest of the catalog: media and the page blocks, product flows in a page, layouts and templates; the 2-CPU render gate | 1.23.0 |

The exact scope of each wave is in [proposals/2026-11-24-range.md](proposals/2026-11-24-range.md).
