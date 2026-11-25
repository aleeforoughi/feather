import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { DisplayTitle, World } from "@aleeforoughi/feather-expression"
import type { Quality } from "@aleeforoughi/feather-expression/core"
import { useScene } from "./shared/use-scene"
import type { SceneRenderer } from "./shared/scene"
import { shaderBackground, type ShaderPreset } from "./raw/shader-background"
import { depthImage, type DepthImage } from "./raw/depth-image"

// Each scene as a real hero: the World fills the band behind the page grid, the display title and the lede are real
// text in the DOM (the canvas is decoration, aria-hidden), and the still is the poster everyone gets first and every
// device the scene does not run on keeps. The colours are the theme's: switch the brand in the toolbar.

/** The poster for each preset: a CSS field in the theme's own colours, close to the scene's first frame. */
const POSTER: Record<ShaderPreset, React.CSSProperties> = {
  "gradient-noise": {
    background:
      "radial-gradient(90% 80% at 72% 28%, color-mix(in oklab, var(--primary) 42%, var(--background)), transparent 70%), radial-gradient(70% 60% at 18% 82%, color-mix(in oklab, var(--accent) 60%, var(--background)), transparent 72%), var(--background)",
  },
  aurora: {
    background:
      "linear-gradient(172deg, transparent 18%, color-mix(in oklab, var(--primary) 30%, var(--background)) 34%, transparent 52%), linear-gradient(176deg, transparent 38%, color-mix(in oklab, var(--accent) 40%, var(--background)) 50%, transparent 64%), var(--background)",
  },
  "grain-field": { background: "linear-gradient(180deg, var(--background) 20%, color-mix(in oklab, var(--primary) 35%, var(--background)))" },
  flow: {
    background:
      "radial-gradient(80% 70% at 30% 35%, color-mix(in oklab, var(--primary) 38%, var(--background)), transparent 70%), radial-gradient(60% 60% at 80% 75%, color-mix(in oklab, var(--accent) 55%, var(--background)), transparent 70%), var(--background)",
  },
}

function Poster({ style }: { style: React.CSSProperties }) {
  return <div data-slot="story-poster" className="size-full" style={style} />
}

interface HeroProps {
  scene: SceneRenderer
  still: React.ReactNode
  kicker: string
  title: string
  lede: string
  quality?: Quality
  /** Text over a photograph keeps its own light ink and a scrim, whatever the theme. */
  overPhoto?: boolean
  children?: React.ReactNode
}

function Hero({ scene, still, kicker, title, lede, quality, overPhoto = false, children }: HeroProps) {
  const id = React.useId()
  const world = useScene(scene, quality)
  return (
    <section data-slot="story-hero" data-loudness="3" aria-labelledby={id} className="relative isolate flex flex-col justify-end overflow-hidden bg-surface-base" style={{ minHeight: "min(88vh, 760px)" }}>
      <div data-slot="story-hero-scene" className="absolute inset-0 -z-10">
        <World still={still} {...world} />
        {overPhoto ? <div data-slot="story-hero-scrim" className="absolute inset-0" style={{ background: "linear-gradient(to top, rgb(8 10 14 / 0.72), rgb(8 10 14 / 0) 62%)" }} /> : null}
      </div>
      <div data-slot="story-hero-content" className="page-grid pt-32 pb-16">
        <div data-slot="story-hero-copy" className="col-span-full flex flex-col gap-6 lg:col-span-8" style={overPhoto ? { color: "rgb(246 244 240)" } : undefined}>
          <p className={overPhoto ? "type-label" : "type-label text-fg-secondary"}>{kicker}</p>
          <DisplayTitle as="h1" size="xl" id={id} className={overPhoto ? undefined : "text-fg-primary"}>
            {title}
          </DisplayTitle>
          <p className={overPhoto ? "type-body-lg max-w-prose" : "type-body-lg max-w-prose text-fg-secondary"}>{lede}</p>
          {children}
        </div>
      </div>
    </section>
  )
}

