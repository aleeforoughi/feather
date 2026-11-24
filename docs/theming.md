# Theming Feather

A brand reshapes Feather through one JSON file, never by editing a component. This guide walks the file from the
bottom up: the primitives the engine derives, the semantic roles components read, component tokens for one part, then
the expression axes and loudness. Current schema: **`feather-tokens/4`**. `/3`, `/2` and the old `qooe-tokens/1`
still read exactly as they did.

## How one file restyles everything

```text
brand/tokens.json ──► theme engine (buildTheme) ──► CSS variables on :root ──► components
   a handful of          derives the palette,          --primary, --text-primary,     read roles only,
   choices               checks every contrast         --surface-hover, --block-1…    never a raw value
                         floor, writes the rules       + [data-slot] overrides
```

- Every component reads **semantic variables** (`--text-primary`, `--border-primary`, `--primary`…), through utilities
  such as `text-fg-primary`, `bg-surface-base`, `border-line-primary` and the `type-*`, `shadow-*`, `motion-*` roles.
  A component never contains a colour, a pixel size or a duration of its own.
- Every visible part has a `data-slot`, every variant or state a `data-variant`. That is what component tokens target.
- The engine runs the same in Node (the `feather-brand` CLI) and in the browser (Storybook, the theme builder), so what
  you preview is what ships.

Change the file, run `npx feather-brand`, and every button, field, dialog, page block and transition follows.

## The brand file at a glance

| Key | Schema | What it sets | Default |
|---|---|---|---|
| `schema` | all | `"feather-tokens/4"` (or `/3`, `/2`) | a file with none is `qooe-tokens/1` |
| `name` | all | A label | none |
| `colors` | all | `primary`, `background`, `surface`, `text` (required) and the optional named colours | none |
| `colors.blocks`, `mediaScrim`, `inkOnMedia` | /4 | Colour blocks and the scrim for text on media | derived |
| `typography` | all | Fonts, heading weight; `/3`+ adds open fonts, the fluid display scale, type features, `voiceFace` | none |
| `shape` | all | `sharp`, `soft`, `rounded`, `pill` | `rounded` |
| `density` | all | `compact`, `comfortable`, `spacious` | `comfortable` |
| `elevation` | all | `flat`, `soft`, `dramatic` | `soft` |
| `motion` | all | Product durations: `calm`, `snappy` | `calm` |
| `pace`, `signature`, `overshoot`, `spring`, `reduced` | /3+ | The expression motion roles | `calm`, `expo-out` |
| `contrast`, `surface`, `blur`, `grain`, `focus` | /3+ | Expression axes | `quiet`, `flat`, none, none, `accent` |
| `personality` | /4 | One word that sets pace and signature | none |
| `loudness` | /4 | How much the website patterns may move, 0 to 3 | `1` |
| `components` | all | Overrides for one `data-slot` or one variant | none |

## 1. Primitives: the palette and the scales

**Four colours are required**, as hex: `background`, `surface`, `text`, `primary`. Everything else the engine derives
from them, in the OKLab space, against both `background` and `surface`:

| Derived | From | Rule |
|---|---|---|
| `--text-secondary`, `--text-tertiary`, `--text-disabled` | `text` mixed into `background` | The lightest mix that reaches the floor (4.5:1) |
| `--border-primary`, `-secondary`, `-tertiary`, `-disabled` | `text` into `background` | `--border-primary` reaches 3:1 (it identifies a control) |
| `--surface-hover`, `-pressed`, `-selected`, `-subtle` | `text` or `primary` into the surface | Text on each tint stays at 4.5:1 |
| `--secondary`, `--muted`, `--accent` | `text`, `accent` into the background | A fixed mix |
| `--destructive`, `--success`, `--warning`, `--info` and their `-muted` tints | The brand's own when named, else a default tuned for a light or a dark ground | Readable as text on both surfaces and both tints |
| `--chart-1` to `--chart-5` | `primary`, `accent` and their mixes | |

