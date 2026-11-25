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
    agent. Without one (from 1.23) a living page shows "An AI agent speaking for {speaker.name}" (`pageDisclosure`),
    which holds to the same rule (`DISCLOSURE_RULE`).
- **The block library** is the Living Page's (Qooler file 22 §3): `hero`, `statement`, `work`, `case`, `numbers`,
  `timeline`, `process`, `logos`, `quote`, `offer`, `faq`, `contact`, and one `signature` block per brand. It is the
  same set as `@aleeforoughi/feather-living`'s `BLOCK_KINDS`, and a test holds them equal. An answer is built only
  from these. A `feather.page/1` page also takes the page blocks (`PAGE_BLOCKS`, from 1.23: the media blocks and the
  product flows, below), in its sections only.
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
  - Page: `loudness` (0–3), `cursor` (`native` by default, or `follower`: work links then say View),
    `defaults: { space, align, scale, crop }` (a default a block does not take is ignored
    for it) and `layout` (from 1.23, below).
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
- **The page blocks (`feather.page/1`, from 1.23).** Blocks only a `/1` page takes, in `PAGE_BLOCKS` in `spec.ts`. They
  are the page's, not the Living Page's: `BLOCK_NAMES` stays the living library, a prepared scene (an answer) cannot
  hold one (`unknown-block`), and on a `/0` page one is `needs-schema-1`.

  | block | fields | variants | what holds at every tier |
  |---|---|---|---|
  | `gallery` | `title?`, `body?`, `items` (2–24: `{ media, title?, caption? }`), `loop?` | rail (default: a native snap rail, previous and next, keyboard-scrolled; `loop` makes it endless), masonry (columns in a set rhythm of aspects), grid (the caption on the scrim, revealed on hover and focus, always shown on touch), hover-list (an index whose picture follows hover and focus; thumbnails on touch), wheel (a ring turned one step by drag, horizontal scroll or the arrow keys; loudness 2, motion allowed and three images, else the rail) | Every image opens feather-react's `Lightbox` (no download on a site), which loads only on the first open (the release's `feather-page-parts.js`); each is a real link to its file first, so with no script it still opens. A loop's copies are `aria-hidden` and inert, and Tab leaves. Only the wheel's front image is reachable, and which one it is is announced. |
  | `comparison` | `title?`, `body?`, `before`, `after`, `beforeLabel?`, `afterLabel?` (40), `start?` (0–100) | slider | A native range, named, with the arrow keys, Home and End, its value spoken as both shares (`aria-valuetext`). Both pictures are in the document with their alt text; with no script they stand side by side. `crop` takes the frame off the grid. |
  | `story` | `title?`, `steps` (2–6: `{ title, body?, media }`) | pinned (default: the picture pinned on Stage, changing to the step crossing the middle; `scroll.snap`), stacked | Below loudness 2, under reduced motion and with no script, Stage stacks the steps in reading order, each with its picture; stacked always does. The frame shows the theme's placeholder until each picture decodes. |
  | `testimonials` | `title?`, `items` (2–12: `{ text, by, role? }`) | grid, rail | quote's own cards (`QuoteCard`): a figure, a blockquote and the attribution. |
  | `journal` | `title?`, `items` (1–12: `{ date (YYYY-MM-DD), title, excerpt?, href, media? }`), `more?` (one link) | list, featured (the first entry leads with its picture) | A real `<time datetime>`, the title as the link, the pictures decoration. |
  | `form` | `title?`, `body?`, `action` (an http(s) URL, a path, or `mailto:`), `fields` (1–8: `{ name (a slug), label, type? (text, email, tel, url, number, textarea, select, choice), required?, hint?, placeholder?, options? (2–8, select and choice), max? (1–4000), autocomplete? }`), `submit?`, `note?` | underline (default: every field a minimal baseline), conversational (one question at a time, its place announced, Back and Next, Enter moves on) | A real `<form method="post">` that works with no script (a `mailto:` action writes the answers as text/plain), the whole form shown. Every field is the browser's own control (input, textarea, select, a radio group in a fieldset) in the house's underline style and tokens, so the form needs nothing beyond the runtime. With script, messages in words beside each field (announced as they appear), a summary of what needs a look, and focus on the first. |
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
- **Image widths (`srcset`, from 1.23).** A media object (and each of its `sources`) takes `srcset`: a list of 1 to 8
  `{ src, w }` (`w` a whole number of px), or the same as a srcset string of `w` descriptors
  (`"hero-800.jpg 800w, hero-1600.jpg 1600w"`). Each URL is checked as a media `src`. The `sizes` is never the
  caller's: Feather derives it from where the image sits (`MEDIA_SIZES` in `src/blocks/sizes.ts`, one table: the
  block, its variant, its crop, and the page grid's content width at each breakpoint, capped at 1344px). Examples:
  - a split hero is half the grid from 1024px (`(min-width: 1440px) 672px, …, calc(100vw - 2rem)`), or 50vw when
    cropped;
  - anything full bleed, the film hero and the pinned story are `100vw`;
  - work's grid cards go by their column count;
  - the gallery's rail is `(min-width: 640px) 24rem, 20rem`, its wheel 20rem, and masonry and grid go by their
    columns.

  The server writes `<img srcset sizes>` (and `<source srcset sizes>`); the LCP image keeps `fetchpriority="high"`.
  A video's `srcset` is its poster's (the film hero's and a scene's poster use it). Without a srcset the markup is
  exactly as before. Codes:
  - `bad-srcset`: a rendition that is not `{ src, w }`, a src that is not a safe path, a width that is not a whole
    number from 1 to 10000 or is given twice, or a string candidate that is not `url Nw`;
  - `too-few` and `too-many`: the count of renditions;
  - `type`: neither a list nor a string;
  - `needs-schema-1`: a srcset on a `/0` page.
