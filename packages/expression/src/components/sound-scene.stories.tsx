import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { createMixer, type Mixer } from "../core/audio"
import { clock } from "../core/clock"
import { createSoundPreference } from "../core/sound"
import { useReducedMotion } from "../hooks"
import { Section } from "./section"
import { useMuffleWhile, useMixerAudible, useSoundCue } from "./sound-hooks"
import { SoundScene } from "./sound-scene"
import { SoundToggle } from "./sound-toggle"

// Every sound here is made in the story with an OfflineAudioContext: two soft pads (each loops seamlessly, every
// partial a whole number of cycles in four seconds), a click and a tick. No file is shipped or fetched from elsewhere.
const RATE = 44100

function offline(seconds: number): OfflineAudioContext | null {
  if (typeof OfflineAudioContext === "undefined") return null
  return new OfflineAudioContext(1, Math.round(seconds * RATE), RATE)
}

/** A pad: sine and triangle partials (in Hz, multiples of 0.25 so a 4s loop has no seam) under a gentle low-pass,
 * breathing once per loop. */
async function pad(partials: number[]): Promise<AudioBuffer | null> {
  const ctx = offline(4)
  if (!ctx) return null
  const filter = ctx.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.value = 1400
  const breath = ctx.createGain()
  breath.gain.value = 0.7
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.25
  const depth = ctx.createGain()
  depth.gain.value = 0.3
  lfo.connect(depth)
  depth.connect(breath.gain)
  filter.connect(breath)
  breath.connect(ctx.destination)
  partials.forEach((hz, i) => {
    for (const [type, detune, level] of [["sine", 0, 0.12], ["triangle", 0.5, 0.05]] as const) {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = hz + detune
      const g = ctx.createGain()
      g.gain.value = level / (1 + i * 0.4)
      osc.connect(g)
      g.connect(filter)
      osc.start()
    }
  })
  lfo.start()
  return ctx.startRendering()
}

/** A short struck tone with a breath of noise: a click (press) or, higher and softer, a tick (hover). */
async function strike(hz: number, ms: number, level: number): Promise<AudioBuffer | null> {
  const ctx = offline(ms / 1000 + 0.02)
  if (!ctx) return null
  const env = ctx.createGain()
  env.gain.setValueAtTime(level, 0)
  env.gain.exponentialRampToValueAtTime(0.0001, ms / 1000)
  env.connect(ctx.destination)
  const osc = ctx.createOscillator()
  osc.frequency.value = hz
  osc.connect(env)
  osc.start()
  const noise = ctx.createBuffer(1, Math.round(0.004 * RATE), RATE)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.4
  const burst = ctx.createBufferSource()
  burst.buffer = noise
  burst.connect(env)
  burst.start()
  return ctx.startRendering()
}

/** A rendered buffer as a WAV blob URL, so the loops go through the mixer's real fetch and decode. */
function wavUrl(buffer: AudioBuffer): string {
  const samples = buffer.getChannelData(0)
  const bytes = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const text = (at: number, s: string) => [...s].forEach((c, i) => bytes.setUint8(at + i, c.charCodeAt(0)))
  text(0, "RIFF")
  bytes.setUint32(4, 36 + samples.length * 2, true)
  text(8, "WAVEfmt ")
  bytes.setUint32(16, 16, true)
  bytes.setUint16(20, 1, true)
  bytes.setUint16(22, 1, true)
  bytes.setUint32(24, buffer.sampleRate, true)
  bytes.setUint32(28, buffer.sampleRate * 2, true)
  bytes.setUint16(32, 2, true)
  bytes.setUint16(34, 16, true)
  text(36, "data")
  bytes.setUint32(40, samples.length * 2, true)
  samples.forEach((v, i) => bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true))
  return URL.createObjectURL(new Blob([bytes.buffer], { type: "audio/wav" }))
}

interface Kit {
  hall: string
  garden: string
  click: AudioBuffer
  tick: AudioBuffer
}

/** One mixer for these stories, as a page has one: its own preference (not remembered), made on first use. Each
 * story's loops stop when it unmounts. */
let studio: Mixer | null = null
const studioMixer = () => (studio ??= createMixer({ preference: createSoundPreference({ storage: null }) }))

