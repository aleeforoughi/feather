# Production method: code or generation

From QOOE's project-scopes design (docs/qooe/PROJECT-SCOPES.md).


QOOE decides **how each asset is made** before making it. **Code** means HTML/CSS, SVG, charts and layout rendered by QOOE's own tools: deterministic, editable, exact, nearly free, and easy to update or re-skin. **Generation** means GPT Image, Nano Banana and future image or video models: for what code cannot make well. Most real work is **hybrid**: generated imagery placed into a coded layout.

| Asset | Default method | Generate only for |
|---|---|---|
| Brand guidelines, brochures, reports, one-pagers, e-books, menus | **Code** (HTML pages to PDF) | Photos, illustrations and application mockups placed inside |
| Business cards, letterheads, stationery, email signatures | **Code** (exact print sizes) | A realistic mockup to present them |
| Presentations and decks | **Code** (slides to PDF) | Hero imagery, illustrations |
| Palette, type specimen, icon grid, spacing and usage sheets | **Code** | Nothing |
| Charts, diagrams, timelines, tables, infographics | **Code** (SVG or HTML) | An illustrative accent, rarely |
| Simple icons and UI glyphs | **Code** (SVG from an icon library, Lucide first) | A custom illustrated icon set |
| Social posts, ads, banners, posters | **Hybrid:** coded layout and typography | The key visual or photo |
| Logos and marks | **Generate** concepts (ideation is the point), then refine | — (vector delivery via tracing, phase 2) |
| Illustrations, photos, product shots, textures, mood | **Generate** | — |
| UI design and prototypes | **Generate** screen designs for speed of idea and review (current design-first flow); code for working prototypes and the build | — |
| Mockups (device, packaging, merchandise, environment) | **Generate** | — |

**How QOOE applies it:**

- **Each deliverable type carries its default method** (from this table), and each pipeline's brief states it: "pages are code; imagery is generated only for …".
- **The responsible role writes a making plan** before spending: each asset with its method and why. A generation for something the table marks as code needs a reason ("a photographic cover"). Finance and the image allowance follow the plan: a document task gets a few images for its visuals, never one per page.
- **QOOE enforces the cheap path:**
  - `verify` fails rendered deliverables that are not built from a source page;
  - text in generated images is discouraged (models garble lettering, and it cannot be edited);
  - the image allowance is sized from the making plan.
- **Concept images are judged as concepts (owner rule):**
  - A generated image whose job is to convey a design concept (UI concept screens, heavy visual explorations, layout and mood directions) is reviewed for **the idea**: direction, hierarchy, composition, brand fit.
  - It is **not** reviewed for pixel faults: overlapping elements, garbled or misspelled text, small artifacts, slightly off colors, alignment.
  - Those are not regenerated. They are resolved where the work becomes real, in the HTML/code implementation, which is exact.
  - **The agent:** no regeneration for micro fixes; at most one regeneration when the concept itself misses.
  - **QA:** concept deliverables get a concept rubric, not a production one.
  - **Final assets:** a deliverable that ships as the generated image itself (a logo, an illustration, a photo) is still judged as a final asset.
- **QOOE weighs the method per asset (owner rule).** The table gives defaults; the making plan **analyses each asset** and records why:

  | Factor | Leans to code | Leans to generation |
  |---|---|---|
  | Pages and text density | Many pages, much text (15-page guideline, brochure) | One frame, little or no text |
  | Exactness | Print sizes, exact colors and type, grids | Free composition |
  | Editability | Will be updated, translated, re-skinned | Final as made |
  | Visual complexity | Shapes, type, flat graphics, charts | Photoreal, illustrative, atmospheric scenes |
  | Reuse | A themeable template exists | Nothing reusable |
  | Cost and quality | Re-render is nearly free and exact | One generation reaches a quality code cannot |

  Examples:
  - A 15-page brand guideline: **code**.
  - A single Instagram ad that is one complex visual: **generation**, the visual is the ad.
  - A carousel of text-led tips: **code** with brand imagery.
  - A product hero shot: **generation**.

  Outcome reports record the method, cost and QA result per asset, so the defaults calibrate over runs.
- **Themeable document templates, part of Feather (owner rule).**
  - Feather is QOOE's one design system for **both web and documents**. Next to `qooe/feather/web` (components), `qooe/feather/docs` holds document and print templates: brand guidelines, business cards, letterheads, brochures, reports, decks, one-pagers.
  - Both share the same token schema (`qooe-tokens/1`, the brand's `brand/tokens.json`), the same brand application step (tokens to CSS variables), the same fonts, the same hygiene and the same versioning and CHANGELOG. One brand themes its site and its documents identically.
  - After a project, Bootstrap promotes its best multi-page and print designs into Feather's templates.
  - Templates are HTML/CSS themed **only through brand tokens** (CSS variables for colors, fonts, spacing and radius), with content slots and image slots.
  - The next project starts from a template, applies the new brand's tokens, writes its content, places its imagery, and renders. No image generations for the document itself; a fraction of the turns.
  - **Bootstrap's rules, as for Feather:** only templates worth reusing, no duplicates, versioned, hygiene-checked, always themeable.
  - Designers may still design from scratch when the brief calls for something new, then propose the result as a template.

- **Updates stay cheap:** a coded document is changed by editing text or swapping an image and re-rendering, with no regeneration. This is what makes revisions and re-skins nearly free.
- **Wider scenarios use the same rule:** video (coded motion such as Lottie or HTML animation for kinetic type and UI demos, generated video for live-action or cinematic shots), audio (synthesis only for voice and music), 3D (code for simple product turntables, generation for scenes). Each new capability enters the capability registry with its default method and cost, so QOOE can choose the cheapest method that reaches studio quality.

Phase 1 already makes pages, sheets, documents and decks with code, with imagery generated into them. Making this a general, explicit decision (the making plan, per-asset method, allowance from the plan, and the table above in every media brief) is part of the next fix round.
