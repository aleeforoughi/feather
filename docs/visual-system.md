# The visual system (milestone V1: visual hygiene)

Every pixel, gap, radius, type size, border, shadow, duration and curve in Feather comes from a finite system. An
arbitrary value is a defect unless it is a documented optical exception. This page is the law. Tokens implement
it, components consume it, and three gates enforce it (§12).

The layers, from bottom to top:

```text
PRIMITIVES     space, type, radius, border, elevation, motion, icon, control, optical   (fixed by Feather)
SEMANTICS      density, emphasis (text/icon/border), surface, typography roles, motion roles, focus
CONSISTENCY    the control frame, icon slots, optical correction, equal-role-equal-geometry
COMPONENTS     button, input, card, dialog, organisms… consume semantics, almost never primitives
BRAND THEMES   a brand picks values *inside* the system: colors, fonts, shape, density, elevation, motion
PRINCIPLES     the review layer: hierarchy, balance, rhythm, optical balance… (§13)
```

**The default theme.** With no brand, Feather is `themes/feather.json`, with `themes/feather-dark.json` under
`.dark`. The rules for it:
- The primary is ink (black in light, near-white in dark).
- There is no accent; color appears only where it means something (status, errors, the destructive act).
- JetBrains Mono for headings and text, and every other axis at the system default.
- The fallback blocks in foundation.css are generated from those two files (`pnpm --filter
  @aleeforoughi/feather-tokens theme:default`), and a test fails if they drift.

Decided with the owner (docs/PLAN.md section 12, decision 7):
- The rules are the frame that brand themes live inside. A brand axis selects among compliant value sets and
  can never produce a non-compliant one.
- The default control height is 44px.
- V1 lands before L5.

**Hygiene normalizes; it never redesigns.** A component keeps its purpose, anatomy and behaviour. Only its
values move onto the system.

## 1. Laws

1. Use a token wherever one expresses the intent. Never use a raw number.
2. Layout runs on an 8px rhythm with a 4px half-step. 2px exists only for optical correction.
3. Equal roles get equal geometry. Every control in a row shares one height, one border width and one radius
   tier.
4. Hierarchy comes from emphasis (color and contrast), never from ad-hoc thickness, size or opacity.
5. Border width is 1px everywhere. Focus is a separate 2px ring that never changes geometry.
6. Every perceivable state change interpolates on the single canonical curve, with an approved duration and
   distance. Nothing teleports, nothing bounces, and nothing animates layout properties when a transform can
   do it.
7. Reduced motion is built in, not added later.
8. Geometry rests on whole pixels: borders, icons, dividers, small text and control boundaries.
9. Perceptual consistency beats mathematical consistency, inside the optical budget (§9).
10. Density is semantic: tight, default or spacious. Default is generous.

## 2. Primitives

**Space.** The `--spacing` unit is fixed at **4px** (it no longer scales with density). The allowed steps, as
Tailwind numbers × 4px, are:

| step | 0 | 0.5 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24 | 32 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| px | 0 | 2 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 | 96 | 128 |

Rules for the steps:
- 0.5 (2px) is an optical exception only (§9).
- 5 (20px) is for generous control padding and icon slots.
- Every other step is forbidden: 1.5, 2.5, 3.5, 7, 9, 11, 14 and so on.

The relationships: 4 is intimate, 8 tightly related, 12 compact, 16 normal, 24 a group boundary, 32 a strong
group, 48 a section, and 64 or more a major section.

**Type scale.** The root is 16px, and sizes are in rem: 0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.75, 2, 2.5, 3 and
4rem (12, 14, 16, 18, 20, 24, 28, 32, 40, 48 and 64px).
- The Tailwind scale is redefined to match. `text-xs` through `text-2xl` are already 12 to 24px. `3xl` becomes
  28px, `4xl` 32px, `5xl` 40px, `6xl` 48px and `7xl` 64px.
