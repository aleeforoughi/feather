# Scenes: `@aleeforoughi/feather-scene`

3D and WebGL for websites, as renderers for the expression layer's `World`. A scene is decoration with a floor under
it: the World caps the pixels, runs the quality ladder, gates heavy work to devices that will run it well, renders on
demand, pauses off screen and in a hidden tab, and shows its still (a real poster) before the first frame and
wherever the scene does not run. The meaning always lives in the DOM: a canvas is invisible to assistive technology.

Two entries:
- `@aleeforoughi/feather-scene`: raw WebGL, no dependency: shader backgrounds and image-to-depth.
- `@aleeforoughi/feather-scene/three`: Three.js scenes. `three` (MIT, 0.180 or later) is an optional peer: a site
  that uses this entry installs it; a page without a 3D scene never downloads it.

```tsx
import { World } from "@aleeforoughi/feather-expression"
import { shaderBackground, useScene } from "@aleeforoughi/feather-scene"

const aurora = shaderBackground({ preset: "aurora" })
<World {...useScene(aurora)} still={<img src="poster.avif" alt="" />} />
```

`useScene(renderer)` connects the scene to its World (so pointer input asks for a frame) and turns the World static
when the scene stops (no WebGL, a shader that will not compile, a lost context, an asset that will not load): the
still comes back.

## Raw WebGL (`.`)

| Renderer | What it is | Knobs |
|---|---|---|
| `shaderBackground` | One full-screen triangle, `mediump`, at a share (0.5–1) of the capped pixel ratio. Presets: `gradient-noise` (fbm noise over 3–5 palette stops), `aurora` (soft ribbons, additive on dark grounds), `grain-field` (a quiet grain stepped at 10fps), `flow` (a pointer-driven flowmap) | `palette` (CSS colours; default the theme's ground, primary, accent and blocks), `speed` 0–2, `scale`, `intensity` 0–1, `resolution` |
| `depthImage` | A photo and its depth map (made offline, never estimated at runtime) shifting by depth × pointer, device tilt (only after the person enables it) or a slow drift; cover-fit and zoomed so no edge ever shows | `strength` 0–1 (about 2% of the width), `focus` 0–1, `invert` |

Time reaches the shaders only as the sine and cosine of a 72-second loop, so a 16-bit `mediump` GPU never steps and
the motion loops without a seam. Colour ramps mix in OKLab.

## Three.js (`./three`)

| Renderer | What it is | Knobs |
|---|---|---|
| `objectViewer` | A GLB on a studio stage: a room environment through a PMREM (no HDR download), key and rim lights tinted from the theme, a contact shadow, fog from the ground; the model fitted and centred | `turntable` (°/s, pauses while inspected), `orbit` (limits, damping, sensitivity), `presets` (named angles), `hotspots` (screen positions through `onHotspots`, for real buttons over the canvas), `variants` (colour swaps by material or mesh name, never a reload), `exposure`, `background`, `post` |
| `attachKeys(el, viewer)` | Arrow keys turn the view, Home and 1–9 go to the presets; on a focusable wrapper (the World itself is `aria-hidden`) | |
| `particleField` | One `THREE.Points`: `dust`, a `field` that yields to the pointer (falloff 1-(d/r)²), or a `morph` between shapes sampled from geometries or a GLB | counts by tier (60k, 20k, 6k), `size`, `colors`, `opacity`, `drift`, `radius` |
| `cameraRail` | A camera along a Catmull-Rom curve through waypoints, eased toward a progress (damping 0.2s) the page sets from scroll; shaders compiled ahead in `prewarm` | `waypoints`, `lookAt`, `build(scene, theme)` or the default corridor (three draw calls) |
| `studioPost` | One composer: bloom, tone mapping, film grain and vignette in one pass; half-resolution bloom on mid, none on low | `bloom` (intensity 0.5–2, threshold 0.8–1, radius 0.5–1), `grain` 0–0.08, `vignette` 0–1 |

## The floor every scene keeps

- **Pixels:** never `devicePixelRatio` directly (the hygiene gate checks): the World's capped ratio and pixel budget.
- **Quality:** `levels` 3 and `setLevel`: each step lowers resolution, octaves, counts, shadows and post; the World's
  ladder steps down below 50fps and retires the scene to its still after the last level.
- **Gate:** the World runs a scene only on capable devices (more than 4 cores and 4 GB, a fine pointer, WebGL, no
  data saver, no reduced motion) and at loudness 3.
- **Prewarm:** `prewarm()` returns tasks (compile, upload) that run one per frame behind the loader.
- **On demand:** `frame()` returns true only while something moves; at rest nothing draws.
- **Drawn:** a renderer reports `drawn` once it has really drawn, and the World keeps its still up until then, so a
  loading photo or model never shows an empty canvas.
- **Dispose:** every geometry, material, texture, render target, program and the renderer itself is freed on unmount
  and on every route change; a lost context stops cleanly and a restored one rebuilds.

## On pages

A `feather.page/1` document asks for a scene with the `scene` knob on a hero, a case or a signature
([docs/page.md](page.md)). `FeatherPage` renders it as a `SceneLayer`: the World with the block's image (or a field in
the theme's colours) as its still, the raw scenes imported statically, and the Three.js scenes loaded on demand as
their own chunk. The release's web bundle ships that chunk as `feather-page-three.js` beside the runtime, which loads
it from its own URL.

