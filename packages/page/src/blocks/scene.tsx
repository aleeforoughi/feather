// SceneLayer: a block's 3D or WebGL scene (feather.page/1 `scene`, wave 4), on @aleeforoughi/feather-scene. The poster
// (the block's media, or a field in the theme's colours) is what the server writes, what shows first, and what every
// device the scene does not run on keeps: without WebGL, under reduced motion, with a data saver, on a touch screen,
// below loudness 3, or retired after struggling. The canvas is decoration (the World is aria-hidden); the meaning stays
// in the DOM, so a model's hotspots are real buttons over the canvas, mirrored in a visually hidden list the server
// already writes.
//
// The raw WebGL scenes (shader, depth) are imported statically: they are small and have no dependency. The Three.js
// scenes (particles, model, rail) load with a dynamic import, inside an effect, only on the client and only once the
// scene will run here (gate passed, loudness 3, no reduced motion, near the viewport), so a page without one never
// downloads Three.js and no first paint waits for it.
import * as React from "react"
import { World } from "@aleeforoughi/feather-expression"
import { allows, capabilityGate, loudnessOf, onReducedMotionChange, pickQuality, prefersReducedMotion, scrub, type DeviceHints, type Quality } from "@aleeforoughi/feather-expression/core"
import { depthImage, shaderBackground, useScene, type SceneRenderer, type ShaderPreset } from "@aleeforoughi/feather-scene"
import type { ObjectViewer, ScreenHotspot } from "@aleeforoughi/feather-scene/three"
import type { BlockScene, Media } from "../core/types"
import { mediaProps } from "./media"
import { BUTTON_QUIET, join } from "./shared"

export interface SceneLayerProps {
  scene: BlockScene
  /** The block's media: the poster, and the photo a depth scene gives depth to. */
  media?: Media
  /** What the scene shows (the block's title): names the model's stage and its list of parts. */
  label: string
  /** behind: fills the block behind its content (the parent is `relative isolate`). frame: a framed stage in the flow. */
  placement?: "behind" | "frame"
  /** The frame's aspect ratio. */
  aspect?: "4/3" | "16/9" | "1/1"
  /** The poster is the page's LCP: it loads eagerly, at high priority. */
  priority?: boolean
  className?: string
}

/** The capability gate's key: every page scene shares one verdict, and a device that struggles is retired from all. */
export const SCENE_GATE = "page-scene"

/** How near the viewport (in CSS pixels) a scene starts loading. */
const NEAR = "400px"

const TIERS: Exclude<Quality, "static">[] = ["low", "medium", "high"]

/** The tier a scene runs at here: what the device allows, never above the knob's ceiling. */
export function sceneQuality(device: Quality, knob: BlockScene["quality"]): Quality {
  if (knob === "poster" || device === "static") return "static"
  if (!knob || knob === "auto") return device
  return TIERS[Math.min(TIERS.indexOf(device), TIERS.indexOf(knob))]
}

/** A stand-in renderer while the scene is not running: the World shows its still and never starts a canvas. */
const RESTING: SceneRenderer = {
  frame: () => false,
  levels: 1,
  setLevel() {},
  prewarm: () => [],
  dispose() {},
  state: "idle",
  subscribe: () => () => {},
  connect() {},
}

/** The poster in the theme's colours, close to each preset's first frame. Tokens only. */
const FIELDS: Record<ShaderPreset | "default", string> = {
  "gradient-noise":
    "radial-gradient(90% 80% at 72% 28%, color-mix(in oklab, var(--primary) 30%, var(--background)), transparent 70%), radial-gradient(70% 60% at 18% 82%, color-mix(in oklab, var(--accent) 40%, var(--background)), transparent 72%), var(--background)",
  aurora:
    "linear-gradient(172deg, transparent 18%, color-mix(in oklab, var(--primary) 24%, var(--background)) 34%, transparent 52%), linear-gradient(176deg, transparent 38%, color-mix(in oklab, var(--accent) 30%, var(--background)) 50%, transparent 64%), var(--background)",
  "grain-field": "linear-gradient(180deg, var(--background) 20%, color-mix(in oklab, var(--primary) 26%, var(--background)))",
  flow: "radial-gradient(80% 70% at 30% 35%, color-mix(in oklab, var(--primary) 28%, var(--background)), transparent 70%), radial-gradient(60% 60% at 80% 75%, color-mix(in oklab, var(--accent) 38%, var(--background)), transparent 70%), var(--background)",
  default: "radial-gradient(60% 70% at 50% 45%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 70%), var(--background)",
}

const srcOf = (m: Media | undefined): string | undefined => (m === undefined ? undefined : typeof m === "string" ? m : m.src)