- Every line height lands on the 4px grid (§4).
- The weights are 400, 500, 600 and 700. `typography.headingWeight` is limited to these four (it previously
  allowed 100 to 900).

**Radius.** The values are 0, 4, 8, 12, 16, 20, 24 and full. They form a hierarchy built up from the control radius (§7).

**Border.** Width is 1px. Focus is 2px. Nothing else exists.

**Elevation.** Four levels: 0 (flat), 1 (subtle separation), 2 (floating: popover, menu, dropdown) and 3 (modal:
dialog, sheet). A brand's elevation axis picks the values (§8). Components never write their own shadow.

**Motion.** One curve, `--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)`. Six durations (§10). Six distances: 1, 2,
4, 8, 16 and 24px.

**Icon.** Sizes are 16, 20, 24 and 32px. The icon-to-label gap is 8px.

## 3. Density and the control frame

A brand's `density` axis keeps its names for schema compatibility (feather-tokens/2). Each name maps onto one
semantic density:

| brand density → | `compact` → **tight** | `comfortable` → **default** | `spacious` → **spacious** |
|---|---|---|---|
| control height | 36px | **44px** | 52px |
| control padding (y × x) | 8 × 12 | 12 × 16 | 16 × 20 |
| icon slot in a control | 16px | 20px | 24px |
| container padding (y × x) | 12 × 16 | 16 × 24 | 24 × 32 |
| element gap | 8px | 12px | 16px |
| group gap | 16px | 24px | 32px |

How density is applied:
- The theme's density sets these as CSS variables on `:root`: `--control-height`, `--control-px`,
  `--control-py`, `--icon-slot`, `--pad-x`, `--pad-y`, `--card-pad`, `--dialog-pad`, `--gap` and `--group-gap`.
- Any element with `data-density="tight|default|spacious"` overrides them for its subtree. The web manifestation
  sets it from `plan.density`, which maps compact→tight, comfortable→default and spacious→spacious.
- Density changes spacing and size only. It never changes hierarchy, border language, the type roles, the icon
  language or state semantics.

**The control frame.** These components share one outer frame:
- Button, IconButton (Button with an icon size), Input, Select trigger, Combobox, Toggle and ToggleGroup items;
- Tabs triggers when they stand as controls;
- the date and search controls.

The frame is:
- height `--control-height`, `box-sizing: border-box`, with the border inside the height;
- the same radius tier (`--radius-control`);
- the same 1px border when a border exists;
- the same icon slot, and the same 8px icon gap;
- the same type role (`label` on buttons, `body` in fields);
- the same focus ring and the same motion roles.

A row `[Input][Select][Button]` is one continuous band. An icon-only control is square, `--control-height` ×
`--control-height`.

**Existing size props stay, and resolve onto the three heights:**
- `xs` and `sm` → tight;
- `default` → default;
- `lg` → spacious;
- `icon-xs`, `icon-sm`, `icon` and `icon-lg` → square frames of the same three heights.

No fourth height exists.

**Targets.** Every interactive element has a hit area of at least 44 × 44px.
- A text-entry field (input, textarea, contenteditable) is its own target. It cannot carry an extended hit area,
  so its height is the density's control height, 36px at tight density. Tight density is opt-in for pointer-heavy
  utility surfaces; the composer routes low motor precision to spacious.
- Stacked choice rows (checkbox, radio, menu items) therefore sit on a 44px pitch.
- **A list item is a control row.** Select, dropdown-menu and navigation items are `min-h-control`: the control height
  of the density, growing only if the label wraps. A select's items use the trigger's type role (`type-body`), so
  the chosen value reads the same open and closed, and its list is at least as wide as the trigger and grows to fit its
  longest option. The list insets its items by one step (4px), so item text lines up with the trigger's text at
  default density, and the list's corner is one step larger than the items' (section 7).
