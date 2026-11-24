// The capability gate: heavy effects (a WebGL scene, a shader background) run only where they will run well, and
// everyone else gets the complete page without them, never a broken or slow one. The verdict comes from the device
// (desktop pointer, cores, memory, WebGL), the person (reduced motion, data saving), and memory: a device that once
// proved too slow (`retire`) stays on the light tier for 30 days. Values from the 2026 winners' code (Qooler file 27
// section 7): more than 4 cores, more than 4 GB, no coarse pointer, no data saver, WebGL2.
import { deviceHints, type DeviceHints } from "./world"

export type GateReason = "reduced-motion" | "save-data" | "no-webgl" | "coarse-pointer" | "cores" | "memory" | "retired"

export interface GateVerdict {
  /** True: run the heavy tier. False: render the light tier (the poster, the DOM page). */
  full: boolean
  reasons: GateReason[]
}

export interface GateOptions {
  /** Names the effect, so each one keeps its own remembered verdict (default "world"). */
  key?: string
  /** Fewer or equal cores than this is the light tier (default 4). */
  minCores?: number
  /** Less or equal GB of memory than this is the light tier (default 4). */
  minMemory?: number
  /** A coarse pointer (a phone or tablet) is the light tier unless this is true (default false). */
  allowTouch?: boolean
  /** Days a retired verdict is remembered (default 30). */
  rememberDays?: number
  /** Hints to judge instead of this browser's (tests, or a host that already measured). */
  hints?: DeviceHints
  /** Where verdicts are remembered (default localStorage when it is there). */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null
  /** The time now, in ms (tests). */
  now?: number
}

const storageOf = (opts: GateOptions) => {
  if (opts.storage !== undefined) return opts.storage
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}
const slot = (key: string) => `feather-gate:${key}`

/** Whether the heavy tier should run here. Unknown hints count as capable: only evidence turns an effect off. */
export function capabilityGate(opts: GateOptions = {}): GateVerdict {
  const { key = "world", minCores = 4, minMemory = 4, allowTouch = false } = opts
  const h = opts.hints ?? deviceHints()
  const reasons: GateReason[] = []
  if (h.reducedMotion) reasons.push("reduced-motion")
  if (h.saveData) reasons.push("save-data")
  if (h.webgl === false) reasons.push("no-webgl")
  if (h.coarsePointer && !allowTouch) reasons.push("coarse-pointer")
  if (h.cores !== undefined && h.cores <= minCores) reasons.push("cores")
  if (h.memory !== undefined && h.memory <= minMemory) reasons.push("memory")
  try {
    const raw = storageOf(opts)?.getItem(slot(key))
    if (raw) {
      const until = Number(JSON.parse(raw).until)
      if (Number.isFinite(until) && until > (opts.now ?? Date.now())) reasons.push("retired")
      else storageOf(opts)?.removeItem(slot(key))
    }
  } catch {
    // A broken record is ignored.
  }
  return { full: reasons.length === 0, reasons }
}

/** Remembers that this device could not run the effect well (a quality ladder at its last level, a failed context),
 * so it starts on the light tier for `rememberDays`. */
export function retire(opts: Pick<GateOptions, "key" | "rememberDays" | "storage" | "now"> = {}): void {
  const { key = "world", rememberDays = 30 } = opts
  try {
    storageOf(opts)?.setItem(slot(key), JSON.stringify({ until: (opts.now ?? Date.now()) + rememberDays * 86_400_000 }))
  } catch {
    // Storage may be full or blocked: the effect simply asks again next visit.
  }
}
