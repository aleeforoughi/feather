import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, TorusGeometry, Vector2 } from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { World } from "@aleeforoughi/feather-expression"
import { useScene } from "./shared/use-scene"
import { attachKeys, cameraRail, objectViewer, particleField, studioPost, type ParticleMode, type ScreenHotspot } from "./three"

// The Three.js scenes, each inside the World (one canvas, capped pixel ratio, on demand, paused off screen). Every one
// has its poster: what a device without WebGL, a data saver or reduced motion sees, and what shows before the first
// frame. The meaning lives in the DOM around the canvas, never in it.

const FRAME_HEIGHT = 420

/** A poster in the theme's own colours: a soft light on the ground, and the scene's name. */
function Poster({ title, line, light = "var(--accent)" }: { title: string; line: string; light?: string }) {
  return (
    <div data-slot="scene-poster" className="flex size-full items-end p-6" style={{ background: `radial-gradient(60% 70% at 50% 45%, color-mix(in oklab, ${light} 35%, transparent), transparent 70%), var(--background)` }}>
      <div className="flex flex-col gap-2">
        <p className="type-title text-fg-primary">{title}</p>
        <p className="type-body text-fg-secondary">{line}</p>
      </div>
    </div>
  )
}

function themeKey(globals: Record<string, unknown>) {
  return String(globals.theme ?? "feather")
}

// The product, made here and exported as a GLB, so the story needs no third-party file: a flask with a body, a cap
// and a grip band, each its own named material (the variants recolour them by name).
async function flaskGlb(): Promise<string> {
  const profile = [
    [0, 0],
    [0.55, 0],
    [0.62, 0.08],
    [0.62, 1.55],
    [0.5, 1.78],
    [0.32, 1.9],
    [0.32, 2.02],
  ].map(([x, y]) => new Vector2(x, y))
  const flask = new Group()
  const body = new Mesh(new LatheGeometry(profile, 64), new MeshStandardMaterial({ name: "body", roughness: 0.42, metalness: 0.25 }))
  body.name = "body"
  const cap = new Mesh(new CylinderGeometry(0.36, 0.36, 0.34, 48), new MeshStandardMaterial({ name: "cap", roughness: 0.7 }))
  cap.name = "cap"
  cap.position.y = 2.17
  const band = new Mesh(new TorusGeometry(0.63, 0.035, 12, 96), new MeshStandardMaterial({ name: "band", roughness: 0.85 }))
  band.name = "band"
  band.rotation.x = Math.PI / 2
  band.position.y = 0.45
  flask.add(body, cap, band)
  const glb = (await new GLTFExporter().parseAsync(flask, { binary: true })) as ArrayBuffer
  flask.traverse((node) => {
    const mesh = node as Mesh
    mesh.geometry?.dispose()
    ;(mesh.material as MeshStandardMaterial | undefined)?.dispose()
  })
  return URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }))
}

const FEATURES = [
  { id: "cap", position: [0, 2.34, 0] as [number, number, number], label: "Twist cap", detail: "A quarter turn seals it; the gasket comes out to clean." },
  { id: "wall", position: [0, 1.1, 0.62] as [number, number, number], label: "Double wall", detail: "Steel in two skins with a vacuum between: cold for 24 hours, hot for 12." },
  { id: "band", position: [0.66, 0.45, 0] as [number, number, number], label: "Grip band", detail: "Silicone, so it holds in a wet hand and goes quiet on a stone table." },
]

const FINISHES = [
  { id: "graphite", label: "Graphite", colors: { body: "--primary", cap: "--accent", band: "--accent" } },
  { id: "ember", label: "Ember", colors: { body: "--accent", cap: "--primary", band: "--primary" } },
  { id: "moss", label: "Moss", colors: { body: "--block-2", cap: "--foreground", band: "--block-1" } },
]