Optional colours you may name: `accent` (default: `primary`), `primaryText`, `border`, `mutedForeground`,
`destructive`, `success`, `warning`, `info` and the `successText`, `warningText`, `infoText` inks.

**The scales are fixed**, and three axes pick among them:

| Scale | Values |
|---|---|
| Spacing | A 4px grid. `--spacing` is `0.25rem`; every gap is a step of it |
| Radius | `shape` picks one set of four tiers (`xs`, `control`, `card`, `dialog`) plus a `step` that keeps curves inside curves concentric. `sharp` is all 0; `pill` makes controls fully round |
| Density | `density` sets control height (36, 44 or 52px), padding and gaps together |
| Elevation | `elevation` sets three shadow levels, `shadow-1` to `shadow-3`; `flat` keeps only level 3 |
| Motion | `motion` sets six durations (micro 100, fast 140, base 180, medium 240, slow 320, large 420ms for `calm`; shorter for `snappy`) and one curve for all product UI |
| Type | Roles (`type-display` to `type-caption`), in the brand's display and body fonts |

Fonts: `typography.fontFamily.display` and `.body` (and `.mono` from `/3`) name a foundation family: Geist, Inter, Sora,
Space Grotesk, DM Sans, Plus Jakarta Sans, Outfit, Fraunces, Manrope, Nunito, Playfair Display, JetBrains Mono,
Geist Mono, Figtree, Poppins. From `/3` a slot may instead be an **open font**: self-hosted WOFF2 files with a
metric-matched local fallback, so the swap shifts nothing:

```json
{ "family": "Neue Plak", "files": [{ "src": "/fonts/plak.woff2", "weight": [300, 800] }],
  "fallback": { "family": "Arial", "sizeAdjust": 98, "ascentOverride": 92, "descentOverride": 24 }, "preload": true }
```

## 2. Semantic roles: what components read

| Group | Roles | Utilities |
|---|---|---|
| Surfaces | `--background`, `--card`, `--surface-subtle`, `-hover`, `-pressed`, `-selected`, `-inverse`, `--popover` | `bg-surface-base`, `bg-surface-hover`… |
| Text and icons | `--text-primary` to `--text-disabled`, `--text-inverse` | `text-fg-primary`, `text-fg-secondary`… |
| Lines | `--border-primary` to `--border-disabled`, `--ring` | `border-line-primary`… , `focus-ring` |
| Brand | `--primary`, `--primary-foreground`, `--accent`, `--muted` | `bg-primary`, `text-primary-foreground`… |
| Status | `--destructive`, `--success`, `--warning`, `--info` (+ `-foreground`, `-muted`) | `text-destructive`, `bg-destructive-muted`… |
| Shape and space | `--radius-xs/-control/-card/-dialog`, `--control-height`, `--card-pad`, `--gap`… | `rounded-card`, `h-control`, `p-card`… |
| Elevation and motion | `--elevation-1..3`, `--duration-*`, `--ease-standard` | `shadow-1..3`, `motion-press`, `motion-popover`… |

**Added by `/4`:**

| Role | What it is | Utilities |
|---|---|---|
| `--block-1` to `--block-4`, and `--block-N-ink` | Four colour blocks for coloured sections, each a surface and the ink that reads on it (4.5:1). By default: the primary, the accent (or the inverse), a tint of the accent and a muted tint | `bg-block-N`, `text-block-N-ink` |
| `--media-scrim`, `--ink-on-media` | The overlay under text on photographs or film, and the ink on it. The engine solves the scrim's opacity (from 0.6 to 0.9) until the ink reads at 4.5:1 over both a white and a black frame | `bg-media-scrim`, `text-ink-on-media` |
| `--loudness` | The brand's default loudness (below) | read by components |
| `--layer-*` | The z-index scale: base 0, raised 10, sticky 20, overlay 40, modal 50, toast 60, cursor 70. House constants | `z-layer-*` |
| `--opacity-*` | `dim` 0.6, `muted` 0.72, `disabled` 0.5. House constants | `opacity-dim`, `opacity-muted`, `opacity-disabled` |

`--scrim` (utility `bg-scrim`) is the separate dimming layer behind a dialog or sheet. It is not `--media-scrim`.

