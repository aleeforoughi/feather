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
| `World` | One GPU canvas slot, owned by the brand's renderer | DPR capped per tier (2, 1.5, 1), quality tiers, render on demand, paused off screen and in a hidden tab, a still under reduced motion or without WebGL, `aria-hidden` |

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