interface ShaderArgs {
  speed: number
  scale: number
  intensity: number
  resolution: number
}

const COPY: Record<ShaderPreset, { kicker: string; title: string; lede: string }> = {
  "gradient-noise": { kicker: "Studio, est. 2014", title: "Quiet work, made to last", lede: "Brand systems and websites for companies that would rather be understood than noticed." },
  aurora: { kicker: "Night sessions", title: "Light, after hours", lede: "A season of listening rooms: twelve evenings, one room, the lights low." },
  "grain-field": { kicker: "Issue 07", title: "On slowness", lede: "Essays on craft, patience and the long middle of making things." },
  flow: { kicker: "Move the pointer", title: "Everything bends a little", lede: "The field follows your hand and settles when you stop; on touch it drifts on its own." },
}

/** One preset as a hero. The renderer is made once per brand and per knob setting (a new renderer restarts the World). */
function ShaderHero({ preset, args, theme, quality }: { preset: ShaderPreset; args: ShaderArgs; theme: string; quality?: Quality }) {
  const scene = React.useMemo(
    () => shaderBackground({ preset, ...args }),
    // The theme is read when the scene starts, so a new brand makes a new scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, args.speed, args.scale, args.intensity, args.resolution, theme]
  )
  return <Hero scene={scene} still={<Poster style={POSTER[preset]} />} quality={quality} {...COPY[preset]} />
}

const meta = {
  title: "Website/Scene/Shaders",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Shader backgrounds and the depth image from `@aleeforoughi/feather-scene`: raw WebGL renderers that run inside the `World`. One full-screen triangle and one program per preset, drawn at the World's capped pixel ratio times a resolution share (default 0.75), in the theme's colours, three quality levels (resolution and octaves), paused off screen and in a hidden tab, a still under reduced motion and on every device the capability gate turns away. Spread `useScene(scene)` on the World so a lost GPU context puts the still back.",
      },
    },
  },
  argTypes: {
    speed: { control: { type: "range", min: 0, max: 2, step: 0.1 } },
    scale: { control: { type: "range", min: 0.25, max: 4, step: 0.05 } },
    intensity: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
    resolution: { control: { type: "range", min: 0.5, max: 1, step: 0.05 } },
  },
  args: { speed: 1, scale: 1, intensity: 0.45, resolution: 0.75 },
} satisfies Meta<ShaderArgs>

export default meta
type Story = StoryObj<ShaderArgs>

const theme = (globals: Record<string, unknown>) => String(globals.theme ?? "feather")

/** fbm noise flowing over the theme's stops (ground, primary, accent, blocks). Intensity 0.45 keeps the darkest point
 * of the field far enough from the title's ink for contrast. */
export const GradientNoise: Story = { render: (args, { globals }) => <ShaderHero preset="gradient-noise" args={args} theme={theme(globals)} /> }

/** Soft layered ribbons: light adds on a dark ground, and tints a light one. */
export const Aurora: Story = { args: { intensity: 0.7 }, render: (args, { globals }) => <ShaderHero preset="aurora" args={args} theme={theme(globals)} /> }

/** A quiet grain over a two-colour ground, stepped ten times a second like film. */
export const GrainField: Story = { args: { intensity: 0.5, resolution: 1 }, render: (args, { globals }) => <ShaderHero preset="grain-field" args={args} theme={theme(globals)} /> }

/** The gradient bent by a pointer flowmap; at rest it renders on demand, and on touch the point drifts on its own. */
export const Flow: Story = { render: (args, { globals }) => <ShaderHero preset="flow" args={args} theme={theme(globals)} /> }

/** What a device the capability gate turns away gets (touch, little memory, no WebGL, data saving, reduced motion, or
 * retired after struggling): the poster and the whole page, never a blank frame. */
export const GatedPoster: Story = { render: (args, { globals }) => <ShaderHero preset="gradient-noise" args={args} theme={theme(globals)} quality="static" /> }