- A control whose label wraps grows by its extra lines instead of clipping: its control height is then a minimum
  (`min-h-(--control-height)`), never a cap.
- The nearest `data-density` governs. A plan's own density (set by the web manifestation from `plan.density`)
  overrides the page's.
- `default` and `icon` sizes follow the surrounding density; only `xs`, `sm` and `lg` (and their `icon-` twins)
  pin a height. A tight 36px control and a 16px
checkbox reach it through an invisible extended hit area (`::after` inset), never by growing visually.

## 3a. Regions: who owns the space

Spacing comes from the **role of each region**, never mechanically from the parent or the neighbours. A
container divided into semantic regions has **no padding of its own**: the shell gives structure, and every
region owns its inset.

```text
Dialog (shell: padding 0)
├── header   inset-header    directional: 24 above, 16 below, 32 at the sides
├── content  inset-content   axis: 20 block, 32 inline
└── action   inset-action    perimeter: 20 on every side
               └── buttons   gap-action 8
                     └── a button keeps its own control padding
```

**Four kinds of spacing.** Never collapse them into one value:

| kind | owned by | tokens |
|---|---|---|
| component padding | the component (a button, an input) | `px-control`, `py-control` |
| region inset | the region, by role | `inset-content`, `inset-header`, `inset-action`, `inset-utility`, `inset-display` |
| inter-element gap | the parent of siblings | `gap-action` (button↔button), `gap-label` (label↔input), `gap-element` (heading↔body), `gap-field` (field↔field), `gap-group` |
| region separation | the boundary | a divider, a surface change or a strong space. It starts a new spacing context. |

**Region roles.** Mark each region with `data-region`; that tells the audit its pattern:

| `data-region` | for | pattern | tight | default | spacious |
|---|---|---|---|---|---|
| `content` | body, forms, information, settings | **axis**: T = B, L = R, inline ≥ block | 16 / 24 | 20 / 32 | 24 / 40 |
| `header` | a heading attached to what follows | **directional**: L = R, top > bottom | 20 · 24 · 12 | 24 · 32 · 16 | 32 · 40 · 20 |
| `action` | footers, action bars, decisions | **perimeter**: T = R = B = L | 16 | 20 | 24 |
| `utility` | toolbars, filters, metadata | **axis** | 8 / 12 | 12 / 16 | 16 / 20 |
| `display` | empty states, presentation, centered panels | **perimeter** | 24 | 32 | 48 |

Axis values are given as block / inline. Header values are top · sides · bottom. Gaps per density: action 8 · 8
· 12, label 4 · 8 · 8, field 12 · 16 · 20, and heading↔body is the element gap (8 · 12 · 16).

**Rules.**
1. **Same role, same inset.** A dialog footer, a card's action area and a sheet footer all use `inset-action`.
2. **Different role, new spacing context.** A divider or surface change resets ownership. The footer does not
   inherit the body's 32px sides; its 20px perimeter balances the controls inside its own edges.
3. **Equivalent edges match.** A perimeter region has all four sides equal, and an axis region has
   top = bottom and left = right. Only a header is directional, and its asymmetry ties it to the content below.
4. **A header attaches to the content below it.** When content follows a header directly with no boundary,
   the content's top inset collapses to 0, and the header's bottom inset (16 by default) alone sets the
   heading-to-body distance. A divider or surface change between them is a boundary (`data-boundary` on the
   content region), and both insets stay.
5. **A single-region surface** (a card that is only content) puts the region on the surface itself
   (`data-region="content"` with `inset-content`). A surface with several regions keeps padding 0.
6. **Ownership nests.** The shell owns structure, a region its inset, a group its gap, and a control its padding.
7. **Optical correction comes last**, inside the §9 budget, only after the structural spacing is right.

`p-card` and `p-dialog` are retired: a surface's spacing is always a region's. The rendered audit checks every
`data-region` against its pattern and density values, and checks that a shell holding regions has no padding.
Static hygiene checks that each region uses its inset utility.

