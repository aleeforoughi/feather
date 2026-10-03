// The context a host would pass: persona, capability and device, as controls. "Not set" leaves a field out, as a host
// that knows nothing about it would.
import * as React from "react"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { Checkbox, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aleeforoughi/feather-react"

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

/** A labelled choice, in Feather's own Select: the trigger is the control frame inputs and buttons use, and the list
 * follows the radius hierarchy and the item height. An empty value is "not set". */
export function Choice({ label, value, items, onChange, className }: { label: string; value: string; items: { value: string; label: string }[]; onChange: (value: string) => void; className?: string }) {
  const id = React.useId()
  const UNSET = "__unset__"
  const list = items.map((i) => ({ ...i, value: i.value === "" ? UNSET : i.value }))
  return (
    <div className={className ? `flex flex-col gap-label ${className}` : "flex flex-col gap-label"}>
      <Label htmlFor={id}>{label}</Label>
      <Select items={list} value={value === "" ? UNSET : value} onValueChange={(v) => onChange(v === UNSET || v == null ? "" : String(v))}>
        <SelectTrigger id={id} data-slot="playground-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {list.map((i) => (
            <SelectItem key={i.value} value={i.value} data-value={i.value === UNSET ? "" : i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <Choice label={label} value={value} items={[{ value: "", label: "not set" }, ...options.map((o) => ({ value: o, label: o }))]} onChange={onChange} />
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
    <fieldset data-slot="playground-group" className="grid grid-cols-2 gap-field rounded-card border border-line-secondary inset-content">
      <legend className="px-1 type-label">{title}</legend>
      {children}
    </fieldset>
  )
}

export function ContextControls({ value, onChange }: { value: Controls; onChange: (next: Controls) => void }) {
  const set = <K extends keyof Controls>(key: K) => (v: Controls[K]) => onChange({ ...value, [key]: v })
  return (
    <div data-slot="playground-controls" className="flex flex-col gap-field">
      <Group title="Persona">
        <Pick label="Density" value={value.density} options={["compact", "comfortable", "spacious"]} onChange={set("density")} />
        <Pick label="Explanation" value={value.explanation} options={["brief", "standard", "detailed"]} onChange={set("explanation")} />
        <Pick label="Motion" value={value.motion} options={["full", "reduced"]} onChange={set("motion")} />
        <Pick label="Input mode" value={value.inputMode} options={["pointer", "touch", "keyboard", "voice", "switch"]} onChange={set("inputMode")} />
        <div className="col-span-2"><Toggle label="These were learned, not set by the person" checked={value.learned} onChange={set("learned")} /></div>
      </Group>
      <Group title="Capability">
        <Pick label="Precision" value={value.precision} options={["typical", "low"]} onChange={set("precision")} />
        <Pick label="Vision" value={value.vision} options={["typical", "low"]} onChange={set("vision")} />
        <Pick label="Visual output" value={value.visual} options={["available", "unavailable"]} onChange={set("visual")} />
        <Pick label="Audio output" value={value.audio} options={["available", "unavailable"]} onChange={set("audio")} />
        <div className="col-span-2"><Toggle label="Switch input" checked={value.switchInput} onChange={set("switchInput")} /></div>
      </Group>
      <Group title="Device">
        <Pick label="Surface" value={value.surface} options={["phone", "tablet", "desktop", "watch", "speaker", "terminal"]} onChange={set("surface")} />
        <div className="flex items-end"><Toggle label="Reduced motion (OS)" checked={value.reducedMotion} onChange={set("reducedMotion")} /></div>
      </Group>
    </div>
  )
}