// The depth image: an SVG landscape and its depth map, made here so the story needs no files. White is near.
const W = 1600
const H = 1000
function landscape(kind: "photo" | "depth"): string {
  const d = kind === "depth"
  const fill = (photo: string, depth: string) => (d ? depth : photo)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fill("#1f2a52", "#000")}"/><stop offset="0.55" stop-color="${fill("#b9708a", "#000")}"/><stop offset="0.75" stop-color="${fill("#f2b48a", "#000")}"/></linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fill("#3a3550", "#8a8a8a")}"/><stop offset="1" stop-color="${fill("#14141f", "#e8e8e8")}"/></linearGradient>
    <radialGradient id="sun"><stop offset="0" stop-color="#fff1d6"/><stop offset="0.35" stop-color="#ffd9a8" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb98a" stop-opacity="0"/></radialGradient>
    <linearGradient id="stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fill("#5a4a5e", "#fff")}"/><stop offset="0.5" stop-color="${fill("#1b1822", "#f4f4f4")}"/></linearGradient>
    <filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <g ${d ? 'filter="url(#soft)"' : ""}>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${d ? "" : `<circle cx="1110" cy="330" r="260" fill="url(#sun)"/><circle cx="1110" cy="330" r="64" fill="#fff4e0"/>`}
    <path d="M0 600 L0 430 C 200 380 330 470 520 405 S 860 330 1040 410 S 1400 360 1600 425 L1600 600 Z" fill="${fill("#6a6488", "#3c3c3c")}"/>
    <path d="M0 660 L0 540 C 240 480 420 575 700 530 S 1150 480 1600 555 L1600 690 Z" fill="${fill("#423b5c", "#6e6e6e")}"/>
    <rect y="610" width="${W}" height="${H - 610}" fill="url(#ground)"/>
    <ellipse cx="1260" cy="800" rx="180" ry="112" fill="${fill("#221d2b", "#d8d8d8")}"/>
    <ellipse cx="380" cy="880" rx="320" ry="180" fill="url(#stone)"/>
  </g>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function DepthHero({ strength, focus }: { strength: number; focus: number }) {
  const photo = React.useMemo(() => landscape("photo"), [])
  const depth = React.useMemo(() => landscape("depth"), [])
  const scene = React.useMemo<DepthImage>(() => depthImage({ image: photo, depth, strength, focus }), [photo, depth, strength, focus])
  const [tilt, setTilt] = React.useState<"off" | "on" | "refused">("off")
  return (
    <Hero
      scene={scene}
      overPhoto
      still={<img src={photo} alt="" className="size-full object-cover" data-slot="story-depth-still" />}
      kicker="Field notes"
      title="The valley at dusk"
      lede="A photograph and its depth map. Move the pointer and the stones lean against the hills; on a phone it drifts, or follows the tilt once you turn motion on."
    >
      <button
        type="button"
        data-slot="story-tilt"
        aria-pressed={tilt === "on"}
        onClick={async () => {
          if (tilt === "on") {
            scene.disableTilt()
            setTilt("off")
          } else setTilt((await scene.enableTilt()) ? "on" : "refused")
        }}
        className="type-label self-start rounded-full border px-5"
        style={{ minHeight: 44, borderColor: "rgb(246 244 240 / 0.5)" }}
      >
        {tilt === "on" ? "Motion on: tilt to look around" : tilt === "refused" ? "Motion is off on this device" : "Turn on motion"}
      </button>
    </Hero>
  )
}

/** A photograph and its depth map (made offline, here as SVG): uv shifted by depth × pointer, the focus depth still,
 * zoomed just enough that no edge ever shows. Strength 0.4 parts the nearest and farthest by about 2% of the width. */
export const DepthImageHero: StoryObj<{ strength: number; focus: number }> = {
  name: "Depth image",
  parameters: { controls: { include: ["strength", "focus"] } },
  argTypes: {
    strength: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
    focus: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
  },
  args: { strength: 0.4, focus: 0.5 },
  render: (args) => <DepthHero strength={args.strength} focus={args.focus} />,
}
