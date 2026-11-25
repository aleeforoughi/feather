# Websites from a schema: `feather.page/0` and `/1`

`@aleeforoughi/feather-page` turns one JSON document into a complete, themeable website, with the Living Page
layered on. Changing `brand` restyles all of it, which is how the showcase proves the range: the same document,
three brands (Studio, Portrait and Seed).

```json
{
  "schema": "feather.page/0",
  "brand": "brand/tokens.json",
  "speaker": { "kind": "person", "name": "Alee", "voice": "voice.md" },
  "sections": [
    { "block": "hero", "title": "…", "media": "portrait.mp4", "starters": ["Show me the work"] },
    { "block": "work", "items": ["acceptto", "freezon", "evercover"] },
    { "block": "contact" }
  ],
  "scenes": { "work": { "ask": "Show me the work", "line": "Acceptto is the one I'd show you first.", "blocks": [{ "block": "case", "title": "Acceptto" }] } },
  "living": { "anchor": "reader", "fold": true, "prepared": ["work"] }
}
```

The reference document is `packages/page/examples/studio-of-one.page.json`.

## The parts

- `src/core/spec.ts` is the single table of blocks and their fields. `validate.ts` reads it, and
  `scripts/generate.ts` writes `schema/feather.page-0.json` from it. Run `pnpm --filter
  @aleeforoughi/feather-page generate` after changing it; a test fails if the file drifts.
- `validatePage(doc)` is the authority. It returns the page, or every issue with a JSON pointer and a code. It
  also checks what a schema cannot:
  - library references (`work.items` ids in `library.work`);
  - unique block ids (they are anchors);
  - safe links and media (never `javascript:`);
  - alt text on media objects;
  - scenes bring one to three blocks;
  - `living.prepared` names real scenes;
  - the honesty floor: a page with a living layer names its speaker, and a custom disclosure must say it is an AI
    agent.
- **The block library** is the Living Page's (Qooler file 22 §3): `hero`, `statement`, `work`, `case`, `numbers`,
  `timeline`, `process`, `logos`, `quote`, `offer`, `faq`, `contact`, and one `signature` block per brand. It is
  the same set as `@aleeforoughi/feather-living`'s `BLOCK_KINDS`, and a test holds them equal. An answer is built
  only from these.
- `brand` is a path the host resolves (the CLI reads it), or the tokens inline. Any `feather-tokens/3` brand works;
  a `/2` brand works with the house expression defaults.
- `mountPage(container, node)` is how a host puts a page on screen: it renders `<FeatherPage>` (with any host
  chrome around it) in a React transition, so the long first render yields to the main thread instead of holding it
  in one task. A plain `root.render` of a full page breaks the 200ms mobile TBT budget on a throttled phone; the
  showcase sites mount this way and the website gate measures them.
- **The page edges (`feather.page/1`).** `/1` adds top-level fields for the chrome around the sections; every `/0`
  page is still valid, and an edge on a `/0` page is reported as `needs-schema-1`. Each is in `EDGES` in
  `spec.ts`, and `schema/feather.page-1.json` is generated beside `-0`:
  - `nav`: `{ brand?, label?, items: [{ label, href }] }`, the overlay menu;
  - `footer`: `{ variant: plain | wordmark | reveal, wordmark?, body?, links?, note? }`;
  - `notFound`: `{ variant: type | minimal, title?, body?, home?: [{ label, href }] }`, served by `PageNotFound`
    and written as `404.html` by `feather-page build`;
  - `loader`: `{ variant: counter | dock, label?, sound? }`;
  - `transition`: `none | fade | view | push | columns`. A host passes it to `createTransitions().go()`, with
    `mountPage(...).swap(node)` as the update. `feather-page build` turns on cross-document View Transitions for the
    static routes (`view` and `push` styled by foundation.css, off under reduced motion; `columns` needs script, so
    a static site fades);
  - `sound`: `{ bed }`, one looping bed, off until the person turns it on with the toggle in the nav.