In a brand, write blocks only when you want your own. Anything you leave out is derived:

```json
"colors": { "blocks": [{ "surface": "#7DE2A8" }, { "surface": "#F2B544", "ink": "#1A1204" }] }
```

## 3. Component tokens: one part, one variant

The third tier restyles a single `data-slot` without touching its code. Key `"slot"` restyles every variant;
`"slot.variant"` restyles one and wins over its slot.

```json
"components": {
  "button": { "radius": "full", "fontWeight": 600 },
  "button.outline": { "borderColor": "accent" },
  "card": { "radius": "dialog", "shadow": 2 }
}
```

Only these properties exist, each with bounded values:

| Property | Values |
|---|---|
| `radius` | `xs`, `control`, `card`, `dialog`, or `0`, `4`, `8`, `12`, `16`, `20`, `24`, `full` |
| `borderWidth` | `0px` or `1px` |
| `shadow` | `none`, `1`, `2`, `3` (or `xs` to `xl`) |
| `fontWeight` | `100` to `900` in hundreds |
| `letterSpacing` | an `em` value, for example `-0.01em` |
| `textTransform` | `none`, `uppercase`, `lowercase`, `capitalize` |
| `fontFamily` | `display` or `body` |
| `paddingX`, `height` | a step of the 4px grid (0 to 16, and 4 to 24) |
| `background`, `foreground`, `borderColor` | a role (`primary`, `background`, `surface`, `text`, `accent`, `muted`, `border`, `destructive`) or a hex |

