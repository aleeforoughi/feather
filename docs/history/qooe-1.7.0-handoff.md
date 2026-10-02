# Feather: handoff

Feather is QOOE's master design system: one themeable system that every product QOOE builds is cut from. A brand is applied through tokens, never by editing component code. This package holds everything Feather is today, so a larger Feather project can continue it in its own repository.

## Package contents

| Folder | What it is |
|---|---|
| `feather-web/` | The component system: React + TypeScript + Tailwind CSS v4 + Base UI, shadcn-style source components, Storybook, the theme engine, the branch tool, the hygiene gate and the manifest. Install and run it as is. |
| `feather-web/storybook-static/` | A prebuilt Storybook of every component and story. Open `index.html` through any static server to browse without installing. |
| `docs-templates/` | Feather for documents: token-themed HTML/CSS templates rendered to PDF (multi-page) or PNG. The first is `brand-guidelines/`. |
| `render-kit/` | The document rendering and checking tools, Node built-ins only and offline: `render.mjs` (headless Chromium to exact-size PNG, or PDF plus page previews, plus a layout report), `verify.mjs` (deliverable checks and layout gates) and the bundled OFL fonts. |
| `INVENTORY.md` | Every component: level, exports, slots, stories (from `foundation.json`). |
| `CHANGELOG.md`, `FEATHER.md` | Version history and the admission standard. |
| `PRODUCTION-METHOD.md` | When something is made with code (templates) and when with image generation. |
| `MANIFEST.txt` | Every file in the package with its SHA-256. |

## Architecture

- **Three tiers of tokens.**
  1. **Brand tokens:** `brand/tokens.json`, schema `qooe-tokens/1`.
  2. **Semantic tokens:** CSS variables such as `--primary`, `--background`, `--card`, `--foreground`, `--muted`, `--border`, `--destructive`, `--success`, `--warning`, `--info` and their `-foreground` pairs, plus `--chart-1..5`, `--radius`, shadows, motion and fonts, mapped into Tailwind as `bg-primary`, `text-success` and so on.
  3. **Component tokens:** per `data-slot` overrides, written as `"button"` or `"button.outline"` in the brand tokens.
  
  Components read only semantic tokens. Raw colors are refused by the hygiene gate.
- **Theme axes:**
  - shape: `sharp | soft | rounded | pill`;
  - density: `compact | comfortable | spacious`;
  - elevation: `flat | soft | dramatic`;
  - motion: `calm | snappy`.
  
  Two reference themes in `feather-web/themes/` (`paper-sharp`, `void-pill`) must always compile and pass WCAG AA.
- **Theme engine.** `npm run brand` (`scripts/apply-brand.mjs`) turns `brand/tokens.json` into `src/styles/brand.css` and `brand-fonts.css`.
  - It is deterministic, with no network and no dependencies.
  - It derives readable on-colors from luminance and writes dark values.
  - Status colors are the brand's own (`colors.success|warning|info`), or defaults tuned for a light or dark background.
  - Component tokens accept only `radius`, `borderWidth`, `shadow`, `fontWeight`, `letterSpacing`, `textTransform`, `fontFamily` (`display|body`), `paddingX`, `height`, `background`, `foreground` and `borderColor`. Colors go by role (`primary`, `surface`…) or hex.
- **Slots and variants.** Every visible part has a `data-slot`, and every variant or state a `data-variant`. That is what makes component tokens and product styling possible without forking code.
- **Motion.** `useThemeMotion()` (`src/lib/motion.ts`) reads the theme's duration and easing and honours `prefers-reduced-motion`.
- **Fonts.** 14 families are pre-installed through Fontsource (variable where available), so everything works offline: Geist, Inter, Sora, Space Grotesk, DM Sans, Plus Jakarta Sans, Outfit, Fraunces, Manrope, Nunito, Playfair Display, JetBrains Mono, Figtree and Poppins.

### Brand tokens (`qooe-tokens/1`)

```json
{
  "name": "Acme",
  "colors": { "primary": "#C2410C", "background": "#FAF7F2", "surface": "#FFFFFF", "text": "#1B1A17",
              "accent": "#…", "border": "#…", "destructive": "#…", "success": "#…", "warning": "#…", "info": "#…" },
  "typography": { "fontFamily": { "display": "Fraunces", "body": "DM Sans" }, "scale": { "sm": "14px", "md": "16px", "lg": "24px", "xl": "40px" } },
  "spacing": { "xs": "4px", "sm": "8px", "md": "16px", "lg": "32px" },
  "radius": { "sm": "6px", "lg": "16px" },
  "shape": "sharp", "density": "comfortable", "elevation": "flat", "motion": "calm",
  "voice": ["calm", "plain"],
  "components": { "button": { "radius": "pill", "fontWeight": 600 }, "button.outline": { "borderWidth": "2px" } }
}
```

## What it contains (1.7.0)

**35 components** (28 atoms and 7 molecules) with **133 stories**. The full list is in `INVENTORY.md`.

- **Atoms:** accordion, alert, avatar, badge, breadcrumb, button, card, checkbox, dialog, dropdown-menu, field, input, label, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, sonner (toasts), switch, table, tabs, textarea, tooltip.
- **Molecules:**
  - `lightbox`: one image of a set, large, with navigation, download and a transparency checkerboard;
  - `media-gallery`: titled sections of image tiles that open the lightbox;
  - `activity-feed`: a live log, newest at the bottom, with typed text and working dots;
  - `attention-card`: a decision the user must make;
  - `step-list`: plans and progress;
  - `budget-bar`: spent against a target and a cap, with zones;
  - `role-avatar`: people and agent roles as avatar, chip, card and group.
