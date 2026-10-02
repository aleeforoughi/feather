# @aleeforoughi/feather-documents

Feather for documents: brand sheets, print and PDFs made with HTML and CSS, themed by the same brand tokens as
the components. Moved here unchanged from Feather 1.7.0 (`render-kit/` and `docs-templates/`); not published yet.

- `templates/brand-guidelines/`: the brand guideline template (12–14 landscape pages at 1600×1000), themed only
  through `tokens.css`, which `tokens-from-json.mjs` writes from a brand's `tokens.json`.
- `render-kit/`: `render.mjs` (headless Chromium to exact-size PNG, or PDF with page previews and a layout
  report), `verify.mjs` (deliverable checks and layout gates) and the bundled OFL fonts. Node built-ins only.
- `PRODUCTION-METHOD.md`: when a deliverable is code (templates) and when it is image generation.

The render kit still expects QOOE's project layout (`.qooe/deliverables.json`, `.qooe/tools/`); generalizing it
is future work.