function ObjectViewerDemo() {
  const [url, setUrl] = React.useState<string | null>(null)
  React.useEffect(() => {
    let made: string | null = null
    let alive = true
    void flaskGlb().then((u) => {
      made = u
      if (alive) setUrl(u)
      else URL.revokeObjectURL(u)
    })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [])
  return url ? <FlaskViewer url={url} /> : <div data-slot="story-frame" className="w-full" style={{ height: FRAME_HEIGHT }}><Poster title="Field Flask" line="750 ml, double-walled steel." /></div>
}

function FlaskViewer({ url }: { url: string }) {
  const viewer = React.useMemo(() => objectViewer({ model: url, turntable: 12, hotspots: FEATURES, variants: FINISHES, background: "transparent" }), [url])
  const scene = useScene(viewer)
  const group = React.useRef<HTMLDivElement>(null)
  const [spots, setSpots] = React.useState<ScreenHotspot[]>([])
  const [finish, setFinish] = React.useState(FINISHES[0].id)
  const [feature, setFeature] = React.useState<string | null>(null)
  const [spinning, setSpinning] = React.useState(true)
  React.useEffect(() => viewer.onHotspots(setSpots), [viewer])
  React.useEffect(() => (group.current ? attachKeys(group.current, viewer) : undefined), [viewer])
  React.useEffect(() => viewer.setTurntable(spinning ? 12 : 0), [viewer, spinning])
  const chosen = FEATURES.find((f) => f.id === feature)
  const instructions = React.useId()
  return (
    <div data-slot="story-viewer" className="flex w-full flex-col gap-6">
      <div className="flex max-w-prose flex-col gap-2">
        <h2 className="type-heading-2 text-fg-primary">Field Flask, 750 ml</h2>
        <p className="type-body text-fg-secondary">Turn it to see how it is made. Every part named on the flask is also in the list below.</p>
      </div>
      <div ref={group} role="group" aria-label="Field Flask, to turn and inspect" aria-describedby={instructions} data-slot="story-stage" className="focus-ring relative w-full rounded-card" style={{ height: FRAME_HEIGHT }}>
        <World still={<Poster title="Field Flask" line="750 ml, double-walled steel." />} gate={false} {...scene} />
        <div data-slot="story-hotspots" className="absolute inset-0" style={{ pointerEvents: "none" }}>
          {spots.map((spot) =>
            spot.visible ? (
              <button
                key={spot.id}
                type="button"
                data-slot="story-hotspot"
                aria-pressed={feature === spot.id}
                onClick={() => {
                  setFeature(spot.id)
                  viewer.view(spot.id)
                }}
                className="focus-ring absolute left-0 top-0 inline-flex h-control items-center gap-2 rounded-full border border-line-primary bg-surface-raised px-4 type-label text-fg-primary"
                style={{ transform: `translate(${spot.x}px, ${spot.y}px) translate(-50%, -50%)`, pointerEvents: "auto", opacity: spot.facing ? 1 : 0.45 }}
              >
                {spot.label}
              </button>
            ) : null,
          )}
        </div>
      </div>
      <p id={instructions} className="type-body text-fg-secondary">
        Drag sideways, or focus the flask and use the arrow keys. Keys 1 to 4 go to the front, side, back and top views.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {viewer.presets.map((p) => (
          <button key={p.id} type="button" data-slot="story-preset" onClick={() => viewer.view(p.id)} className="focus-ring inline-flex h-control items-center rounded-control border border-line-primary px-4 type-label text-fg-primary">
            {p.label}
          </button>
        ))}
        <button type="button" data-slot="story-pause" aria-pressed={!spinning} onClick={() => setSpinning((s) => !s)} className="focus-ring inline-flex h-control items-center rounded-control border border-line-primary px-4 type-label text-fg-primary">
          {spinning ? "Stop turning" : "Turn slowly"}
        </button>
      </div>
      <fieldset data-slot="story-finish" className="flex flex-col gap-2">
        <legend className="type-label text-fg-primary">Finish</legend>
        <div className="flex flex-wrap gap-4">
          {FINISHES.map((f) => (
            <label key={f.id} className="inline-flex min-h-12 items-center gap-2 type-body text-fg-primary">
              <input
                type="radio"
                name="finish"
                value={f.id}
                checked={finish === f.id}
                onChange={() => {
                  setFinish(f.id)
                  viewer.setVariant(f.id)
                }}
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p aria-live="polite" className="type-body text-fg-secondary">
        {chosen ? `${chosen.label}: ${chosen.detail}` : `Finish: ${FINISHES.find((f) => f.id === finish)?.label}.`}
      </p>
      <ul data-slot="story-features" className="flex flex-col gap-2">
        {FEATURES.map((f) => (
          <li key={f.id} className="type-body text-fg-primary">
            <strong>{f.label}.</strong> {f.detail}
          </li>
        ))}
      </ul>
    </div>
  )
}

const FIELD_COPY: Record<ParticleMode, { title: string; line: string }> = {
  dust: { title: "Ambient dust", line: "A slow drift of points in the brand's colours, behind the words." },
  field: { title: "A field that yields", line: "Move the pointer across it: the points part around it and settle back." },
  morph: { title: "From one shape to another", line: "The same points pour from a sphere into a ring." },
}

function ParticleDemo({ mode }: { mode: ParticleMode }) {
  const field = React.useMemo(() => particleField({ mode }), [mode])
  const scene = useScene(field)
  const [paused, setPaused] = React.useState(false)
  const [shape, setShape] = React.useState<"sphere" | "torus">("sphere")
  const copy = FIELD_COPY[mode]
  return (
    <div data-slot="story-particles" className="flex w-full flex-col gap-6">
      <div className="flex max-w-prose flex-col gap-2">
        <h2 className="type-heading-2 text-fg-primary">{copy.title}</h2>
        <p className="type-body text-fg-secondary">{copy.line}</p>
      </div>
      <div data-slot="story-frame" className="relative w-full" style={{ height: FRAME_HEIGHT }}>
        <World still={<Poster title={copy.title} line={copy.line} light="var(--primary)" />} gate={false} paused={paused} {...scene} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" data-slot="story-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)} className="focus-ring inline-flex h-control items-center rounded-control border border-line-primary px-4 type-label text-fg-primary">
          {paused ? "Play" : "Pause"}
        </button>
        {mode === "morph" ? (
          <fieldset data-slot="story-shape" className="flex flex-wrap items-center gap-4">
            <legend className="sr-only">Shape</legend>
            {(["sphere", "torus"] as const).map((s) => (
              <label key={s} className="inline-flex min-h-12 items-center gap-2 type-body text-fg-primary">
                <input
                  type="radio"
                  name="shape"
                  value={s}
                  checked={shape === s}
                  onChange={() => {
                    setShape(s)
                    field.setMorph(s === "torus" ? 1 : 0)
                  }}
                />
                {s === "sphere" ? "Sphere" : "Ring"}
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>
    </div>
  )
}

const STOPS = ["Arrival", "The colonnade", "Through the rings", "The overlook"]

function RailDemo({ post: withPost, toggle = false }: { post: boolean; toggle?: boolean }) {
  const [on, setOn] = React.useState(withPost)
  const rail = React.useMemo(() => cameraRail({ post: on ? studioPost({ bloom: { intensity: 1.1, threshold: 1, radius: 0.6 }, grain: 0.03, vignette: 0.35 }) : undefined }), [on])
  const scene = useScene(rail)
  const [value, setValue] = React.useState(0)
  React.useEffect(() => rail.setProgress(value / 100), [rail, value])
  const stop = STOPS[Math.min(STOPS.length - 1, Math.floor((value / 100) * STOPS.length))]
  const id = React.useId()
  return (
    <div data-slot="story-rail" className="flex w-full flex-col gap-6">
      <div className="flex max-w-prose flex-col gap-2">
        <h2 className="type-heading-2 text-fg-primary">A walk through the corridor</h2>
        <p className="type-body text-fg-secondary">On a page, scroll drives the flight. Here the slider does: the camera eases to where you leave it, then rests.</p>
      </div>
      <div data-slot="story-frame" className="relative w-full" style={{ height: FRAME_HEIGHT }}>
        <World still={<Poster title="The corridor" line="Columns in the brand's colours, rings of light, a long view." />} gate={false} {...scene} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="type-label text-fg-primary">
          Flight
        </label>
        <input id={id} type="range" min={0} max={100} value={value} aria-valuetext={`${value}%, ${stop}`} onChange={(e) => setValue(Number(e.target.value))} className="w-full" />
        <p aria-live="polite" className="type-body text-fg-secondary">
          {stop}
        </p>
      </div>
      {toggle ? (
        <label className="inline-flex min-h-12 items-center gap-2 type-body text-fg-primary">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
          Bloom, grain and vignette
        </label>
      ) : null}
    </div>
  )
}

const meta = {
  title: "Website/Scene/Three",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Feather's Three.js scenes (`@aleeforoughi/feather-scene/three`), each a World renderer: an object viewer on a studio stage, a particle field and a camera on rails, with one optional post chain. They read the theme's colours at mount, render on demand, lower post, shadows and counts down the quality ladder, and show their poster wherever they do not run.",
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** A product made in the story and exported as a GLB: hotspots are real buttons over the canvas, the finishes a radio
 * group, the arrow keys turn it, and the turntable stops on request. */
export const ObjectViewer: Story = {
  render: (_args, { globals }) => <ObjectViewerDemo key={themeKey(globals)} />,
}
export const ParticleDust: Story = {
  render: (_args, { globals }) => <ParticleDemo key={themeKey(globals)} mode="dust" />,
}
export const ParticlePointerField: Story = {
  render: (_args, { globals }) => <ParticleDemo key={themeKey(globals)} mode="field" />,
}
export const ParticleMorph: Story = {
  render: (_args, { globals }) => <ParticleDemo key={themeKey(globals)} mode="morph" />,
}
/** Scrubbed by a range input, as scroll would on a page. */
export const CameraRail: Story = {
  render: (_args, { globals }) => <RailDemo key={themeKey(globals)} post={false} />,
}
/** The same flight through the post chain: bloom on the rings, a 3% grain while it moves, a vignette. */
export const PostOn: Story = {
  render: (_args, { globals }) => <RailDemo key={themeKey(globals)} post toggle />,
}
export const PostOff: Story = {
  render: (_args, { globals }) => <RailDemo key={themeKey(globals)} post={false} toggle />,
}
/** What a device without WebGL, with a data saver or with reduced motion sees: every scene's still. */
export const Posters: Story = {
  render: () => (
    <div data-slot="story-posters" className="grid w-full gap-4 sm:grid-cols-2">
      {[
        <Poster key="viewer" title="Field Flask" line="750 ml, double-walled steel." />,
        <Poster key="particles" title="Ambient dust" line="A slow drift of points in the brand's colours." light="var(--primary)" />,
        <Poster key="rail" title="The corridor" line="Columns in the brand's colours, rings of light, a long view." />,
      ].map((poster) => (
        <div key={poster.key} data-slot="story-frame" className="w-full overflow-hidden rounded-card" style={{ height: 240 }}>
          <World renderer={{ frame: () => false }} still={poster} quality="static" />
        </div>
      ))}
    </div>
  ),
}
