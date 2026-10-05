// The context as the composer may trust it. A host's context arrives from anywhere (a settings store, a URL, another
// process), so every field is checked against its type here: a value outside it is dropped, never guessed at, and
// the trace says so. Unknown fields are ignored. Reading never throws; a field that cannot be read counts as absent.
import type { RenderContext } from "@aleeforoughi/feather-context"
import type { TraceEntry } from "./plan.ts"

const DENSITY = ["compact", "comfortable", "spacious"] as const
const LEARNABLE = ["density", "explanation", "motion", "inputMode", "autonomy"] as const
const INPUTS = ["pointer", "touch", "keyboard", "voice", "switch"] as const
const AVAILABILITY = ["available", "unavailable"] as const
const LOCALE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/

type Raw = Record<string, unknown>

/** Returns only the fields of `raw` that have the context's types; each one dropped is traced under rule "defaults". */
export function normalizeContext(raw: unknown, trace: TraceEntry[]): RenderContext {
  const drop = (path: string, value: unknown, expected: string) =>
    trace.push({ rule: "defaults", level: "default", subject: `context.${path}`, value: null, because: `ignored ${show(value)}: expected ${expected}` })
  const out: RenderContext = {}
  if (raw === undefined || raw === null) return out
  if (!isObject(raw)) {
    drop("", raw, "an object")
    return out
  }

  const part = (key: string): Raw | undefined => {
    const value = read(raw, key)
    if (value === undefined) return undefined
    if (isObject(value)) return value
    drop(key, value, "an object")
    return undefined
  }
  const pick = <T extends string>(from: Raw, path: string, key: string, values: readonly T[]): T | undefined => {
    const value = read(from, key)
    if (value === undefined) return undefined
    if (typeof value === "string" && (values as readonly string[]).includes(value)) return value as T
    drop(`${path}.${key}`, value, `one of ${values.join(", ")}`)
    return undefined
  }
  const flag = (from: Raw, path: string, key: string): boolean | undefined => {
    const value = read(from, key)
    if (value === undefined || typeof value === "boolean") return value
    drop(`${path}.${key}`, value, "true or false")
    return undefined
  }
  const assign = <O extends object>(target: O, key: keyof O, value: unknown) => {
    if (value !== undefined) (target as Record<keyof O, unknown>)[key] = value
  }

  const persona = part("persona")
  if (persona) {
    const p: NonNullable<RenderContext["persona"]> = {}
    assign(p, "density", pick(persona, "persona", "density", DENSITY))
    assign(p, "explanation", pick(persona, "persona", "explanation", ["brief", "standard", "detailed"]))
    assign(p, "motion", pick(persona, "persona", "motion", ["full", "reduced"]))
    assign(p, "inputMode", pick(persona, "persona", "inputMode", INPUTS))
    assign(p, "autonomy", pick(persona, "persona", "autonomy", ["ask", "suggest", "delegate"]))
    const learned = read(persona, "learned")
    if (learned !== undefined) {
      if (Array.isArray(learned)) {
        const known = learned.filter((f): f is (typeof LEARNABLE)[number] => (LEARNABLE as readonly unknown[]).includes(f))
        if (known.length !== learned.length) drop("persona.learned", learned.filter((f) => !known.includes(f)), `field names among ${LEARNABLE.join(", ")}`)
        if (known.length) p.learned = [...new Set(known)]
      } else drop("persona.learned", learned, "a list of field names")
    }
    out.persona = p
  }

  const capability = part("capability")
  if (capability) {
    const c: NonNullable<RenderContext["capability"]> = {}
    const input = read(capability, "input")
    if (isObject(input)) {
      const i: NonNullable<typeof c.input> = {}
      for (const key of INPUTS) assign(i, key, flag(input, "capability.input", key))
      c.input = i
    } else if (input !== undefined) drop("capability.input", input, "an object")
    const output = read(capability, "output")
    if (isObject(output)) {
      const o: NonNullable<typeof c.output> = {}
      assign(o, "visual", pick(output, "capability.output", "visual", AVAILABILITY))
      assign(o, "audio", pick(output, "capability.output", "audio", AVAILABILITY))
      c.output = o
    } else if (output !== undefined) drop("capability.output", output, "an object")
    assign(c, "vision", pick(capability, "capability", "vision", ["typical", "low"]))
    assign(c, "precision", pick(capability, "capability", "precision", ["typical", "low"]))
    assign(c, "reading", pick(capability, "capability", "reading", ["typical", "plain"]))
    const temporary = read(capability, "temporary")
    if (isObject(temporary)) {
      const t: NonNullable<typeof c.temporary> = {}
      for (const key of ["eyesBusy", "handsBusy", "noisy"] as const) assign(t, key, flag(temporary, "capability.temporary", key))
      c.temporary = t
    } else if (temporary !== undefined) drop("capability.temporary", temporary, "an object")
    out.capability = c
  }

  const device = part("device")
  if (device) {
    const d: NonNullable<RenderContext["device"]> = {}
    assign(d, "surface", pick(device, "device", "surface", ["phone", "tablet", "desktop", "watch", "speaker", "terminal"]))
    const width = read(device, "width")
    if (typeof width === "number" && Number.isFinite(width) && width >= 0) d.width = width
    else if (width !== undefined) drop("device.width", width, "a width in CSS pixels")
    assign(d, "reducedMotion", flag(device, "device", "reducedMotion"))
    assign(d, "colorScheme", pick(device, "device", "colorScheme", ["light", "dark"]))
    out.device = d
  }

  const brand = part("brand")
  if (brand) {
    const b: NonNullable<RenderContext["brand"]> = {}
    assign(b, "density", pick(brand, "brand", "density", DENSITY))
    assign(b, "motion", pick(brand, "brand", "motion", ["calm", "snappy"]))
    out.brand = b
  }

  const locale = read(raw, "locale")
  if (typeof locale === "string" && LOCALE.test(locale)) out.locale = locale
  else if (locale !== undefined) drop("locale", locale, "a BCP 47 language tag")

  return out
}

function isObject(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function read(from: Raw, key: string): unknown {
  try {
    return Object.prototype.hasOwnProperty.call(from, key) ? from[key] : undefined
  } catch {
    return undefined
  }
}

function show(value: unknown): string {
  try {
    const text = typeof value === "bigint" ? `${value}n` : JSON.stringify(value)
    if (text === undefined) return typeof value
    return text.length > 40 ? `${text.slice(0, 39)}…` : text
  } catch {
    return typeof value
  }
}