/** The stories' mixer and their generated sounds. */
function useStudio(): { mixer: Mixer; kit: Kit | null } {
  const mixer = studioMixer()
  const [kit, setKit] = React.useState<Kit | null>(null)
  React.useEffect(() => {
    let urls: string[] = []
    let live = true
    void Promise.all([pad([110, 165, 220, 277.25]), pad([146.75, 220, 293.5, 370]), strike(1760, 60, 0.5), strike(2640, 30, 0.25)]).then(([hall, garden, click, tick]) => {
      if (!live || !hall || !garden || !click || !tick) return
      urls = [wavUrl(hall), wavUrl(garden)]
      setKit({ hall: urls[0]!, garden: urls[1]!, click, tick })
    })
    return () => {
      live = false
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])
  return { mixer, kit }
}

const Bar = ({ mixer, title = "Studio of One" }: { mixer: Mixer; title?: string }) => (
  <header data-slot="story-header" className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line-primary bg-surface-base px-6 text-fg-primary">
    <span className="type-title">{title}</span>
    <SoundToggle mixer={mixer} />
  </header>
)

const Waiting = () => (
  <p data-slot="story" className="p-6 type-body text-fg-secondary">
    Preparing the sounds.
  </p>
)

const BUTTON = "inline-flex min-h-12 items-center justify-center rounded-control border border-line-primary px-4 type-label text-fg-primary focus-ring motion-hover-out not-disabled:hover:bg-surface-hover"

function SectionLoopsDemo() {
  const { mixer, kit } = useStudio()
  if (!kit) return <Waiting />
  return (
    <div data-loudness="2" className="bg-surface-base text-fg-primary">
      <Bar mixer={mixer} />
      <SoundScene src={kit.hall} mixer={mixer}>
        <Section space="xl" aria-labelledby="hall-title">
          <div className="col-span-full flex min-h-screen flex-col justify-center gap-4">
            <h2 id="hall-title" className="type-display-m">
              The hall
            </h2>
            <p className="type-body-lg text-prose max-w-prose">Turn sound on, then scroll: each room has its own air, and it fades in as the room fills the view.</p>
          </div>
        </Section>
      </SoundScene>
      <SoundScene src={kit.garden} mixer={mixer} volume={0.8}>
        <Section space="xl" tone="subtle" aria-labelledby="garden-title">
          <div className="col-span-full flex min-h-screen flex-col justify-center gap-4">
            <h2 id="garden-title" className="type-display-m">
              The garden
            </h2>
            <p className="type-body-lg text-prose max-w-prose">Desktop only, at loudness 2 and up, never under reduced motion. The toggle in the bar is the one mute.</p>
          </div>
        </Section>
      </SoundScene>
    </div>
  )
}

function CueButton({ mixer, kit, children }: { mixer: Mixer; kit: Kit; children: React.ReactNode }) {
  const hover = useSoundCue("tick", { on: "hover", src: kit.tick, mixer })
  const press = useSoundCue("click", { on: "press", src: kit.click, mixer, bus: "effects" })
  return (
    <button type="button" data-slot="story-action" className={BUTTON} {...hover} {...press}>
      {children}
    </button>
  )
}

function CuesDemo() {
  const { mixer, kit } = useStudio()
  if (!kit) return <Waiting />
  return (
    <div className="bg-surface-base text-fg-primary">
      <Bar mixer={mixer} />
      <div className="flex flex-col gap-4 p-6">
        <p className="type-body text-fg-secondary max-w-prose">With sound on, a tick on hover (a fine pointer only) and a click on press (pointer, Enter or Space; never on key repeat), at most five a second.</p>
        <div className="flex flex-wrap gap-3">
          <CueButton mixer={mixer} kit={kit}>
            Book a call
          </CueButton>
          <CueButton mixer={mixer} kit={kit}>
            See the work
          </CueButton>
          <CueButton mixer={mixer} kit={kit}>
            Studio
          </CueButton>
        </div>
      </div>
    </div>
  )
}

function Bed({ mixer, src }: { mixer: Mixer; src: string }) {
  React.useEffect(() => {
    void mixer.load("bed", src)
    const loop = mixer.loop("bed")
    return () => loop.stop()
  }, [mixer, src])
  return null
}

function MuffleDemo() {
  const { mixer, kit } = useStudio()
  const [open, setOpen] = React.useState(false)
  const opener = React.useRef<HTMLButtonElement>(null)
  const close = React.useRef<HTMLButtonElement>(null)
  useMuffleWhile(open, mixer)
  React.useEffect(() => {
    if (open) close.current?.focus()
  }, [open])
  if (!kit) return <Waiting />
  const shut = () => {
    setOpen(false)
    opener.current?.focus()
  }
  return (
    <div className="relative min-h-96 bg-surface-base text-fg-primary">
      <Bed mixer={mixer} src={kit.hall} />
      <Bar mixer={mixer} />
      <div className="flex flex-col gap-4 p-6">
        <p className="type-body text-fg-secondary max-w-prose">With sound on, opening the panel sweeps the bed through a low-pass down to 100 Hz over 400ms, as if behind a door; closing it opens the sound again.</p>
        <button ref={opener} type="button" data-slot="story-action" className={BUTTON} aria-expanded={open} onClick={() => setOpen(true)}>
          Open the panel
        </button>
      </div>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="panel-title"
          data-slot="story-panel"
          className="absolute inset-0 flex flex-col items-start gap-4 bg-surface-raised p-6 shadow-3"
          onKeyDown={(e) => {
            if (e.key === "Escape") shut()
          }}
        >
          <h2 id="panel-title" className="type-display-s">
            Behind the door
          </h2>
          <p className="type-body text-fg-secondary">The page is still there, muffled.</p>
          <button ref={close} type="button" data-slot="story-action" className={BUTTON} onClick={shut}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}

const BANDS = 16

/** An audio-reactive visual: sixteen bars on the one clock, reading the mixer's bands. Still (a calm resting shape)
 * while sound is off or motion is reduced. It is decoration, so it is hidden from assistive tech. */
function Reactive({ mixer }: { mixer: Mixer }) {
  const reduced = useReducedMotion()
  const audible = useMixerAudible(mixer)
  const bars = React.useRef<Array<HTMLSpanElement | null>>([])
  React.useEffect(() => {
    if (!audible || reduced) return
    const read = mixer.bands(BANDS)
    const els = bars.current
    const remove = clock.add(() => {
      const bands = read()
      els.forEach((el, i) => {
        if (el) el.style.transform = `scaleY(${(0.08 + 0.92 * (bands[i] ?? 0)).toFixed(3)})`
      })
    })
    return () => {
      remove()
      els.forEach((el) => {
        if (el) el.style.transform = ""
      })
    }
  }, [mixer, audible, reduced])
  return (
    <div data-slot="story-visual" aria-hidden="true" className="flex h-48 items-end gap-1">
      {Array.from({ length: BANDS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el
          }}
          className="block h-full w-3 origin-bottom rounded-full bg-current"
          style={{ transform: `scaleY(${(0.12 + 0.1 * Math.sin((i / (BANDS - 1)) * Math.PI)).toFixed(3)})` }}
        />
      ))}
    </div>
  )
}