- **Documents:** the `brand-guidelines` template (12–14 landscape pages at 1600×1000, themed only through `tokens.css` generated from `brand/tokens.json`; content and image slots by `data-slot`). Each template has a `template.json` manifest and a README.

## How products use it (the branch model)

1. **Branch.** A product starts as a copy of Feather (the template id `feather-web`).
2. **Pick.** The UI designer picks its components in `design/feather.json`.
3. **Cut.** `npm run branch` (`scripts/feather-branch.mjs`):
   - keeps those components and what they import, removes the rest;
   - writes a themed component sheet (`sheet.html`);
   - records `feather.lock.json`: the Feather version, the components and a content hash of each, so edits to a themed atom are detectable.
4. **Theme.** `npm run brand` themes the branch.
5. **Upgrade.** `node scripts/feather-branch.mjs --upgrade-from <Feather master>` upgrades a branch in place to a newer Feather.

Products compose their pages from Feather. They build product components only for real gaps, and report reusable ones back to Feather.

## Rules for adding to Feather (`FEATHER.md`)

A component earns its place only if all six hold:

1. **Reusable:** a pattern, not a screen.
2. **Not a duplicate:** extend an existing component instead.
3. **Not crowding:** fewer, stronger components.
4. **Themeable:** semantic tokens, slots and variants, theme motion.
5. **Standard:** accessible, real stories, compiles in both reference themes, listed in the manifest.
6. **Versioned:** a minor version per addition, a CHANGELOG entry, hygiene green.

The **hygiene gate** (`npm run hygiene`) checks the whole system before every release:
- **tokens:** each defined once, has a dark value, is mapped and written by the engine;
- **mappings:** every `var()` resolves;
- **components:** stories, one slot owner, no raw colors, no near-duplicates;
- **reference themes:** they read at WCAG AA;
- **release:** version, manifest and changelog agree.

## Documents: templates and rendering

Owner rule: documents, sheets and print are **code**, not image generation. HTML/CSS is exact, editable and nearly free to re-render, so updates mean editing text or swapping an image. Image generation is for complex visuals placed inside: photos, illustrations, mockups. See `PRODUCTION-METHOD.md`.

**Page contract.** An HTML page declares `<meta name="qooe:output" content="guideline/x.pdf">` and `<meta name="qooe:size" content="1600x1000">`. A PDF is a sequence of `<section class="page">`. Fonts come from `fonts/fonts.css`, offline.

**`render-kit/render.mjs`** runs inside `mcr.microsoft.com/playwright@sha256:55db7b71…` (headless Chromium, no network). For each page it:
- prints to PDF, or screenshots to an exact-size PNG;
- writes a preview PNG per PDF page;
- writes a layout report: text below the minimum size, WCAG contrast, out of bounds, overlaps, clipped text, missing images, font fallback.

**`render-kit/verify.mjs`** checks deliverables against `.qooe/deliverables.json`:
- formats, exact sizes, transparency, page counts, renders older than their sources, stray files;
- the layout gates from the render report.

Its last line, `qooe-failures: [...]`, tags every failure with its files, so a caller can scope failures.

**A template** is themed only through `tokens.css`, which `tokens-from-json.mjs` generates from `brand/tokens.json`. Every content and image slot is a `data-slot`, and `template.json` lists the slots, images, pages and size.

## Quality and current state

- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run manifest` and `npm run hygiene` all pass at 1.7.0.
- **Used in production work** by Qoco Panel, QOOE's admin app (a Feather branch), and by QOOE's agents: every design and build role works Feather-first.
- **Known gaps and candidates for the next Feather:**
  - **Molecule candidates proven in Qoco Panel, not yet generic:**
    - a terminal-style log console (filters, search, copy and download, pause-on-scroll);
    - a decision review sheet (tabs for scope, plan, proposals with verdicts, budget);
    - a live "now" status line (one sentence per worker, fading, with durations and thumbnails);
    - a chat composer with suggestion chips.
  - **Semantic tokens.** `--chart-1..5` are grayscale in the default theme. Categorical colors for data and roles need a design.
  - **Documents.** Only the brand guideline template exists so far. Planned: business card and stationery, brochure, report, deck and one-pager, all on the same tokens and page contract.
  - **Logos.** Vector delivery (SVG via tracing) is not in yet; logos ship as high-resolution transparent PNG.
  - **Storybook.** Interaction tests and visual regression snapshots are not yet in the pipeline.

## Run it

```bash
cd feather-web
npm ci
npm run storybook        # browse every component; switch the reference themes in the toolbar
npm run brand            # theme it from brand/tokens.json
npm test && npm run lint && npm run typecheck && npm run build
npm run manifest         # rebuild Storybook and regenerate foundation.json
npm run hygiene          # the release gate
```

Render a document (requires Docker):

```bash
docker run --rm --network none -v "$PWD":/work -w /work mcr.microsoft.com/playwright@sha256:55db7b712a981e9cc1ec757a4511cd01c5ed4e20bd7c84b2dee4e1d320102b9d node .qooe/tools/render.mjs
```

Pinned dependencies are in `feather-web/package-lock.json`. QOOE's rule is that dependencies must pass a minimum release age before an upgrade.

## Origin

Built by QOOE (qooe-core, `qooe/feather/`), 2026-10-01 to 2026-10-03, from 1.0.0 (atoms and the theme engine) to 1.7.0. `CHANGELOG.md` records each step and where it came from.