- **Knobs and variants (`feather.page/1`, from 1.20).** A Qooler direction is a choice of blocks, their variants and a
  few bounded knobs, themed by the brand. Every knob is an enum or a bounded number, checked by `validatePage` with a
  JSON pointer and a code, and listed in `schema/feather.page-1.json`. A knob on a `/0` page reports `needs-schema-1`.
  - Page: `loudness` (0–3), `cursor` (`native` by default, or `follower`: work links then say View) and
    `defaults: { space, align, scale, crop }` (a default a block does not take is ignored
    for it).
  - Every block: `variant`; `loudness`; `tone` (base, subtle, raised, inverse, block-1 to block-4, from the brand's
    `/4` colour blocks); `space` and `scale` (s, m, l, xl); `align` (start, center, offset, split, as each block
    allows); `crop` (none, edge, bleed: hero, case, signature); `motion: { enter, intensity, direction, stagger }`;
    `scroll: { pattern, length, snap }`.
  - Codes: `unknown-variant`, `out-of-range`, `unsupported` (a knob the block does not take), `contradiction` (scroll
    at loudness 0, a pin below loudness 2, a pattern that fights the variant, `snap` without a pin) and `missing`
    (a film or split hero without media, a swap without words).
  - Variants, the first being each block's default (today's rendering):

    | block | variants |
    |---|---|
    | hero | stacked, giant-type, split, film, product, index, interactive (with a `scene`: the scene fills the band behind the words; without one it renders as giant-type) |
    | statement | plain, centred, offset, marquee, fill, swap |
    | work | grid, hover-list, stack, rail, fullscreen-cases (each piece a full screen, its picture bleeding under the media scrim, its words on it), bento (a mosaic on Bento, the first piece leading) |
    | case | editorial, scale |
    | numbers | counter, plain, lead |
    | process | list, pinned, rows |
    | logos | grid, marquee |
    | quote | large, rail, pull |
    | offer | cards, table, toggle (a radio group switches every price between two `periods`, each item giving its two `prices`; CSS only, so it works with no script; the prices are a live region) |
    | timeline | list, horizontal |
    | faq, contact | one each |
    | gallery | rail, masonry, grid, hover-list, wheel (see the page blocks below) |
    | comparison | slider |
    | story | pinned, stacked |
    | testimonials | grid, rail |
    | journal | list, featured |
    | form | underline, conversational |
    | showreel | player |
  - `examples/studio-of-one-loud.page.json` is the reference page at loudness 3, using the expressive variants (the
    showcase serves it at `sites.html?page=loud`).