The slot names are in `@aleeforoughi/feather-react/foundation.json` (and visible in Storybook's DOM as `data-slot`).
Anything outside this list is refused, so a brand cannot grow into CSS.

## 4. The expression axes (the website layer, `/3` and `/4`)

Product UI keeps the calm product roles. Websites use the expression layer, which a brand sets with these axes.

| Axis | Values | What it changes |
|---|---|---|
| `pace` | `calm`, `snappy`, `cinematic` | Duration, distance and stagger of reveal, media and scene roles. `cinematic` stretches only the expression roles; product UI stays calm |
| `signature` | `expo-out`, `quint-out`, `sine-out`, `scout`, `sheet`, `standard`, or `{ "cubicBezier": [x1, y1, x2, y2] }` | The one curve the expression roles ease on. A custom curve keeps x in 0..1 and y in -0.6..1.6; beyond 0..1 it needs `"overshoot": true` |
| `overshoot`, `spring.bounce` | boolean, 0 to 0.25 | Playful roles only |
| `reduced` | per role, `fade` or `none` | What each role becomes under reduced motion. A brand may only make a role quieter |
| `personality` (/4) | `calm`, `precise`, `playful`, `cinematic` | One word that sets pace and signature (and overshoot for `playful`). Anything you write yourself wins |
| `contrast` | `quiet`, `bold` | Display weight 500 or 700, and how tight the default tracking runs |
| `surface` | `flat`, `paper`, `glass`, `film` | One idea of light. `paper`: no shadow, hairline edges. `glass`: blurred overlays (`blur` 8 to 30px). `film`: one grain texture (`grain` 0.02 to 0.08) |
| `focus` | `accent`, `primary` | The colour of the 2px focus ring (offset 2px). It must reach 3:1 |
| `typography.display` | steps `xl`, `l`, `m`, `s` with `size`, `tracking`, `leading` | The fluid display scale between a 360px and a 1440px viewport. Bounds: size 1 to 14rem, tracking -0.08 to 0.02em, leading 0.72 to 1.15 |
| `typography.features` | `tabularNums`, `balanceTitles`, `prettyBody` | Type features, all on by default |
| `typography.voiceFace` | a font | The speaker's face in a Living Page |

| Personality | Pace | Signature |
|---|---|---|
| `calm` | calm | expo-out |
| `precise` | snappy | standard |
| `playful` | snappy | quint-out, with overshoot |
| `cinematic` | cinematic | expo-out |

### Loudness

`loudness` (0 to 3) is how much the website patterns may move. A brand sets its default; a page or a block overrides it
with `data-loudness`, or `loudness` in a `feather.page/1` document.

| | 0 quiet | 1 composed | 2 expressive | 3 spectacle |
|---|---|---|---|---|
| Allows | micro-motion only | reveals | kinetic type, parallax, pinned scenes | full choreography, scenes |

The finish is identical at every level; only how much moves changes. Reduced motion and weak devices cap it. See the
Loudness page in Storybook for the same block at each level.

### Fonts: any open font, self-hosted

A brand names one of the fifteen foundation families (`"Space Grotesk"`, `"Fraunces"`…), or any open font as a font
object with self-hosted WOFF2 files and a metric-matched fallback. `feather-font` makes that object for you:

```bash
npx feather-font add "Instrument Serif" --brand brand/tokens.json --role display --preload
```

It downloads the WOFF2 once from Fontsource (open fonts only; it prints the licence) into a cache
(`$FEATHER_FONT_CACHE`, else `~/.cache/feather/fonts`), copies the files into `public/fonts/<family>/` (`--out`,
served at `--base`, default `/fonts`), measures the font, and writes the object into the brand file:

- the fallback is Arial, Times New Roman or Courier New by the font's category;
- `sizeAdjust` matches the width of English text (letters by frequency, and spaces), not the font's average glyph;
- `ascentOverride`, `descentOverride` and `lineGapOverride` come from its vertical metrics.

So the swap from the fallback to the real face moves nothing. A variable font is taken when Fontsource has one; pass
`--weights 400,700` for static cuts, `--styles normal,italic`, `--subset latin-ext`. Offline, `--from <dir>` reads the
files from a folder.

In a `/4` brand, the foundation families get the same treatment without a tool: each one carries its measured
fallback (`src/fallbacks.mjs`), so the theme's stacks read `"Inter Variable", "Inter Variable Fallback", sans-serif`
and `theme.fonts` holds the fallback faces.

## 5. What the engine refuses, and why

The engine never adjusts a brand quietly: it reports every problem at once, with the numbers, and writes nothing.

| Refused | Why |
|---|---|
| `colors.text` under 7:1 on the background and surface | Primary text is held to AAA. The message gives the ratio it reaches |
| No mix of `text` reaches 4.5:1 (tertiary text) or 3:1 (control borders) | The scale cannot be derived honestly from these colours |
| Secondary text given as `mutedForeground` under 4.5:1 | Same floor |
| `destructive` under 4.5:1 on either surface or either tint | A destructive label must be readable |
| Text on a hover, pressed, selected or status tint under 4.5:1 | The tints are mixes of your colours |
| `focus` colour under 3:1 on the background or surface | The ring must be seen. Choose `primary`, or a stronger accent |
| A block `ink` under 4.5:1 on its surface | Leave `ink` out and the engine picks one that reads |
| A media scrim that cannot carry its ink even at 0.9 opacity | Choose a darker `mediaScrim` or leave `inkOnMedia` out |
| A font not in the foundation set, or an open font from another host | Self-hosted WOFF2 only, with a fallback |
| A display step outside its bounds, or larger than the step above it | Keeps the scale a scale |
| A curve whose time runs backward, or that overshoots without `overshoot: true` | Motion stays intentional |
| `reduced` that makes a role louder | Reduced motion only gets quieter |
| `motion` and `pace` that disagree (unless `cinematic`) | Product and expression must agree on calm or snappy |
| A component token outside the table, or a free value | A brand cannot write CSS |
| `loudness`, `colors.blocks`, `mediaScrim`, `inkOnMedia` or `personality` in a file that is not `/4` | Each version only adds; a field names the schema it needs |
| `personality` written as `motion.personality` | `motion` is the product durations axis; write `personality` at the top level |

## 6. A complete annotated brand

Harbor: a dark, glassy, playful brand. Notes follow the file.

```json
{
  "schema": "feather-tokens/4",
  "name": "Harbor",
  "colors": {
    "background": "#0E1512",
    "surface": "#16201B",
    "text": "#EAF2EC",
    "primary": "#7DE2A8",
    "primaryText": "#06130C",
    "accent": "#F2B544",
    "destructive": "#FF8A80",
    "blocks": [
      { "surface": "#7DE2A8" },
      { "surface": "#F2B544", "ink": "#1A1204" }
    ],
    "mediaScrim": "#0E1512",
    "inkOnMedia": "#FFFFFF"
  },
  "typography": {
    "fontFamily": { "display": "Sora", "body": "Inter", "mono": "JetBrains Mono" },
    "headingWeight": 600,
    "display": { "xl": { "size": { "min": 3.5, "max": 10 }, "leading": 0.88 } },
    "features": { "tabularNums": true, "balanceTitles": true, "prettyBody": true }
  },
  "shape": "rounded",
  "density": "comfortable",
  "elevation": "dramatic",
  "personality": "playful",
  "spring": { "bounce": 0.15 },
  "reduced": { "reveal": "none" },
  "contrast": "bold",
  "surface": "glass",
  "blur": 20,
  "focus": "accent",
  "loudness": 2,
  "components": {
    "button": { "radius": "full", "fontWeight": 600 },
    "button.outline": { "borderColor": "accent" },
    "card": { "radius": "dialog", "shadow": 2 }
  }
}
```

| Part | What it does |
|---|---|
| `colors` | Four required colours, an accent, and a destructive red tuned for a dark ground. Everything else is derived and checked |
| `colors.blocks` | Block 1 takes its ink from the engine; block 2 names an ink, which must read at 4.5:1. Blocks 3 and 4 are derived |
| `mediaScrim`, `inkOnMedia` | Text over film sits on a dark scrim, with white ink; the engine finds the opacity |
| `typography` | Sora for headings, Inter for text, a mono slot. One display step is tuned; the rest keep the house scale |
| `shape`, `density`, `elevation` | The product axes: rounded corners, the middle density, dramatic shadows |
| `personality` | `playful` gives snappy pace, the `quint-out` curve and overshoot, with no `pace` or `signature` written. A bounce of 0.15 tames the spring |
| `reduced` | Reveals vanish entirely under reduced motion, quieter than the default cross-fade |
| `contrast`, `surface`, `blur`, `focus` | Bold display weight, glass overlays at 20px blur, an accent focus ring |
| `loudness` | Expressive by default: kinetic type, parallax and pinned scenes are allowed |
| `components` | Pill buttons, an accent outline on outline buttons, cards at the dialog radius with level-2 shadow |

## 7. Check a theme fast

| How | What you learn |
|---|---|
| **Storybook theme builder** (`pnpm storybook`, Foundations, Theme builder) | Fill a form or start from a reference brand; the engine's problems appear as you type; real components and a page block wear the brand; copy or download the JSON |
| **Storybook toolbar** (paintbrush Theme) | All seven reference brands, on every story. To see yours here, add the file to `packages/tokens/themes` and the list in `apps/storybook/.storybook/themes.ts` |
| **Foundations pages** | Tokens, Motion, Loudness and Accessibility floor read the current brand live: swatches, scales, curves, the contrast each role reaches |
| **`npx feather-brand`** | The exact theme a product gets; a one-line summary of the resolved axes, or every problem and exit 1 |
| **`buildTheme(tokens)`** from `@aleeforoughi/feather-tokens` | The same engine in code: `{ ok, css, fonts, derived, summary }` or `{ ok: false, problems }` |

## 8. Moving between schemas

A brand never has to move: `/2` and `/3` files theme exactly as before (byte for byte). To adopt the range layer:

```bash
npx feather-brand --migrate --to 4
```

This stamps the file `feather-tokens/4` in place, and only if the result still themes. A migration only adds and never
goes down. Without `--to`, `--migrate` brings a `qooe-tokens/1` or `/2` file to `/3`. The JSON Schemas for editors are in
`@aleeforoughi/feather-tokens/schema/`, one per version. The engine is the authority; the schemas are for completion.

The values behind all of this, with their reasons, are in [visual-system.md](visual-system.md).
