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
  `timeline`, `process`, `logos`, `quote`, `offer`, `faq`, `contact`, one `signature` block per brand, and (from
  1.23, `feather.page/1` only) the product flows `quiz`, `booking`, `calculator`, `chart`, `places` and `podcast`. It is
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
    | work | grid, hover-list, stack, rail |
    | case | editorial, scale |
    | numbers | counter, plain, lead |
    | process | list, pinned, rows |
    | logos | grid, marquee |
    | quote | large, rail, pull |
    | offer | cards, table |
    | timeline | list, horizontal |
    | faq, contact | one each |
    | quiz, booking, podcast | one each (`steps`, `steps`, `list`) |
    | calculator | split (the total stays beside the inputs on wide screens), stacked |
    | chart | bar, line, area |
    | places | list, map (the page's own still map beside the list; needs `media`) |
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
- **Product flows (from 1.23).** Blocks of `feather.page/1` (on a `/0` page each is `needs-schema-1`) that compose
  native controls, never scripted widgets: each works in full with no script, as a static, honest form, and keeps the
  person in control (nothing advances, plays or sends on its own).

  | block | fields | with no script |
  |---|---|---|
  | `quiz` | `title`, `body?`, `scoring` (`tally` or `score`), 1–8 `questions` `{ id, q, help?, options: 2–6 { id, label, result? \| score? } }`, 1–8 `results` `{ id, title, body?, href?, label?, min?, max?, match? }` | every question at once, and "How the result is decided" listing every result and its rule |
  | `booking` | `title`, `body?`, 1–8 `services` `{ id, name, duration?, price?, body? }`, 1–14 `days` `{ date (YYYY-MM-DD), label?, slots: 1–16 HH:MM }`, `zone?`, `ask?: { phone?, note? }`, exactly one of `action` (a form handler), `mailto` (an address) or `link` (an https booking page), `confirm?` | one form: services and slots as radios, the details, a submit (or the link) |
  | `calculator` | `title`, `body?`, 1–8 `inputs` `{ id, label, kind: range \| number \| radio \| toggle, min?, max?, step?, value?, unit?, help?, options? }`, up to 6 `lines` `{ id?, label, formula }`, `formula`, `total?`, `prefix?`, `suffix?`, `decimals?` (0–2), `note?` | the starting prices: the total at the starting choices and what each choice makes it |
  | `chart` | `title`, `summary` (required), 1–4 `series` `{ label }`, 2–24 `rows` `{ label, values }` (one per series), `axis?`, `unit?`, `prefix?`, `decimals?`, `source?` | the end state (the SVG is the markup) and the table |
  | `places` | `title`, `body?`, `media?` (a still map), 1–24 `items` `{ name, address, directions?, href?, phone?, hours?, note? }` | the same list and links |
  | `podcast` | `title`, `body?`, 1–12 `episodes` `{ id, title, audio, duration?, date?, summary?, chapters?: { at, title }[], transcript: { at?, by?, text }[] }` | the browser's own audio controls, the chapters as text, the transcript |

  - The quiz goes one question per step (Next, Back, Start again; focus moves to each step's heading). A result's
    `match` (question id to option id) wins first; otherwise `tally` gives the result most answers point to (a tie to
    the one listed first) and `score` the first result whose `min`–`max` holds the total.
  - The booking flow goes service, date and time, details, then a review where every choice has its Change button.
    Slots come from the page; days are listed, never a grid. `mailto` opens the person's mail app with the request
    written out; nothing is sent until they send it.
  - The calculator's formulas are a small language with no eval: numbers, input and line names, `+ - * /`,
    parentheses, `min`, `max` and `round(x)` or `round(x, places)`. A line reads the inputs and the lines before it;
    the total reads all of them. The total and its breakdown are a polite, atomic live region.
  - The chart draws in the text ink (7:1 on the ground in every brand) with a distinct mark per series (solid, hatch,
    dots, cross; or solid, dashed, dotted, dash-dot lines), so no series is told apart by colour alone. Its summary is
    the figure's caption and the data is a table behind a disclosure. It draws in on reveal at loudness 1 and up, never
    under reduced motion or when already on screen at load.
  - The podcast never autoplays and loads nothing before play (`preload="none"`); its controls are real buttons, the
    scrub slider speaks its value as time, chapters seek, one episode plays at a time, and the page's ambient sound is
    muffled while one does. The transcript can follow playback when the person turns that on.
  - Codes: `bad-formula` (a formula that does not parse, with the character), `unknown-ref` (a formula name, a tally
    answer's result or a match that points nowhere), `contradiction` (a scored total no result covers, a formula with
    no value at an input's bounds, a booking that sends to two places, a chart row that does not fit its series,
    chapters or transcript out of order), `missing` (a booking with nowhere to send, a transcript, a range input's
    bounds), `unsupported` (a field of another input kind), `bad-href` and `bad-media` (an episode that is not audio),
    `duplicate-id`.
- **The view-mode switch (`views`, from 1.23).** On `work` (and any block in `VIEW_BLOCKS`): `views: grid | list |
  index` names the view the block starts in, which is its static form; with script, a segmented radio group switches
  grid, list and index, remembered per page and block. It switches the grid's layout, so another variant, or a stack or
  horizontal scroll, is a `contradiction`.
- **The colour scheme toggle (`scheme`, from 1.23).** A page-level knob: `scheme: { toggle?: nav | footer, colors }`,
  where `colors` is the brand's other set (`background`, `surface`, `text`, `primary` and optionally `primaryText`,
  `accent`, `accentText`, `destructive`, as `#hex`), compiled by the theme engine beside the brand. `prefers-color-scheme`
  decides first; the toggle (light, dark, system, a real radio group in the nav's bar or the footer) sets
  `data-scheme` on `<html>`, remembered for the site. `feather-page build` writes `schemeScript()` into the head, so a
  remembered choice is on the page before its first paint; with no script the system's preference holds and the toggle
  is not shown. The validator checks the toggle has an edge to sit in (`missing`), the colours are hex (`type`) and
  that text reads at 4.5:1 on its ground (`contradiction`); the renderer refuses a set of the same scheme as the brand.
- `examples/studio-of-one-flows.page.json` is the reference page for the flows (the showcase serves it at
  `sites.html?page=flows`, with each brand's own other set).
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
`bad-href`, `bad-media`, `unknown-ref`, `unknown-scene`, `duplicate-id`, `no-speaker`; for the knobs
`needs-schema-1`, `unknown-variant`, `out-of-range`, `unsupported` and `contradiction`; for the calculator
`bad-formula`.