/** The poster: the block's image (or its video's poster), else the theme's field. */
function Poster({ scene, media, priority }: { scene: BlockScene; media?: Media; priority: boolean }) {
  const p = media ? mediaProps(media) : null
  const image = p ? (p.video ? (typeof media === "object" ? media.poster : undefined) : p.src) : undefined
  if (image) {
    return <img data-slot="scene-poster" data-variant="media" src={image} alt="" decoding="async" className="size-full object-cover" {...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : { loading: "lazy" as const })} />
  }
  const field = scene.kind === "shader" ? FIELDS[(scene.preset as ShaderPreset | undefined) ?? "gradient-noise"] ?? FIELDS.default : FIELDS.default
  return <div data-slot="scene-poster" data-variant="field" className="size-full" style={{ background: field }} />
}

let webgl: boolean | undefined
/** Whether this browser makes a WebGL context: asked once per visit, and only once everything cheaper has passed
 * (creating a context is a long task on a slow phone). */
function hasWebgl(): boolean {
  if (webgl === undefined) {
    try {
      const probe = document.createElement("canvas")
      webgl = !!(probe.getContext("webgl2") ?? probe.getContext("webgl"))
    } catch {
      webgl = false
    }
  }
  return webgl
}

/** The device's hints, cheapest first: without WebGL's answer until the rest would let a scene run. */
function sceneHints(el: Element): DeviceHints {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
  const hints: DeviceHints = {
    reducedMotion: prefersReducedMotion(el),
    saveData: nav.connection?.saveData === true,
    cores: nav.hardwareConcurrency,
    memory: nav.deviceMemory,
    coarsePointer: typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
  }
  return capabilityGate({ key: SCENE_GATE, hints }).full ? { ...hints, webgl: hasWebgl() } : { ...hints, webgl: false }
}

/** Whether the scene will run here, and at what tier: decided after mount (the server and the first render always
 * show the poster), once the scene nears the view, and again when reduced motion changes. */
function useSceneQuality(ref: React.RefObject<HTMLElement | null>, knob: BlockScene["quality"]): Quality {
  const [quality, setQuality] = React.useState<Quality>("static")
  React.useEffect(() => {
    const el = ref.current
    if (!el || knob === "poster") return
    let near = false
    const decide = () => {
      if (!near) return
      if (!allows(loudnessOf(el), "scene")) return setQuality("static")
      const hints = sceneHints(el)
      setQuality(capabilityGate({ key: SCENE_GATE, hints }).full ? sceneQuality(pickQuality(hints), knob) : "static")
    }
    // Heavy pieces mount only near the viewport (proximity mount), so a scene far down the page costs nothing yet.
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (!entries.some((e) => e.isIntersecting)) return
              near = true
              io?.disconnect()
              decide()
            },
            { rootMargin: NEAR }
          )
    if (io) io.observe(el)
    else {
      near = true
      decide()
    }
    const off = onReducedMotionChange(decide)
    return () => {
      io?.disconnect()
      off()
    }
  }, [ref, knob])
  return quality
}

/** The renderer for a scene, made only while it runs here. Three.js comes in its own chunk. */
function useRenderer(scene: BlockScene, media: Media | undefined, live: boolean, behind: boolean): SceneRenderer | null {
  const [renderer, setRenderer] = React.useState<SceneRenderer | null>(null)
  // A new renderer restarts the World: make one only when what it draws changes, not when the page re-renders.
  // The scene is JSON (it comes from the page document), so its text is its identity.
  const key = JSON.stringify({ scene, photo: srcOf(media) })
  React.useEffect(() => {
    if (!live) return
    const { scene: s, photo } = JSON.parse(key) as { scene: BlockScene; photo?: string }
    const depth = srcOf(s.depth)
    const model = srcOf(s.model)
    let alive = true
    let made: SceneRenderer | null = null
    const take = (r: SceneRenderer) => {
      if (!alive) return r.dispose()
      made = r
      setRenderer(r)
    }
    if (s.kind === "shader") take(shaderBackground({ preset: (s.preset as ShaderPreset | undefined) ?? "gradient-noise", ...(behind ? { intensity: 0.4 } : {}) }))
    else if (s.kind === "depth" && photo && depth) take(depthImage({ image: photo, depth }))
    else if (s.kind === "particles" || s.kind === "model" || s.kind === "rail") {
      void import("@aleeforoughi/feather-scene/three").then(
        (three) => {
          if (s.kind === "particles") take(three.particleField({ mode: s.preset === "field" || s.preset === "morph" ? s.preset : "dust" }))
          else if (s.kind === "rail") take(three.cameraRail({}))
          else if (model) take(three.objectViewer({ model, turntable: 12, background: "transparent", ...(s.hotspots ? { hotspots: s.hotspots } : {}), ...(s.variants ? { variants: s.variants } : {}) }))
        },
        // The chunk did not load (offline, blocked): the poster stays, and the page is complete without it.
        () => undefined
      )
    }
    return () => {
      alive = false
      // The World disposes a renderer it ran.
      if (made) setRenderer((current) => (current === made ? null : current))
    }
  }, [live, key, behind])
  return live ? renderer : null
}

