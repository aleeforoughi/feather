# The website layer: `@aleeforoughi/feather-expression`

Feather's product UI composes the next necessary interaction. This package is the other half: the primitives an
award-grade website is made of. It reads `feather-tokens/3` (docs/visual-system.md §14) and nothing else, so a brand
reshapes it only through tokens. It never touches product UI: those roles keep `--ease-standard`.

Two entries:
- `@aleeforoughi/feather-expression/core`: framework-free. No React, no DOM at import time, no dependencies.
- `@aleeforoughi/feather-expression`: thin React bodies over the core, plus everything in the core.

A product compiles the classes with its own Tailwind: add `@source "…/feather-expression/src"` next to Feather's
other packages.

## Primitives

| Primitive | What it does | Floor it keeps |
|---|---|---|
| `Section` | A full-width band: the page grid, the section rhythm (`section-space-s…xl`, 48 to 160px, fluid) and its own reveal | HTML first: no script or reduced motion, it is simply there |
| `Stage` | A sticky stage with scrubbed children (`scrub: 1`), progress as a render prop and `--stage-progress` | Only the frame pins; its title and caption are in normal flow; reduced motion does not pin |
| `Split`, `Grid`, `Bento`, `BentoCell` | 12-column layouts; Bento's radius is concentric (outer = inner + padding) | Reading order never changes with `reverse` |
| `DisplayTitle` | `type-display-*` with a line, word or character reveal | Real text in an `sr-only` copy; lines split only after fonts load; nothing already in view starts hidden (LCP) |
| `MediaFrame` | One framing rule: aspect, radius, the 1px edge, hover scale (`motion-media`, exit `motion-hover-out`), `<picture>`/`<video>` sources | `priority` is eager and `fetchpriority=high`, never lazy; a pause control for loops over 5s; no autoplay under reduced motion |
| `Marquee`, `Reel` | An infinite marquee, a horizontal reel | Pause button, pause on hover and focus; static under reduced motion; the copy is `aria-hidden` and `inert` |
| `Counter` | An animated number, 600 to 1200ms, tabular figures | The final value is what assistive technology reads |
| `Magnetic`, `Cursor` | Optional; a pull of 0.15 and a follower | `(pointer: fine)` only; the native cursor always stays; off under reduced motion |
| `ScrollProvider` | One scroll engine: native, CSS timelines, or Lenis driven by the GSAP ticker | lerp 0.1, native on touch, `lagSmoothing(0)`; no smoothing under reduced motion |
| `TransitionProvider`, `PersistentSlot` | View Transitions with Taxi-style cleanup (`onLeave`), and a persistent slot | Content always arrives; motion is optional |
| `World` | One GPU canvas slot, owned by the brand's renderer | DPR capped per tier (2, 1.5, 1) and a pixel budget, the capability gate and a quality ladder, render on demand, paused off screen and in a hidden tab, a still under reduced motion or without WebGL, `aria-hidden` |
| `Loader` | Arrival: `counter` (an honest percentage that lifts off) or `dock` (a bar that fills and becomes the header, `[data-loader-dock]`); optionally asks Sound on / Sound off | `role="status"` with a label; never shown without script or under reduced motion; the page is `inert` and still while it shows; ends by the cap |
| `OverlayMenu` | A minimal bar whose Menu opens a full-screen list of large links | Without script a plain list; a modal dialog with focus trapped, Escape, the page `inert`, focus returned; a fade under reduced motion |
| `SoundToggle` | One ambient bed, off until the person turns it on | `aria-pressed`; remembered; silent while the tab is hidden; static under reduced motion |

## Wave 3: sound and pointer

| Piece | What it does | Floor it keeps |
|---|---|---|
| `createMixer`, `getMixer` | One Web Audio graph: `bed`, `effects` and `ui` buses → master → low-pass → compressor (-6 dB, ratio 12); `load`, `play` (5 a second per sound at most), `loop` with `fade`, `duck`, `muffle` (20 kHz → 100 Hz over 400ms), `bands(n)` for audio-reactive visuals | Off until the person turns it on; no context before a gesture; silent at once when the tab hides; every call a safe no-op without Web Audio |
| `SoundToggle` | The one mute: through the page's mixer, its bars follow `bands(4)` | `aria-pressed`, remembered, always in the nav when a page has sound |
| `SoundScene` | A section's loop fades in while it fills the view | Only with sound on, a fine pointer, motion allowed and loudness 2+ |
| `useSoundCue`, `useMuffleWhile` | A hover or press sound on any control; a muffle while an overlay is open (the OverlayMenu uses it) | Never on touch hover or key repeat; nothing when silent |
| `Cursor` states | Elements say `data-cursor="view|drag|play|link"`; the follower grows and labels them | The native cursor stays; never on fields; fine pointer, motion allowed, loudness 2+ |
| `PointerTilt`, `PointerField`, `PointerTrail` | A card leans toward the pointer (8° default, 12° at most); items yield within 300px (falloff 1-(d/r)²); images trail the pointer from a pool of 8 to 12 | Keyboard focus lifts instead of tilting; off on touch and reduced motion; loudness 2+ (the trail 3) |
| `UnderlineLink`, `RollText` | An underline that draws in and out; a label that rolls to its copy | On focus-visible too; one accessible name; colour only under reduced motion |

Product UI's micro-motion layer is in `@aleeforoughi/feather-react` (docs/visual-system.md §10, "Micro-motion").

## Wave 2: type, scroll and loudness

