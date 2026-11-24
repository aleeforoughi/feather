# Websites from a schema: `feather.page/0`

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
- `scenes` are the prepared answers. With `living.prepared`, each becomes a static, indexable route that works with
  the model off.

## Codes

`wrong-schema`, `not-object`, `missing`, `type`, `too-long`, `unknown-block`, `unknown-field`, `too-few`, `too-many`,
`bad-href`, `bad-media`, `unknown-ref`, `unknown-scene`, `duplicate-id`, `no-speaker`.