- **MediaFrame's placeholder (from 1.23).** Every frame is painted from the theme until its media decodes: the subtle
  surface, or the media scrim for film. It is a CSS background (so it holds with no script, and nothing shifts: the
  frame's box is its aspect), and the frame drops it once its media is ready.
- **Product flows (from 1.23).** Page blocks (`PAGE_BLOCKS`, beside the media blocks above: on a `/0` page each is
  `needs-schema-1`, and a prepared scene cannot hold one) that compose
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
- **Layouts (`layout`, from 1.23).** A page-level knob for the page's structure: `editorial`, `swiss`, `brutalist`,
  `poster`, `colour-blocking` or `two-colour` (`LAYOUTS` in `spec.ts`). A layout is never a colour and never a free
  value: `FeatherPage` sets `data-layout` on `<main>` (and on each section's wrapper what it decides for that section),
  and `foundation.css` draws it by re-pointing the theme's own roles (grid placement, rhythm, rules, radius, shadow and
  the grounds). It works with every block; where a block cannot follow, it keeps its own form.

  | layout | what it does | where a block keeps its own |
  |---|---|---|
  | `editorial` | Asymmetric: from 1024px every other section hangs from column 4 of 12 (`data-hang`), so the reading line steps across the page; block titles in the display face at the `s` display size | Sections off the page grid (full-bleed media, a cropped case, the film hero) do not hang |
  | `swiss` | A strict grid: a hairline in the strong border opens every section on the grid's measure, each block title carries its section's number in tabular figures (decoration, `content: … / ""`, so it is not in the heading's name), square corners, no shadows | Sections off the page grid draw no rule |
  | `brutalist` | Every border in the ink, a 3px rule in the ink between sections, square corners, no shadows, a 3px focus ring, block titles in the mono face (`font-mono`) in capitals | The hero's display title keeps the display face |
  | `poster` | Every section a full screen (`100svh`, so nothing moves with the browser's bars), its content in the middle, block titles at the `m` display size | A section taller than the screen simply runs on |
  | `colour-blocking` | Every other section (the second, fourth…) on the next of the brand's colour blocks, `block-1` to `block-4` in turn (`data-ground`), every role inside it re-pointed at the pair (solid: cards are the ground, secondary text the ink) | A block with its own `tone`, and the blocks with native controls (`LAYOUT_SKIPS`: form, booking, calculator, quiz, podcast, comparison, showreel), stay on the page ground and pass the turn on |
  | `two-colour` | The ground and one ink, with the ink's tints, for the whole document (nav and footer too): the accent, the colour blocks, the inverse and the chart series become the ink; images take the `duotone` treatment unless they name another. The ink is the brand's `primary` where it reads at 4.5:1 on the ground both ways (and on the hover tint) (`data-ink="primary"`), else its text colour (`data-ink="text"`) | State colours (an error) keep their own |

  The contrast floor holds on every ground a layout introduces. `layoutPlan(layout, sections, themes)`
  (`core/layouts.ts`) measures each colour block colour-blocking uses, and the two-colour ink, in the brand's compiled
  theme and in the scheme's other set: the ink at 4.5:1 on the ground and on its one tint, the hover (8%). A layout's
  grounds are solid and have one ink: a card on one is the ground itself, drawn apart by its rule, and secondary text
  is the ink, so no text is lighter, or sits on a tint, it was not measured on. A brand that
  cannot meet it is a `contradiction` at `/layout`: `checkLayout(page, tokens)` returns it, `feather-page build`
  prints it and exits 1 before writing anything, and `FeatherPage` refuses to render the page. A `/0` page with a layout
  is `needs-schema-1`; an unknown one is `unknown-variant`. Storybook's "Pages/Layouts" shows each layout in the three
  reference brands.
- **Templates (from 1.23).** Six whole pages in `packages/page/templates/` (shipped in the package, and in the release
  CLI), each composed from the library, the page blocks and the knobs with specific, invented copy, and each with its
  own layout. None names a brand: `brand` is a path to fill in, and the brand is the theme.

  | template | for | layout | what it uses |
  |---|---|---|---|
  | `launch` | a product launch, loudness 3 | poster | the interactive hero over an aurora shader, kinetic type (the mask enter, the fill statement), the pinned scroll story, numbers, the offer toggle, questions, a 404 |
  | `studio` | a studio or agency | swiss | the giant-type hero, bento work from the library, a case, a masonry gallery, testimonials on a rail, the process |
  | `editorial` | a journal or magazine | editorial | a full-bleed cover, the featured journal, an offset statement, a story in stacked steps, a large quote, a newsletter form |
  | `service` | a local business | colour-blocking | the split hero (its picture full bleed), services as offer cards, the booking flow, testimonials, places, questions, contact |
  | `product` | SaaS pricing | two-colour | the giant-type hero, an area chart, before and after, the calculator, the plans table, questions |
  | `creator` | a podcast or creator | brutalist | the podcast with chapters and transcripts, the showreel with captions, a conversational form, the scheme toggle |

  Each is built to the winners' measured medians (Qooler file 28): about seven sections with plain-noun section titles,
  about five single-word navigation items, a first screen that is giant type or full-bleed media with a short display
  title and two short, verb-led actions, and one filled action per section.

  `feather-page init <template>` writes one out ([getting-started.md](getting-started.md)); `import { TEMPLATES }
  from "@aleeforoughi/feather-page/templates/index.js"` gives them in code, each with its one-line description. The
  showcase serves each at `sites.html?template=<name>` in the three reference brands (its site e2e: axe, the mobile
  budgets, reduced motion; and for `launch`, no WebGL and no script), and Storybook's "Templates" section, the last, shows
  them as `feather-page init` writes them.
- **One filled action per section (from 1.23).** On the winners about a quarter of actions are filled, so the one
  filled action stands out (Qooler file 28 section 3). A section's primary action is filled and the rest are quiet
  (outlined) or text links: the hero's and contact's first action unless another says `primary: true` (an action
  field on `/1` pages; `primary: false` on every one fills none), a hero whose starters show (on a Living Page) fills
  its first starter and no action, a podcast fills the first episode's Play, a quiz's result link leads its Start again, and the flows
  fill only the step's next act. Two `primary: true` actions in one section are a
  `contradiction` at `/sections/N/actions` (`/1` only: a `/0` page has no `primary` field).
- **The render budget (from 1.23).** `feather-page build` of one direction (a page in its brand), every route, in 500 ms
  or less on two CPUs: `scripts/render-gate.mjs` builds every template and reference example in each reference brand,
  in-process, warms once, and fails when the median of five builds (validate, the layout check, render, write) passes
  the budget. CI runs it under `taskset -c 0,1`. The build itself is `bin/build.mjs`, which the CLI calls.
- `examples/studio-of-one-flows.page.json` is the reference page for the flows (the showcase serves it at
  `sites.html?page=flows`, with each brand's own other set).
- **Loudness on a page.** `FeatherPage` sets `data-loudness` on `<main>` from `page.loudness`, and each block's section
  from its own knob; the brand's default is the theme's `--loudness` (`feather-tokens/4`). The expression components
  ask what the level allows: a reveal needs 1, kinetic type, pins, horizontal tracks and scrubbed sequences need 2,
  a World scene needs 3; below that each shows its static form. Reduced motion is stronger than any loudness.
- **Static or hydrated.** `feather-page build` writes static pages that read completely with no script, never with
  the loader. `--runtime <href>` (the release's `feather-page-runtime.js`) makes each page carry its document and
  brand and hydrate: the loader, the menu, the motion and the Living Page come alive with no re-render.
- **The release runtime and its block families (from 1.23).** `feather-page-runtime.js` carries the Living Page's
  library only (built from `@aleeforoughi/feather-page/runtime`: `FeatherPageCore`, `loadPageBlocks`,
  `validateLoaded`). The page blocks ship beside it as families, each loaded only for a page whose document uses one:
  - `feather-page-media.js`: gallery, comparison, story, testimonials, journal, form, showreel;
  - `feather-page-flows.js`: quiz, booking, calculator, chart, places, podcast, the scheme toggle and the work's view
    switch, and the flows' validation rules;
  - `feather-page-parts.js`: feather-react's Lightbox, on a gallery's first open;
  - `feather-page-shared.js`: the bundler's helpers, which the runtime and its chunks share (every page loads it).

  `hydrate` reads which families the document uses, loads them, validates the page with every rule then known, and
  only then hydrates: the server's markup stays as it is meanwhile, with no flash and no mismatch. `mount` renders under
  one Suspense boundary once the families have loaded. The runtime's `validatePage` checks the flows' own rules once
  their family has loaded (hydrate and mount load it for any page that uses a flow). A library user's `FeatherPage`
  imports every block statically and is unchanged. The release check holds that no family's blocks are in what every
  page downloads, and that what every page downloads (the runtime and the shared helpers) stays within 174 KB gzip:
  Feather 1.22.0's runtime plus 10%.
- `scenes` are the prepared answers. With `living.prepared`, each becomes a static, indexable route that works with
  the model off.

## Codes

`wrong-schema`, `not-object`, `missing`, `type`, `too-long`, `unknown-block`, `unknown-field`, `too-few`, `too-many`,
`bad-href`, `bad-media`, `unknown-ref`, `unknown-scene`, `duplicate-id`, `no-speaker`; for the knobs
`needs-schema-1`, `unknown-variant`, `out-of-range`, `unsupported` and `contradiction`; for media widths `bad-srcset`;
for the calculator `bad-formula`.