- **Scenes (`scene`, from 1.22).** On `hero` (the `interactive` variant), `case` and `signature`:
  `scene: { kind, preset?, quality?, model?, depth?, hotspots?, variants? }`.
  - `kind`: `shader` (presets gradient-noise, aurora, grain-field, flow), `particles` (dust, field, morph), `depth` (the
    block's image and its `depth` map), `model` (a `.glb` or `.gltf`, with up to 8 `hotspots` `{ id, position, label }`
    and 2–6 finish `variants` `{ id, label, colors }`), or `rail` (a camera flight through the block's scroll).
  - `quality` (`auto`, `high`, `medium`, `low`, `poster`) is a ceiling: the capability gate always runs, and `poster`
    means the poster everywhere.
  - Codes: `contradiction` (a declared loudness below 3, a scene on a hero that is not `interactive`, a scene in a
    `scale` case), `missing` (a model without its GLB, a depth scene without both images), `unsupported` (a preset or
    field of another kind), `bad-media` (a model that is not GLB or glTF).
  - The block's image is the poster (eager on the hero, where it is the LCP); the scene starts after mount, near the
    view, at loudness 3, without reduced motion and only on a device the gate passes. Hotspots are real buttons over
    the canvas, mirrored in a list the server writes; finishes are a radio group; anything that moves on its own has a
    pause control.
  - Three.js loads only for a page with a model, particles or rail scene, as its own chunk; a page without one never
    downloads it. A product that bundles `@aleeforoughi/feather-page` itself installs `three` (an optional peer) or
    aliases it to an empty module.
- **The page blocks (`feather.page/1`, from 1.23).** Blocks only a `/1` page takes, in `PAGE_BLOCKS` in `spec.ts`. They
  are the page's, not the Living Page's: `BLOCK_NAMES` stays the living library, a prepared scene (an answer) cannot
  hold one (`unknown-block`), and on a `/0` page one is `needs-schema-1`.

  | block | fields | variants | what holds at every tier |
  |---|---|---|---|
  | `gallery` | `title?`, `body?`, `items` (2–24: `{ media, title?, caption? }`), `loop?` | rail (default: a native snap rail, previous and next, keyboard-scrolled; `loop` makes it endless), masonry (columns in a set rhythm of aspects), grid (the caption on the scrim, revealed on hover and focus, always shown on touch), hover-list (an index whose picture follows hover and focus; thumbnails on touch), wheel (a ring turned one step by drag, horizontal scroll or the arrow keys; loudness 2, motion allowed and three images, else the rail) | Every image opens feather-react's `Lightbox` (no download on a site); each is a real link to its file first, so with no script it still opens. A loop's copies are `aria-hidden` and inert, and Tab leaves. Only the wheel's front image is reachable, and which one it is is announced. |
  | `comparison` | `title?`, `body?`, `before`, `after`, `beforeLabel?`, `afterLabel?` (40), `start?` (0–100) | slider | A native range, named, with the arrow keys, Home and End, its value spoken as both shares (`aria-valuetext`). Both pictures are in the document with their alt text; with no script they stand side by side. `crop` takes the frame off the grid. |
  | `story` | `title?`, `steps` (2–6: `{ title, body?, media }`) | pinned (default: the picture pinned on Stage, changing to the step crossing the middle; `scroll.snap`), stacked | Below loudness 2, under reduced motion and with no script, Stage stacks the steps in reading order, each with its picture; stacked always does. The frame shows the theme's placeholder until each picture decodes. |
  | `testimonials` | `title?`, `items` (2–12: `{ text, by, role? }`) | grid, rail | quote's own cards (`QuoteCard`): a figure, a blockquote and the attribution. |
  | `journal` | `title?`, `items` (1–12: `{ date (YYYY-MM-DD), title, excerpt?, href, media? }`), `more?` (one link) | list, featured (the first entry leads with its picture) | A real `<time datetime>`, the title as the link, the pictures decoration. |
  | `form` | `title?`, `body?`, `action` (an http(s) URL, a path, or `mailto:`), `fields` (1–8: `{ name (a slug), label, type? (text, email, tel, url, number, textarea, select, choice), required?, hint?, placeholder?, options? (2–8, select and choice), max? (1–4000), autocomplete? }`), `submit?`, `note?` | underline (default: every field a minimal baseline), conversational (one question at a time, its place announced, Back and Next, Enter moves on) | A real `<form method="post">` that works with no script (a `mailto:` action writes the answers as text/plain), the whole form shown. feather-react's Field, Input and Textarea; a select and a choice are native until the script runs, then its Select and RadioGroup, with the same names. With script, messages in words beside each field (announced as they appear), a summary of what needs a look, and focus on the first. |
  | `showreel` | `title?`, `body?`, `media` (a video, with its `poster`), `captions?` (a `.vtt`), `speech?` | player | Play and pause, sound and captions are real buttons (sound and captions with `aria-pressed`), always visible. It starts muted only with motion allowed, off data saver and at loudness 1; otherwise the poster waits for Play. A film with speech must carry its captions. With no script it is the browser's player, with the same track. |

  Codes: `missing` (a gallery or comparison picture without alt text, a select or choice without options, a showreel
  without its poster, speech without captions), `contradiction` (a decorative gallery or comparison picture, `loop` on a
  gallery that is not a rail or a wheel, options or `max` where they do not belong), `bad-href` (a form action that is
  not http(s), a path or `mailto:`), `bad-media` (a showreel that is not a video, captions that are not WebVTT),
  `duplicate-id` (a field name used twice), `type` (a journal date not written YYYY-MM-DD, a field name that is not a
  slug).
- **Image treatments (`treatment`, from 1.23).** A block knob, on the blocks with images (hero, case, signature, work,
  gallery, story, journal): `clean` (default), `clip-reveal` (uncovered as it enters), `inner-parallax` (drifts inside
  its frame), `blur-to-sharp` (soft until it decodes), `duotone` (the brand's primary and surface), `grain` (a still
  film grain). Each is MediaFrame's, decoration only (the alt text stays the content) and CSS-first: the moving ones
  run on the browser's scroll timeline where it has one, rest under reduced motion and on the LCP image, and need
  loudness 1 (clip-reveal, blur-to-sharp) or 2 (inner-parallax): a declared loudness below that is a `contradiction`;
  on a block without images it is `unsupported`. The film hero keeps its scrim and takes none.
- **The film hero (from 1.23).** Its poster (or image) is the LCP: an eager, high-priority image the server writes,
  painted over the media scrim until it decodes, so the copy over it (held at 4.5:1 by the scrim) reads from the first
  paint. The film arrives after mount, only with motion allowed and off data saver; under reduced motion and on data
  saver the poster stays alone with a visible Play control (Pause while it plays). With no script it is the poster.
- **MediaFrame's placeholder (from 1.23).** Every frame is painted from the theme until its media decodes: the subtle
  surface, or the media scrim for film. It is a CSS background (so it holds with no script, and nothing shifts: the
  frame's box is its aspect), and the frame drops it once its media is ready.
- **Loudness on a page.** `FeatherPage` sets `data-loudness` on `<main>` from `page.loudness`, and each block's section
  from its own knob; the brand's default is the theme's `--loudness` (`feather-tokens/4`). The expression components
  ask what the level allows: a reveal needs 1, kinetic type, pins, horizontal tracks and scrubbed sequences need 2,
  a World scene needs 3; below that each shows its static form. Reduced motion is stronger than any loudness.
- **Static or hydrated.** `feather-page build` writes static pages that read completely with no script, never with
  the loader. `--runtime <href>` (the release's `feather-page-runtime.js`) makes each page carry its document and
  brand and hydrate: the loader, the menu, the motion and the Living Page come alive with no re-render.
- `scenes` are the prepared answers. With `living.prepared`, each becomes a static, indexable route that works with
  the model off.

## Codes

`wrong-schema`, `not-object`, `missing`, `type`, `too-long`, `unknown-block`, `unknown-field`, `too-few`, `too-many`,
`bad-href`, `bad-media`, `unknown-ref`, `unknown-scene`, `duplicate-id`, `no-speaker`.
