# Feather

**Feather is a design system that products install as packages and reshape with one brand file.** It renders the next
necessary human interaction, shaped to this person, on this device, and the websites around it, from the same tokens:
change the brand and everything restyles, with accessibility and reduced-motion paths built in.

## Three ways in

| You are building | Start here |
|---|---|
| **Product UI**: an app, a dashboard, a tool | `@aleeforoughi/feather-react` and `@aleeforoughi/feather-tokens`: 28 atoms, 7 molecules and 10 organisms on Base UI and Tailwind CSS v4, styled only through tokens |
| **A website**: a studio, a portfolio, a launch | `@aleeforoughi/feather-page`: one `feather.page/1` JSON document and a brand file give a complete, themeable site, with the [Living Page](docs/living.md) layered on |
| **A caller**: a service that decides what a person must do | The [Experience IR](docs/ir/README.md) and `feather-sdk` for Python, or `@aleeforoughi/feather-embed` for any page: send meaning, get the person's checked reply |

```bash
npm install @aleeforoughi/feather-react @aleeforoughi/feather-tokens   # after pointing @aleeforoughi at GitHub Packages
npx feather-brand                                                      # brand/tokens.json -> a theme
```

## Read next

| | |
|---|---|
| [Getting started](docs/getting-started.md) | Install, theme, a first page, a first product screen, a Python caller |
| [The package map](docs/packages.md) | Every package, its entry points, who depends on whom |
| [Theming](docs/theming.md) | The brand file from primitives to component tokens, loudness, and what the engine refuses |
| [Patterns built](docs/patterns.md) | The award patterns Feather has, by release, and what is planned |
| [The visual system](docs/visual-system.md) | Every value, with its reason, and the gates that enforce it |
| [Changelog](CHANGELOG.md) | Release by release |
| Storybook (`pnpm storybook`) | Every component in all seven reference brands, the Foundations pages, and a theme builder |

## What it holds

- **Static foundation:** themeable React components, a token-driven theme engine (`feather-tokens/4`), and the gates that
  keep them clean.
- **The liquid core:** the [Experience IR](docs/ir/README.md), [ten organisms](docs/organisms.md) that each render one node,
  and [`compose(experience, context)`](docs/composer.md), which turns an experience and who it is for into a layout plan by
  named rules with a trace.
- **More than one body:** the same experience as [web, switch scanning, voice and plain text](docs/manifestations.md); a
  conformance suite proves every act reaches the same reply in all four.
- **The website layer:** [primitives for award-grade sites](docs/expression.md) (type, media, scroll, routes, scenes), the
  [Living Page](docs/living.md), and [pages from a schema](docs/page.md).
- **Callers:** a Python SDK and a one-import browser bundle ([callers](docs/callers.md)).

Feather never calls a model, stores a person, or imports a product. What earns a component its place, and how it is
versioned, is in [`FEATHER.md`](FEATHER.md).

## Develop

Node 24 (22.22.2 or later works) and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm storybook             # every component; switch the reference themes in the toolbar
pnpm build                 # build the packages
pnpm lint && pnpm typecheck && pnpm test
pnpm hygiene               # the release gate
pnpm manifest              # rebuild Storybook and regenerate packages/react/foundation.json
pnpm test:a11y             # axe on every story (FEATHER_THEME=feather|feather-dark|paper-sharp|void-pill)
pnpm test:visual           # every story in all four reference themes against visual/__screenshots__
pnpm --filter @feather-apps/playground dev   # the playground
node packages/manifest-text/dist/cli.js conformance/ir/valid/ad-campaign-launch.json   # an experience in the terminal
pnpm test:playground       # build the playground and run its end-to-end tests (CHROMIUM_PATH to reuse a browser)
pnpm test:python           # the Python SDK, including parity with the TypeScript validators
pnpm test:embed            # the embed inside a foreign page (Godpip's own stylesheet)
pnpm build:wheel           # the feather-sdk wheel, with the browser bundle inside
pnpm test:caller           # the Python reference caller, end to end (feather-sdk importable by python3)
```

The visual baselines are recorded in CI's Playwright container (the *Record visual baselines* workflow), so a
local run only matches pixel for pixel inside `mcr.microsoft.com/playwright:v1.63.0-noble`.

### Gates

Every change passes CI: lint, types, unit tests, the package build, the hygiene gate, the Storybook build, axe
on every story in both reference themes, visual regression of every story in both themes, and the playground's
end-to-end tests. What earns a
component its place, and how it is versioned, is in [`FEATHER.md`](FEATHER.md).

### Release

All packages share one version. To release, bump it in every `package.json`, add the `CHANGELOG.md` entry,
run `pnpm manifest`, and merge to `main`. The *Publish* workflow sees a version with no `v<version>` tag, checks
every gate again, publishes to GitHub Packages, then creates the tag and a GitHub release from the changelog
entry. A push to `main` with an unchanged version publishes nothing.

## History

Feather was built inside QOOE (`qooe-core/qooe/feather`) from 1.0.0 to 1.7.0, 2026-10-01 to 2026-10-03. The
first commit here imports that release unchanged; `git log --follow` traces every file back to it. The QOOE
handoff and its file manifest are in [`docs/history`](docs/history).

Proprietary; see [`LICENSE`](LICENSE).
