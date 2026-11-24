import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { ImageSequence } from "./image-sequence"

// The frames are drawn here, in the theme's own colours: a speaker cabinet turning a full circle over 24 frames (12
// for phones). Each frame is an SVG data URL, as a real product would ship AVIF or WebP frames from its renderer.
interface Palette {
  ground: string
  floor: string
  body: string
  face: string
  accent: string
}

const FALLBACK: Palette = { ground: "#f5f5f4", floor: "#e7e5e4", body: "#1c1917", face: "#44403c", accent: "#ea580c" }

function readPalette(): Palette {
  if (typeof window === "undefined") return FALLBACK
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return { ground: v("--surface-subtle", FALLBACK.ground), floor: v("--surface-pressed", FALLBACK.floor), body: v("--primary", FALLBACK.body), face: v("--text-secondary", FALLBACK.face), accent: v("--accent", FALLBACK.accent) }
}

type Vec = [number, number, number]
const W = 1200
const H = 900

/** One frame: a box 1.4 wide, 2 tall and 1.4 deep, turned by `angle` and seen from 18° above. */
function frame(angle: number, p: Palette, size = W): string {
  const tilt = (18 * Math.PI) / 180
  const scale = 170
  const turn = ([x, y, z]: Vec): Vec => {
    const cx = x * Math.cos(angle) + z * Math.sin(angle)
    const cz = -x * Math.sin(angle) + z * Math.cos(angle)
    return [cx, y * Math.cos(tilt) - cz * Math.sin(tilt), y * Math.sin(tilt) + cz * Math.cos(tilt)]
  }
  const at = ([x, y]: Vec) => `${(W / 2 + x * scale).toFixed(1)},${(H / 2 - 30 - y * scale).toFixed(1)}`
  const [a, b, c] = [0.7, 1, 0.7]
  const v: Vec[] = [
    [-a, -b, -c], [a, -b, -c], [a, b, -c], [-a, b, -c],
    [-a, -b, c], [a, -b, c], [a, b, c], [-a, b, c],
  ].map((q) => turn(q as Vec))
  // Faces with their outward normals; the front (z+) carries the driver, the top a thin accent stripe.
  const faces: Array<{ idx: number[]; n: Vec; kind: "front" | "side" | "top" | "back" }> = [
    { idx: [4, 5, 6, 7], n: [0, 0, 1], kind: "front" },
    { idx: [1, 0, 3, 2], n: [0, 0, -1], kind: "back" },
    { idx: [5, 1, 2, 6], n: [1, 0, 0], kind: "side" },
    { idx: [0, 4, 7, 3], n: [-1, 0, 0], kind: "side" },
    { idx: [7, 6, 2, 3], n: [0, 1, 0], kind: "top" },
  ]
  const shapes = faces
    .map((f) => ({ ...f, n: turn(f.n) }))
    .filter((f) => f.n[2] > 0.02)
    .map((f) => {
      const light = Math.max(0, f.n[0] * -0.5 + f.n[1] * 0.6 + f.n[2] * 0.6)
      const fill = f.kind === "top" ? p.face : p.body
      const points = f.idx.map((i) => at(v[i])).join(" ")
      let extra = ""
      if (f.kind === "front") {
        const centre = (y: number) => turn([0, y, c])
        const rim = (y: number, r: number) => {
          const [cx, cy] = at(centre(y)).split(",").map(Number)
          const rx = r * scale * Math.max(0.05, Math.abs(f.n[2]))
          return `<ellipse cx='${cx}' cy='${cy}' rx='${rx.toFixed(1)}' ry='${(r * scale * 0.95).toFixed(1)}' fill='${p.face}'/><ellipse cx='${cx}' cy='${cy}' rx='${(rx * 0.35).toFixed(1)}' ry='${(r * scale * 0.33).toFixed(1)}' fill='${p.accent}'/>`
        }
        extra = rim(-0.35, 0.45) + rim(0.55, 0.22)
      }
      return `<polygon points='${points}' fill='${fill}'/><polygon points='${points}' fill='#000' opacity='${(0.45 * (1 - light)).toFixed(3)}'/>${extra}`
    })
    .join("")
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${Math.round((size * H) / W)}' viewBox='0 0 ${W} ${H}'><rect width='${W}' height='${H}' fill='${p.ground}'/><ellipse cx='${W / 2}' cy='${H / 2 + 230}' rx='300' ry='46' fill='${p.floor}'/>${shapes}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function useFrames() {
  return React.useMemo(() => {
    const palette = readPalette()
    const turnBy = (count: number, size?: number) => Array.from({ length: count }, (_, i) => frame((i / count) * Math.PI * 2, palette, size))
    return { frames: turnBy(24), framesSmall: turnBy(12, 800), poster: frame(0, palette) }
  }, [])
}

const ALT = "The Field One speaker, a tall dark cabinet with two drivers, turning a full circle"

function Story({ reduced = false, fit }: { reduced?: boolean; fit?: "cover" | "contain" }) {
  const { frames, framesSmall, poster } = useFrames()
  const sequence = <ImageSequence frames={frames} framesSmall={framesSmall} poster={poster} alt={ALT} length={3} fit={fit} aria-label="Field One, all the way round" />
  return (
    <div data-slot="story-page" className="bg-surface-base" data-motion={reduced ? "reduced" : undefined}>
      <div data-slot="story-lead" className="page-grid min-h-dvh content-center gap-4 py-24">
        <p className="col-span-full type-caps text-fg-tertiary">Field One</p>
        <h1 className="col-span-full type-display-m text-fg-primary">Sound from every side</h1>
        <p className="col-span-full type-body-lg text-fg-secondary sm:col-span-6">One cabinet, two drivers and no front: it fills a room from wherever it stands. Scroll to turn it.</p>
      </div>
      {sequence}
      <div data-slot="story-tail" className="page-grid min-h-dvh content-center py-24">
        <p className="col-span-full type-body-lg text-fg-secondary sm:col-span-6">Oiled oak or graphite. 42 cm tall, 9 kg, and a battery that lasts a weekend.</p>
      </div>
    </div>
  )
}

const meta = {
  title: "Website/ImageSequence",
  component: ImageSequence,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A canvas that scrubs through frames as the section scrolls, the product-page technique. The poster renders first and is all that no script, reduced motion and data saver show. Frames load after the page, near the viewport, at low priority, two at a time (first and last, then midpoints); the nearest loaded frame is drawn meanwhile, and the shown frame eases toward the scroll (lerp 0.08) on the one clock. The pixel ratio is capped by the pixel budget; it stops off screen and in a hidden tab. Phones get the lighter set below 768px.",
      },
    },
  },
  args: { frames: [], poster: "", alt: ALT },
} satisfies Meta<typeof ImageSequence>

export default meta
type StoryObjType = StoryObj<typeof meta>

export const Default: StoryObjType = { render: () => <Story /> }
export const Contain: StoryObjType = { render: () => <Story fit="contain" /> }
export const ReducedMotion: StoryObjType = { render: () => <Story reduced /> }