/** A camera rail flies with the block's scroll; a morph pours from one shape to the other with it. */
function useScrollDrive(ref: React.RefObject<HTMLElement | null>, renderer: SceneRenderer | null) {
  React.useEffect(() => {
    const el = ref.current
    const drive = renderer as (SceneRenderer & { setProgress?: (p: number) => void; setMorph?: (p: number) => void }) | null
    const set = drive?.setProgress?.bind(drive) ?? drive?.setMorph?.bind(drive)
    if (!el || !set) return
    return scrub(el.closest("section") ?? el, set)
  }, [ref, renderer])
}

/**
 * A block's scene over its poster. A model is a stage you can turn (drag, or focus it and use the arrow keys), with
 * its parts as buttons over the canvas and its finishes as a radio group; everything else is a field behind the words
 * or in the block's frame. A scene that moves on its own has a pause control (WCAG 2.2.2).
 */
export function SceneLayer({ scene, media, label, placement = "frame", aspect = "4/3", priority = false, className }: SceneLayerProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const quality = useSceneQuality(root, scene.quality)
  const live = quality !== "static"
  const behind = placement === "behind" && scene.kind !== "model"
  const renderer = useRenderer(scene, media, live, behind)
  useScrollDrive(root, renderer)
  const world = useScene(renderer ?? RESTING, renderer ? quality : "static")
  const [paused, setPaused] = React.useState(false)
  const running = renderer !== null && world.quality !== "static"
  const moves = scene.kind !== "rail"
  const still = <Poster scene={scene} media={media} priority={priority} />
  const p = media ? mediaProps(media) : null
  const description = p && !p.decorative ? p.alt : undefined
  // The label says what a press does (as the film hero's control does), so it is not also a pressed toggle.
  const pause = running && moves ? (
    <button type="button" data-slot="scene-pause" data-variant={paused ? "paused" : "playing"} onClick={() => setPaused((v) => !v)} className={BUTTON_QUIET}>
      {paused ? "Play motion" : "Pause motion"}
    </button>
  ) : null

  if (scene.kind === "model") {
    return (
      <ModelStage
        root={root}
        scene={scene}
        label={label}
        aspect={aspect}
        className={className}
        world={<World still={still} gate={SCENE_GATE} {...world} />}
        viewer={running ? (renderer as ObjectViewer) : null}
        description={description}
      />
    )
  }

  if (behind) {
    return (
      <div ref={root} data-slot="scene-layer" data-variant={scene.kind} data-placement="behind" data-state={running ? "live" : "poster"} className={join("absolute inset-0 -z-10", className)}>
        <World still={still} gate={SCENE_GATE} paused={paused} {...world} />
        {pause ? (
          <div data-slot="scene-controls" className="absolute bottom-6 right-6 z-layer-raised">
            {pause}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={root} data-slot="scene-layer" data-variant={scene.kind} data-placement="frame" data-state={running ? "live" : "poster"} className={join("flex flex-col gap-4", className)}>
      <div data-slot="scene-frame" {...(description ? { role: "img", "aria-label": description } : {})} className="relative w-full overflow-hidden rounded-card border border-line-primary" style={{ aspectRatio: aspect }}>
        <World still={still} gate={SCENE_GATE} paused={paused} {...world} />
      </div>
      {pause ? (
        <div data-slot="scene-controls" className="flex flex-wrap gap-3">
          {pause}
        </div>
      ) : null}
    </div>
  )
}

/** The object viewer: a focusable stage (its keys named beside it), the hotspots as buttons over the canvas, the
 * finishes as a radio group, a way to stop the turntable, and the parts in a visually hidden list. */
function ModelStage({
  root,
  scene,
  label,
  aspect,
  className,
  world,
  viewer,
  description,
}: {
  root: React.RefObject<HTMLDivElement | null>
  scene: BlockScene
  label: string
  aspect: string
  className?: string
  world: React.ReactNode
  viewer: ObjectViewer | null
  description?: string
}) {
  const stage = React.useRef<HTMLDivElement>(null)
  const [spots, setSpots] = React.useState<ScreenHotspot[]>([])
  const [chosen, setChosen] = React.useState<string | null>(null)
  const [finish, setFinish] = React.useState(scene.variants?.[0]?.id ?? "")
  const [turning, setTurning] = React.useState(true)
  const id = React.useId().replace(/:/g, "")
  const hotspots = scene.hotspots ?? []
  const variants = scene.variants ?? []

  React.useEffect(() => viewer?.onHotspots(setSpots), [viewer])
  React.useEffect(() => {
    const el = stage.current
    if (!viewer || !el) return
    // attachKeys makes the stage focusable and names its keys (aria-keyshortcuts); it undoes both when it detaches.
    const detach = (async () => (await import("@aleeforoughi/feather-scene/three")).attachKeys(el, viewer))()
    return () => void detach.then((off) => off())
  }, [viewer])
  React.useEffect(() => viewer?.setTurntable(turning ? 12 : 0), [viewer, turning])

  return (
    <div ref={root} data-slot="scene-layer" data-variant="model" data-placement="frame" data-state={viewer ? "live" : "poster"} className={join("flex flex-col gap-4", className)}>
      <div
        ref={stage}
        data-slot="scene-stage"
        {...(viewer ? { role: "group", "aria-label": `${label}, to turn and inspect`, "aria-describedby": `${id}-keys` } : description ? { role: "img", "aria-label": description } : {})}
        className="relative w-full overflow-hidden rounded-card border border-line-primary focus-ring"
        style={{ aspectRatio: aspect }}
      >
        {world}
        {viewer ? (
          <div data-slot="scene-hotspots" className="pointer-events-none absolute inset-0">
            {spots.map((spot) =>
              spot.visible ? (
                <button
                  key={spot.id}
                  type="button"
                  data-slot="scene-hotspot"
                  data-variant={spot.facing ? "facing" : "behind"}
                  aria-pressed={chosen === spot.id}
                  onClick={() => {
                    setChosen(spot.id)
                    viewer.view(spot.id)
                  }}
                  className="pointer-events-auto absolute left-0 top-0 inline-flex min-h-12 items-center rounded-full border border-line-primary bg-surface-raised px-4 type-label text-fg-primary focus-ring"
                  style={{ transform: `translate(${spot.x}px, ${spot.y}px) translate(-50%, -50%)`, opacity: spot.facing ? 1 : 0.6 }}
                >
                  {spot.label}
                </button>
              ) : null
            )}
          </div>
        ) : null}
      </div>
      {viewer ? (
        <>
          <p id={`${id}-keys`} data-slot="scene-keys" className="type-caption text-fg-secondary">
            Drag to turn it, or focus it and use the arrow keys; 1 to 4 for the front, side, back and top.
          </p>
          <div data-slot="scene-controls" className="flex flex-wrap items-center gap-3">
            <button type="button" data-slot="scene-pause" data-variant={turning ? "playing" : "paused"} onClick={() => setTurning((v) => !v)} className={BUTTON_QUIET}>
              {turning ? "Stop turning" : "Turn slowly"}
            </button>
          </div>
          {variants.length > 1 ? (
            <fieldset data-slot="scene-variants" className="flex flex-col gap-2">
              <legend data-slot="scene-variants-label" className="type-label text-fg-primary">
                Finish
              </legend>
              <div data-slot="scene-variants-options" className="flex flex-wrap gap-4">
                {variants.map((v) => (
                  <label key={v.id} data-slot="scene-variant" className="inline-flex min-h-12 items-center gap-2 type-body text-fg-primary">
                    <input
                      type="radio"
                      name={`${id}-finish`}
                      value={v.id}
                      checked={finish === v.id}
                      onChange={() => {
                        setFinish(v.id)
                        viewer.setVariant(v.id)
                      }}
                      className="size-5 accent-primary focus-ring"
                    />
                    {v.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </>
      ) : null}
      {hotspots.length > 0 || variants.length > 0 ? (
        <div data-slot="scene-parts" className="sr-only">
          <p data-slot="scene-parts-label" id={`${id}-parts`}>{`${label}: its parts`}</p>
          {hotspots.length > 0 ? (
            <ul data-slot="scene-hotspot-list" aria-labelledby={`${id}-parts`}>
              {hotspots.map((h) => (
                <li key={h.id} data-slot="scene-hotspot-item">
                  {h.label}
                </li>
              ))}
            </ul>
          ) : null}
          {variants.length > 0 ? <p data-slot="scene-variant-list">{`Finishes: ${variants.map((v) => v.label).join(", ")}.`}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