## 4. Typography roles

Components use roles, not sizes. Each role is a `type-<role>` utility.

| role | size / line | weight | tracking |
|---|---|---|---|
| display | 48 / 56 | 700 | −0.025em |
| heading-1 | 40 / 48 | 700 | −0.02em |
| heading-2 | 32 / 40 | 600 | −0.015em |
| heading-3 | 24 / 32 | 600 | −0.01em |
| title | 20 / 28 | 600 | 0 |
| body-lg | 18 / 28 | 400 | 0 |
| body | 16 / 24 | 400 | 0 |
| body-sm | 14 / 20 | 400 | 0 |
| label | 14 / 20 | 500 | 0.005em |
| caption | 12 / 16 | 400 | 0.005em |
| caps (eyebrow) | 12 / 16 | 500 | 0.06em, uppercase |

How the roles apply:
- Line heights are written in rem on the 4px grid (for example 3.5rem for display), never as unitless ratios that
  resolve to fractions.
- The heading roles use the brand's display font and the brand's `headingWeight` when it sets one (400 to 700).
- Prose is at most 70ch wide. Body text is never `line-height: 1`.

**Rendering**, in foundation.css:
- `-webkit-text-size-adjust: 100%`, `text-rendering: optimizeLegibility`, `font-synthesis: none` and
  `font-optical-sizing: auto`;
- `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale`, as progressive enhancement;
- never `scale()` on a container of persistent text, never CSS `zoom`, and never a fractional font size.

## 5. Emphasis: one hierarchy for text, icons and borders

A single scale runs from primary through secondary, tertiary and disabled to inverse. It applies to text, icons
and borders alike. The theme engine derives every color from the brand's own colors, and checks each against its
surface:

| token | derived from | contrast floor (vs `--card` and `--background`) |
|---|---|---|
| `--text-primary` | the brand's text | 7:1 |
| `--text-secondary` | the brand's `mutedForeground`, or the lightest mix of text into background that reaches the floor | 4.5:1 (body text stays readable) |
| `--text-tertiary` | the lightest mix reaching the floor | 4.5:1 (metadata is still text) |
| `--text-disabled` | mix of text into background at 38% | none (WCAG exempts disabled controls) |
| icons | the `--text-*` scale itself (`text-fg-*`, `currentColor`) | 3:1 minimum for meaningful icons |
| `--border-primary` | the lightest mix reaching the floor | **3:1**: the boundary that identifies a control (inputs, selects, outline buttons) |
| `--border-secondary` | mix of text into surface at 16% (today's `--border`) | none: cards, panels, popover edges |
| `--border-tertiary` | mix at 10% | none: dividers, table rows, internal sections. Never the only boundary of a control. |
| `--border-disabled` | mix at 8% | none |
| `--destructive` | the brand's `destructive`, or a default red per side (`#b42318` light, `#ff6b62` dark) | 4.5:1, also on both of its own tints: see **Status colors** below. A brand red that misses it at rest is refused. |

Further rules:
- **Utilities.** Text and icons use `text-fg-primary`, `text-fg-secondary`, `text-fg-tertiary`, `text-fg-disabled`
  and `text-fg-inverse` (icons take `currentColor`). Borders use `border-line-primary`, `border-line-secondary`,
  `border-line-tertiary` and `border-line-disabled`. Surfaces use `bg-surface-*`. `text-primary`, `bg-secondary`
  and similar keep their meaning as the brand's fills.
- The existing names stay as aliases. `--foreground` is `--text-primary`, `--muted-foreground` is
  `--text-secondary`, `--border` is `--border-secondary`, and `--input` is `--border-primary`.
- A label and its icon share one emphasis level.
- No arbitrary opacity is allowed (`opacity-60`, `text-foreground/70`). The only opacities are 0 and 100 (for
  transitions) and `--opacity-disabled` (0.5), where a component cannot express disabled through color.

**Status colors** (destructive, success, warning, info) follow the same idea. Each has a strong role (a fill, or
a 3:1 border) and a muted role (`--<status>-muted`, a tint for surfaces). The destructive color stays off text
(docs/organisms.md).

A destructive button or badge is the one place `--destructive` is text: it sits on its own tint, never on an
opacity of the fill (`bg-destructive/10` is an arbitrary opacity). The engine derives both tints and checks the red
against them:

| token | derived from | contrast floor of `--destructive` on it |
|---|---|---|
| `--destructive` | the brand's `destructive`, or the reference red (`#b42318` light, `#ff6b62` dark) | 4.5:1 on `--background` and `--card` |
| `--destructive-muted` (`bg-destructive-muted`, at rest) | 12% of the red mixed into `--card` | 4.5:1, laid on `--background` and on `--card` |
| `--destructive-muted-hover` (`bg-destructive-muted-hover`) | the strongest mix from 20% down to 14% that holds the floor | 4.5:1, laid on `--background` and on `--card` |

A red that misses the floor at rest is refused. A red that holds it at rest but not at 20% hovers one step lighter
instead: rich-brand's `#B91C1C` reaches 4.49:1 at 20% on `#FAF7F2`, so it hovers at 19%. The floor is
`CONTRAST_FLOORS.destructive`; the percentages are `DESTRUCTIVE_TINTS` in `packages/tokens/src/engine.mjs`.

## 6. Surfaces

The surface tokens are:
- `--surface-base` (the background);
- `--surface-subtle` (text into background at 4%);
- `--surface-raised` (the card);
- `--surface-overlay` (the popover);
- `--surface-hover` (text into the surface at 6%);
- `--surface-pressed` (10%);
- `--surface-selected` (the primary into the surface at 12%);
- `--surface-disabled` (6%);
- `--surface-inverse`.

`--scrim` dims the page behind a dialog or sheet (`bg-scrim`). A component never invents its own gray. **Depth order:** surface tone first, then a border, then overlap, and
only then a shadow.

## 7. Radius and shape: a hierarchy

Corner radius is a hierarchy, built from the bottom up. **The control (button) radius is the base and the
minimum**: every button, input, select and toggle has it, wherever it sits. **Each enclosing level adds one step**
(4px), so a curve inside a curve is always tighter, and the curves read as one family:

```text
control 8  →  card holding controls 12  →  card holding a card 16  →  dialog holding that 20
```

| shape | xs | control (base) | step | card | dialog |
|---|---|---|---|---|---|
| `sharp` | 0 | 0 | 0 | 0 | 0 |
| `soft` | 4 | 4 | 4 | 8 | 12 |
| `rounded` (default) | 4 | 8 | 4 | 12 | 16 |
| `pill` | 4 | full | 4 | 16 | 20 |

The card and dialog values above are for a surface with nothing rounded inside it. Every level of rounded surface
nested inside adds one step: a card that holds a card is 16 in `rounded`, and a dialog holding that card is 20.
The radius scale is therefore 0, 4, 8, 12, 16, 20, 24 and full.

- **It is automatic.** `rounded-card` and `rounded-dialog` compute their radius from their content (`:has()`),
  so no component needs to know where it is placed. The extra steps live in `--surface-extra`, a property that
  does not inherit, so a container's nesting never leaks into the surfaces inside it. The tokens are
  `--radius-xs`, `--radius-control`, `--radius-card`, `--radius-dialog` and `--radius-step`.
- **Concentric by construction.** A list, menu or segmented control that insets its items by one step (4px,
  `p-1`) is exactly concentric with them: 8px items in a 12px container.
- **Flush children match.** A child flush with its container on two sides (a clipped image, a header band) takes
  the container's corner, never a larger one.
- **The audit checks it** (`radius.nesting`). A rounded surface inside a rounded surface must be at least one step
  smaller, unless it is flush.
- **Full radius** is a shape, not a level. Avatars, status dots, pill badges, switch tracks and thumbs, and the
  `pill` shape's controls use it, and it is never a decorative default.
- `rounded-sm`, `rounded-md`, `rounded-lg` and `rounded-xl` never appear in components; the semantic tiers replace
  them.

## 8. Borders, focus and elevation

**Borders.**
- 1px solid, always inside the box.
- Hierarchy comes through the emphasis colors (§5).
- Selected, error and success states change the border's color, not its width.

**Indicators.** A selection indicator (the active tab line, a selected rail) is 2px, the weight of the focus
ring, drawn with `h-indicator` or `w-indicator`. It is never a border.

**Focus.**
- `outline: 2px solid var(--ring)` with `outline-offset: 2px` on `:focus-visible`, the same on every focusable
  element.
- Three variants: `--ring` (default), `--ring-danger` (fields in error) and `--ring-inverse` (on inverse
  surfaces).
- Focus is visually distinct from hover and selected, and never changes width, height or border.

**Elevation axis.**

| elevation | level 1 | level 2 | level 3 |
|---|---|---|---|
| `flat` | none (border) | none (border and surface) | `0 12px 32px rgb(0 0 0 / 0.12)` (a dialog still floats) |
| `soft` | `0 1px 2px rgb(0 0 0 / .06)` | `0 4px 12px rgb(0 0 0 / .08)` | `0 12px 32px rgb(0 0 0 / .12)` |
| `dramatic` | `0 2px 4px rgb(0 0 0 / .18)` | `0 10px 24px -6px rgb(0 0 0 / .32)` | `0 20px 40px -10px rgb(0 0 0 / .4)` |

Components use `shadow-1`, `shadow-2` and `shadow-3` only. Cards default to level 0 (a border) or level 1.

## 9. Icons and optical balance

**Slots.** An icon sits in a square slot (`--icon-slot` inside controls; 16px inline with body-sm and label
text). The slot is pixel-aligned. The glyph inside it may be calibrated.

**Optical registry.** `packages/react/src/lib/optical.ts` maps each icon that needs it to `{ scale, dx, dy }`.
- Budget: scale 0.94 to 1.06; dx and dy at most ±1px at the rendered size, applied inside the SVG as a transform
  (never a fractional CSS position).
- It starts with the asymmetric glyphs Feather uses (play and other triangles, single chevrons, carets, heavy
  filled glyphs) and grows when review finds one.
- A correction beyond the budget means the source glyph needs fixing.

**One icon family.** Lucide, outline, with one stroke width. Icons in components render through `Icon` (it sets
the slot size and applies the registry), never as a bare lucide component with its own size classes.

**Baseline before box.** Icon plus label aligns to the label's glyphs, not only to the line box. A ±1px y offset
in the registry is allowed for that.

**Exceptions.** Any other optical value lives in `packages/react/optical-exceptions.json`, with the file, the
value, the reason and the reviewer. Static hygiene accepts a 0.5 step or a ±1/±2px nudge only when it is listed
there. A repeated exception gets promoted into the system.

## 10. Motion

**One curve**, `--ease-standard`, for every UI transition. Brands no longer choose a curve.

**Six durations.** The brand's `motion` axis scales them:

| primitive | `calm` (default) | `snappy` |
|---|---|---|
| micro | 100ms | 80ms |
| fast | 140ms | 100ms |
| base | 180ms | 140ms |
| medium | 240ms | 180ms |
| slow | 320ms | 240ms |
| large | 420ms | 320ms |

**Roles.** A component chooses a role, never milliseconds. The roles are rounded onto the six primitives, so the
system has six durations, not eleven. The source spec's 120, 200, 220, 280 and 360ms values each become their
nearest primitive.

| role | primitive | distance | use |
|---|---|---|---|
| `press` | micro | scale 0.985 | active and press feedback |
| `focus` | fast | none | focus ring appearance (never delayed) |
| `hover` | base | 0 to 1px (cards 2px) | surface, border, color, icon on hover |
| `state` | base | none | color and state changes, errors, success, selection, checkbox and radio marks |
| `switch` | medium | thumb travel | switch thumb and track |
| `tooltip` | base | 4px | enter. Exit uses `fast`. |
| `popover` | medium | 8px, scale 0.99→1 | menus, popovers, dropdowns, selects |
| `panel` | medium | none (clip and opacity) | accordion, collapsible |
| `dialog` | slow | 16px, scale 0.985→1 | dialog and sheet. Backdrop opacity uses the same role. |
| `toast` | medium | 8px | enter. Exit uses `base`, 4px. |
| `page` | large | 24px | route and workflow transitions |

Rules for motion:
- Each role is a `motion-<role>` utility. It sets `transition-duration` and `transition-timing-function`, and
  lists the properties to transition.
- **Distance and duration scale together:** 1 to 2px at 100 to 180ms, 4 to 8px at 180 to 240ms, 16 to 24px at
  240 to 420ms.
- **Allowed transition properties:** transform, opacity, color, background-color, border-color, outline-color,
  box-shadow and filter. Never `all`. Never width, height, margin, padding, top or left when a transform can do
  it. The one exception is the `panel` role: accordions and collapsibles animate a `clip-path` or a
  `grid-template-rows` track, never raw height.
- **Interaction grammar:**
  - rest → hover: surface or border emphasis, optional 1px lift;
  - pressed: stronger tone, scale 0.985;
  - focus-visible: the ring;
  - selected: semantic surface or border color, and a moving indicator where one exists (tabs, segmented
    control);
  - disabled: no hover or press motion;
  - loading: geometry preserved.
- No bounce, overshoot or elastic motion. Drag tracks the pointer directly. Only pickup, drop and settle are
  eased.
- **Reduced motion** is in foundation.css: under `prefers-reduced-motion: reduce`, and wherever
  `data-motion="reduced"` is set (`plan.motion`):
  - every transition and animation goes to 0.01ms and one iteration;
  - `scroll-behavior` is `auto`.

  `html { scroll-behavior: smooth }` applies only outside that. `useThemeMotion` reads the same tokens.
- Interaction never waits for motion, and focus and errors never wait at all.
- Resting positions are whole pixels.

## 11. Layout grid

| | columns | gutter | margin | max content |
|---|---|---|---|---|
| mobile (< 640px) | 4 | 16 | 16 | 100% |
| tablet (≥ 640px) | 8 | 24 | 24 | 100% |
| desktop (≥ 1024px) | 12 | 24 | 32 | 1440px |
| large (≥ 1440px) | 12 | 24 | 48 | 1440px |

These are tokens (`--layout-margin`, `--layout-gutter`, `--layout-max`) plus a `feather-container` utility.

**Vertical rhythm:**
- label → control: 8;
- related controls: 8 to 16;
- control groups: 24;
- card sections: 24 to 32;
- major sections: 48 to 64;
- page sections: 64 to 96.

## 12. Enforcement: three gates

**Gate 1, static hygiene** (`pnpm hygiene`, every release). It scans the source of packages/react and every
`manifest-*` package, excluding stories and tests, and fails on:
- a spacing, size or inset step outside §2;
- an arbitrary value `-[...]` with px, rem, em, ms or %, unless it is listed in optical-exceptions.json. Viewport
  units (`vh`, `dvh`, `vw`) are allowed for the size caps of tall or wide containers, which the step scale cannot
  express and which never land on fractional pixels by themselves;
- `transition-all`, `transition: all`, a `duration-<number>`, or an `ease-*` other than `ease-standard`;
- `rounded-sm|md|lg|xl|2xl|3xl`;
- `border-2|4|8` or `border-[…]`;
- a `shadow-*` other than `shadow-none|1|2|3`;
- `font-thin|extralight|light|extrabold|black`;
- `opacity-<n>` other than 0, 100 or `opacity-disabled`;
- a slash-opacity on text, border or icon colors (`text-foreground/70`);
- a bare lucide icon with size classes outside `Icon`;
- the existing rules: no raw colors, `data-slot` and `data-variant` on every part, and `useThemeMotion`.

It also checks theme compliance:
- every reference theme compiles;
- every derived emphasis color meets its floor (§5) in both themes.

**Gate 2, rendered audit** (`apps/storybook/visual-audit`, CI). Every story, in both reference themes and in all
three densities, is rendered in the Playwright container and measured through computed styles and boxes:
- **Controls.** Every control-frame element is exactly 36, 44 or 52px tall, matching its density or size.
  Controls sharing a row share a height. Icon-only controls are square.
- **Targets.** Every interactive element's hit area reaches 44 × 44px.
- **Borders and focus.**
  - Border widths are 0 or 1px.
  - The focus outline is 2px with a 2px offset.
  - Focusing or hovering any control changes no element's box: there is no layout shift.
- **Type.**
  - `font-size` is on the scale.
  - `font-weight` is in {400, 500, 600, 700}.
  - `line-height` is a whole multiple of 4px.
- **Radius.** `border-radius` is in the theme's tier set. A flush-nested child's radius is at most its parent's.
- **Icons.** Icon boxes are 16, 20, 24 or 32px.
- **Whole pixels.** Borders, icons and control edges sit on whole pixels at DPR 1: no fractional x, y, width or
  height.
- **Motion.**
  - `transition-property` never contains `all`.
  - Every non-zero `transition-timing-function` is the standard curve.
  - Every `transition-duration` is one of the theme's six.
  - Under emulated reduced motion, every duration is at most 0.01ms.

**Gate 3, principle review** (§13). It is a human or Opus review, recorded per release in the CHANGELOG entry.
Feather makes no model calls, so perceptual judgments stay with the reviewer, backed by the visual baselines.

Gates 1 and 2 are hard: they cannot ship red.

## 13. The principle layer (review)

The review asks one question at every scale: does this look undeniably right in context? The scales are glyph,
icon slot, control, group, component, composition, page and product. It walks the principles in this order,
which is also the order for resolving conflicts:

1. **Accessibility:** contrast, legibility, targets, visible focus, text scaling, reduced motion, and meaning
   that does not depend on color alone.
2. **Clarity and affordance:** buttons look actionable, inputs editable, disabled looks unavailable but stays
   legible, and states are recognisable without the component turning into another object.
3. **Hierarchy and emphasis:** one first thing, then a second and a third. If everything shouts, nothing is
   important.
4. **Consistency and repetition:** equal roles, equal geometry, equal emphasis and equal motion. Drift between
   pairs counts as a defect:
   - Button and Input, Input and Select, Button and IconButton;
   - Card and Panel, Dialog and Popover;
   - Menu item and Navigation item, Label and Icon, Heading and Body.
5. **Optical balance and visual weight:** equal perceived size, weight and center, inside the §9 budget.
6. **Proportion and scale:** icon to control, radius to height, heading to body, image to card, sidebar to
   viewport.
7. **Rhythm, proximity and negative space:** spacing communicates the information architecture, and whitespace
   is used deliberately.
8. **Alignment and grid:** invisible rails, baselines before box centers, and headings aligned with their
   content.
9. **Balance, contrast, Gestalt and depth:** intentional weight distribution and meaningful difference. Common
   region, similarity and continuity are deliberate. Depth comes from the least mechanism that works.
10. **Unity, variety, simplicity and shape language:** one visual universe, with controlled variation, and
    nothing that serves no purpose.

Every finding is fixed by normalizing (moving onto the system), never by redesigning.
