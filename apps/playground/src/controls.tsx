// The context a host would pass: persona, capability and device, as controls. "Not set" leaves a field out, as a host
// that knows nothing about it would.
import * as React from "react"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { Checkbox, Label } from "@aleeforoughi/feather-react"

export interface Controls {
  density: string
  explanation: string
  motion: string
  inputMode: string
  learned: boolean
  precision: string
  vision: string
  visual: string
  audio: string
  switchInput: boolean
  surface: string
  reducedMotion: boolean
}

export const DEFAULT_CONTROLS: Controls = {
  density: "",
  explanation: "",
  motion: "",
  inputMode: "",
  learned: false,
  precision: "",
  vision: "",
  visual: "",
  audio: "",
  switchInput: false,
  surface: "phone",
  reducedMotion: false,
}

/** The controls as a RenderContext: only what is set. */
export function toContext(c: Controls): RenderContext {
  const persona: Record<string, unknown> = {}
  if (c.density) persona.density = c.density
  if (c.explanation) persona.explanation = c.explanation
  if (c.motion) persona.motion = c.motion
  if (c.inputMode) persona.inputMode = c.inputMode
  if (c.learned) persona.learned = (["density", "explanation", "motion", "inputMode"] as const).filter((f) => c[f])
  const capability: Record<string, unknown> = {}
  if (c.precision) capability.precision = c.precision
  if (c.vision) capability.vision = c.vision
  if (c.visual || c.audio) capability.output = { ...(c.visual ? { visual: c.visual } : {}), ...(c.audio ? { audio: c.audio } : {}) }
  if (c.switchInput) capability.input = { switch: true }
  const device: Record<string, unknown> = {}
  if (c.surface) device.surface = c.surface
  if (c.reducedMotion) device.reducedMotion = true
  return {
    ...(Object.keys(persona).length ? { persona } : {}),
    ...(Object.keys(capability).length ? { capability } : {}),
    ...(Object.keys(device).length ? { device } : {}),
  } as RenderContext
}

const SELECT =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const id = React.useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} data-slot="playground-select" className={SELECT} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">not set</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset data-slot="playground-group" className="grid grid-cols-2 gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      {children}
    </fieldset>
  )
}

export function ContextControls({ value, onChange }: { value: Controls; onChange: (next: Controls) => void }) {
  const set = <K extends keyof Controls>(key: K) => (v: Controls[K]) => onChange({ ...value, [key]: v })
  return (
    <div data-slot="playground-controls" className="flex flex-col gap-3">
      <Group title="Persona">
        <Select label="Density" value={value.density} options={["compact", "comfortable", "spacious"]} onChange={set("density")} />
        <Select label="Explanation" value={value.explanation} options={["brief", "standard", "detailed"]} onChange={set("explanation")} />
        <Select label="Motion" value={value.motion} options={["full", "reduced"]} onChange={set("motion")} />
        <Select label="Input mode" value={value.inputMode} options={["pointer", "touch", "keyboard", "voice", "switch"]} onChange={set("inputMode")} />
        <div className="col-span-2"><Toggle label="These were learned, not set by the person" checked={value.learned} onChange={set("learned")} /></div>
      </Group>
      <Group title="Capability">
        <Select label="Precision" value={value.precision} options={["typical", "low"]} onChange={set("precision")} />
        <Select label="Vision" value={value.vision} options={["typical", "low"]} onChange={set("vision")} />
        <Select label="Visual output" value={value.visual} options={["available", "unavailable"]} onChange={set("visual")} />
        <Select label="Audio output" value={value.audio} options={["available", "unavailable"]} onChange={set("audio")} />
        <div className="col-span-2"><Toggle label="Switch input" checked={value.switchInput} onChange={set("switchInput")} /></div>
      </Group>
      <Group title="Device">
        <Select label="Surface" value={value.surface} options={["phone", "tablet", "desktop", "watch", "speaker", "terminal"]} onChange={set("surface")} />
        <div className="flex items-end"><Toggle label="Reduced motion (OS)" checked={value.reducedMotion} onChange={set("reducedMotion")} /></div>
      </Group>
    </div>
  )
}
