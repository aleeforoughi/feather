// The only exemption Gate 2 has: packages/react/optical-exceptions.json, when it exists.
// An entry exempts exactly the element and property it names, so it must carry `property` and at least one of
// `slot` (the element's data-slot) or `selector` (a substring of the failure's selector). `story` and `theme`
// narrow it further. Entries that name neither an element nor a property exempt nothing and are counted in the report.
import fs from "node:fs"
import path from "node:path"
import { REPO } from "./expected"
import type { Row } from "./run"

export interface ExceptionEntry {
  story?: string
  theme?: string
  slot?: string
  selector?: string
  property?: string
}

export const EXCEPTIONS_PATH = path.join(REPO, "packages/react/optical-exceptions.json")

export function loadExceptions(): { entries: ExceptionEntry[]; ignored: number } {
  if (!fs.existsSync(EXCEPTIONS_PATH)) return { entries: [], ignored: 0 }
  const json = JSON.parse(fs.readFileSync(EXCEPTIONS_PATH, "utf8")) as unknown
  const list = Array.isArray(json) ? json : ((json as Record<string, unknown>)?.exceptions ?? (json as Record<string, unknown>)?.entries ?? [])
  const all = (Array.isArray(list) ? list : []) as ExceptionEntry[]
  const entries = all.filter((e) => e && typeof e === "object" && e.property && (e.slot || e.selector))
  return { entries, ignored: all.length - entries.length }
}

const matches = (e: ExceptionEntry, r: Row, property: string) =>
  e.property === property &&
  (!e.story || e.story === r.story) &&
  (!e.theme || e.theme === r.theme) &&
  (!e.slot || e.slot === r.slot) &&
  (!e.selector || r.selector.includes(e.selector))

/** Removes exempted rows (or exempted properties of a row). Returns what is left and how many rows were exempted. */
export function applyExceptions(rows: Row[], entries: ExceptionEntry[]): { rows: Row[]; exempted: number } {
  if (!entries.length) return { rows, exempted: 0 }
  const out: Row[] = []
  let exempted = 0
  for (const r of rows) {
    const props = r.properties ?? [r.property]
    const left = props.filter((p) => !entries.some((e) => matches(e, r, p)))
    if (left.length === 0) exempted++
    else out.push(left.length === props.length ? r : { ...r, properties: left, property: left[0] })
  }
  return { rows: out, exempted }
}