| Piece | What it does | Floor it keeps |
|---|---|---|
| `DisplayTitle` `effect` | `rise` (default), `mask` (lines rise from behind a mask, 0.8s, 0.1 per line, expo-out), `skew` (characters slide and unskew; at 992px and up), `oval` (lines open through a growing ellipse, 1.5s), `blink` (a film-cut flicker), `scramble` (characters settle left to right), `swap` (one word cycles in a `{word}` slot) | One accessible name, the full text; nothing in view starts hidden; plain text under reduced motion; swap pauses on hover, focus, `paused`, off screen and hidden |
| `Stage` `steps`, `snap` | Pinned storytelling: text steps scroll past a sticky visual; the active step is `data-step` and a render-prop argument | Steps stack in flow with no script or under reduced motion; never longer than 4 viewports |
| `ScrollLayers` | `parallax` (layers at depth 0.8 to 1.2, at most ±15%), `stack` (sticky cards; the earlier one scales to 0.95 and dims), `horizontal` (a pinned track on fine pointers), `scale` (media grows from an inset to full bleed) | Horizontal is a native snap rail on touch and under reduced motion; never takes over the wheel; the scale caption stays outside the clipped layer |
| `ImageSequence` | Scroll-scrubbed frames on a canvas: first and last frames load first, then midpoints; the nearest loaded frame draws, eased (lerp 0.08); a lighter set below 768px | The poster with its alt is the no-script, reduced-motion and data-saver form; capped pixel ratio; sleeps off screen and hidden |
| Route variants `slide`, `sheets`, `circle` | The new page slides over a receding old one (0.75s); arrives as a sheet tilted -4deg (0.8s); or opens as a circle from the last tap (0.9s) | Instant under reduced motion and without View Transitions; focus moves to the new h1 |
| `loudnessOf`, `allows` | The level at an element: the nearest `data-loudness`, else the brand's `--loudness`, else 1; what it allows: reveal 1, kinetic and scroll 2, scene 3 | Components only gate where a level is declared; reduced motion is stronger |

## The edge runtime (wave 1)

The runtime under the page edges and every heavy effect, in `core/`. The values are read from the 2026 award
winners' shipped code (Qooler file 27 §7); Feather takes the techniques and values, never their code.

| Piece | What it does |
|---|---|
| `MAX_DELTA` | The clock hands no tick more than 1/20s, so nothing teleports after a stall or a hidden tab. |
| `cappedPixelRatio(quality, dpr, width, height)`, `PIXEL_BUDGET` | The tier's DPR cap and a pixel budget: a canvas never draws more than 2560×1440 pixels, never below a 0.5 ratio. |
| `createQualityLadder` | Fed the frames a scene renders: steps down below 50fps (measured over 1s), tries one step up after 10s of comfort (doubling after a failed try), never measures while hidden, and reports when even the last level struggles. The World runs one: through the renderer's `levels`/`setLevel`, or by lowering its pixel ratio in three steps. |
| `capabilityGate`, `retire` | Heavy tier only with more than 4 cores and 4 GB, a fine pointer, WebGL, no data saver and no reduced motion; a retired effect stays light for 30 days. Unknown hints count as capable. `World` gates itself (`gate` prop). |
| `perFrame` | One task per frame on the clock; a World's `prewarm()` compiles shaders this way, behind the loader. |
| `honestProgress` | The lesser of real readiness and elapsed over a minimum (2.4s first visit, 1.4s on return), capped at 8s; clock time, so it waits in a hidden tab. |
| `createSoundPreference`, `sound`, `playBed` | Off by default, remembered, never audible while hidden; one looping bed with a 500ms fade. |
| `createTransitions().go(update, { variant })` | Route changes: `view` (the old page recedes, the new one wipes up, 0.8/0.95s on `--ease-wipe`), `push` (the old page drifts up 25vh under a veil, the new one rises, 1.2s on `--ease-push`), `columns` (four columns cover and lift, 0.06s stagger, each leg within the 1.2s cap), `fade`, `none`. Instant under reduced motion; then focus moves to the new `h1` and its title is announced. |

The curves are house constants in foundation.css: `--ease-wipe` (.76,0,.24,1), `--ease-route` (.625,.05,0,1),
`--ease-push` (.7,.05,.13,1). The `scripting:` and `noscript:` variants make the no-script tier of an enhanced block
(a menu panel, a loader) a plain part of the HTML.

## One clock

`core/clock.ts` is the only `requestAnimationFrame` in the website layer (the hygiene gate checks). Scroll
smoothing, scrub, counters, the magnetic pull, the cursor and the World all subscribe to it, and it runs only while
something is subscribed. A site that uses GSAP calls `clock.drive(gsap.ticker)` (or passes `gsap` to the scroll
engine), and then GSAP's ticker is the one loop. Feather ships neither Lenis nor GSAP: a site passes its own.

```tsx
import Lenis from "lenis"
import gsap from "gsap"
import { ScrollProvider } from "@aleeforoughi/feather-expression"

<ScrollProvider engine={{ kind: "lenis", create: (options) => new Lenis(options), gsap }}>…</ScrollProvider>
```

## Reduced motion

Every primitive has a path, and the hygiene gate fails a component that animates without one. The mapping comes
from the brand's tokens (`--reduced-*`): reveal, media and scene become a 150ms cross-fade; stagger, hover-out and
spring become nothing.

## Gates

- Gate 1 (`pnpm hygiene`) runs the product rules over this package, plus the website rules of §14.4.
- Gate 2 (the rendered audit) stays product UI's law and skips `Website/*`, `Living/*` and `Pages/*` stories: fluid
  display sizes and ratio leading are this layer's point.
- Every story runs axe in the Storybook a11y suite.
