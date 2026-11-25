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
    | hero | stacked, giant-type, split, film, product, index, interactive (renders as giant-type until wave 4) |
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
  - `examples/studio-of-one-loud.page.json` is the reference page at loudness 3, using the expressive variants (the
    showcase serves it at `sites.html?page=loud`).
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