function ReactiveDemo() {
  const { mixer, kit } = useStudio()
  if (!kit) return <Waiting />
  return (
    <div className="bg-surface-base text-fg-primary">
      <Bed mixer={mixer} src={kit.garden} />
      <Bar mixer={mixer} />
      <div className="flex flex-col gap-4 p-6">
        <p className="type-body text-fg-secondary max-w-prose">Sixteen log-spaced bands from the mixer's analyser drive the bars. Off or under reduced motion they rest.</p>
        <Reactive mixer={mixer} />
      </div>
    </div>
  )
}

const meta = {
  title: "Website/Sound",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Sound is a layer, never a block, and off until the person turns it on (WCAG 1.4.2). One mixer per page (`createMixer`, or the shared `getMixer()`) starts one AudioContext on the first gesture after sound is on, with bed, effects and ui buses into a compressor (-6 dB, ratio 12). The master fades over 500ms and is silent at once while the tab is hidden. `SoundScene` fades a section's loop by how much of the view it fills (desktop, loudness 2+, never under reduced motion); `useSoundCue` adds rate-limited cues to controls; `useMuffleWhile` muffles the page behind an overlay; `bands()` drives audio-reactive visuals. The SoundToggle is the one mute and must always be reachable: put it in the nav (feather-page does when `page.sound` is set). Every sound in these stories is generated in the browser.",
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const SectionLoops: Story = { render: () => <SectionLoopsDemo /> }
export const Cues: Story = { render: () => <CuesDemo /> }
export const MuffledOverlay: Story = { render: () => <MuffleDemo /> }
export const AudioReactive: Story = { render: () => <ReactiveDemo /> }
