// validatePage: a feather.page/0 or /1 document in, the page or every issue out. Deterministic, no dependencies. Reads the
// block table in spec.ts, so a block is described once.
import { ANCHORS, BLOCKS, EDGES, PAGE_SCHEMAS, ROUTE_VARIANTS, SPEAKER_KINDS, type FieldSpec, type Fields } from "./spec"
import type { PageDocument, PageIssue, PageResult } from "./types"

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v)
const esc = (k: string | number) => String(k).replace(/~/g, "~0").replace(/\//g, "~1")

/** A link a page may carry: http(s), mailto, tel, a relative or root path, or an in-page anchor. Never javascript:. */
export function isSafeHref(v: string): boolean {
  if (/^\s*(javascript|data|vbscript):/i.test(v)) return false
  return /^(https?:\/\/|mailto:|tel:|#|\/(?!\/)|\.{1,2}\/|[A-Za-z0-9_-])/.test(v)
}
/** A media source: a relative or root path, or an https URL (never a script or data URL in the document). */
export function isSafeMedia(v: string): boolean {
  return !/^\s*(javascript|vbscript):/i.test(v) && /^(https:\/\/|\/(?!\/)|\.{1,2}\/|[A-Za-z0-9_-])/.test(v)
}

export function validatePage(input: unknown): PageResult {
  const issues: PageIssue[] = []
  const add = (path: string, code: PageIssue["code"], message: string) => issues.push({ path, code, message })
  if (!isObject(input)) return { ok: false, issues: [{ path: "", code: "not-object", message: "a page is a JSON object" }] }
  const doc = input
  if (!(PAGE_SCHEMAS as readonly unknown[]).includes(doc.schema)) add("/schema", "wrong-schema", `schema must be one of ${PAGE_SCHEMAS.map((s) => `"${s}"`).join(", ")}`)
  if (typeof doc.brand !== "string" && !isObject(doc.brand)) add("/brand", "missing", "brand is a path to the brand's tokens, or the tokens inline")
  for (const k of ["title", "description", "lang"]) if (doc[k] !== undefined && typeof doc[k] !== "string") add(`/${k}`, "type", `${k} must be text`)
  const known = new Set(["schema", "brand", "title", "description", "lang", "speaker", "library", "sections", "scenes", "living"])
  const edges = new Set([...Object.keys(EDGES), "transition"])
  for (const k of Object.keys(doc)) {
    if (known.has(k)) continue
    if (!edges.has(k)) add(`/${esc(k)}`, "unknown-field", `${k} is not a page field`)
    else if (doc.schema === "feather.page/0") add(`/${esc(k)}`, "needs-schema-1", `${k} is a page edge of feather.page/1; set "schema": "feather.page/1"`)
  }
  for (const [k, { fields }] of Object.entries(EDGES)) if (doc[k] !== undefined) checkFields(`/${k}`, doc[k], fields, {}, add)
  if (doc.transition !== undefined) checkField("/transition", doc.transition, { kind: "enum", values: ROUTE_VARIANTS }, {}, add)

  if (doc.speaker !== undefined) {
    const s = doc.speaker
    if (!isObject(s)) add("/speaker", "type", "speaker is { kind, name, voice? }")
    else {
      if (!(SPEAKER_KINDS as readonly unknown[]).includes(s.kind)) add("/speaker/kind", "type", `speaker.kind must be one of ${SPEAKER_KINDS.join(", ")}`)
      if (typeof s.name !== "string" || !s.name.trim()) add("/speaker/name", "missing", "speaker.name is required")
      if (s.voice !== undefined && typeof s.voice !== "string") add("/speaker/voice", "type", "speaker.voice is a path to the voice card")
    }
  }

  const library = isObject(doc.library) ? doc.library : {}
  if (doc.library !== undefined && !isObject(doc.library)) add("/library", "type", "library is an object of collections")
  const work = isObject(library.work) ? library.work : {}
  for (const [id, item] of Object.entries(work)) checkFields(`/library/work/${esc(id)}`, item, withoutId(BLOCKS.work.fields.items), library, add)

  const ids = new Set<string>()
  const checkBlocks = (path: string, blocks: unknown, min: number, max: number) => {
    if (!Array.isArray(blocks)) return add(path, "missing", `${path.split("/").pop()} is a list of blocks`)
    if (blocks.length < min) add(path, "too-few", `at least ${min} block${min === 1 ? "" : "s"}`)
    if (blocks.length > max) add(path, "too-many", `at most ${max} blocks`)
    blocks.forEach((b, i) => checkBlock(`${path}/${i}`, b, library, ids, add))
  }
  checkBlocks("/sections", doc.sections, 1, 40)

  const scenes = isObject(doc.scenes) ? doc.scenes : {}
  if (doc.scenes !== undefined && !isObject(doc.scenes)) add("/scenes", "type", "scenes is an object keyed by intent")
  for (const [intent, scene] of Object.entries(scenes)) {
    const at = `/scenes/${esc(intent)}`
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(intent)) add(at, "type", `the intent "${intent}" must be a route slug (a-z, 0-9, hyphens)`)
    if (!isObject(scene)) {
      add(at, "type", "a scene is { ask, line, blocks, asks? }")
      continue
    }
    for (const k of ["ask", "line"]) if (typeof scene[k] !== "string" || !(scene[k] as string).trim()) add(`${at}/${k}`, "missing", `a scene needs its ${k}`)
    checkBlocks(`${at}/blocks`, scene.blocks, 1, 3)
    if (scene.asks !== undefined) checkField(`${at}/asks`, scene.asks, { kind: "texts", max: 3 }, library, add)
  }

  if (doc.living !== undefined) {
    const l = doc.living
    if (!isObject(l)) add("/living", "type", "living is { anchor, fold, prepared, disclosure }")
    else {
      if (l.anchor !== undefined && !(ANCHORS as readonly unknown[]).includes(l.anchor)) add("/living/anchor", "type", `living.anchor must be one of ${ANCHORS.join(", ")}`)
      if (l.fold !== undefined && typeof l.fold !== "boolean") add("/living/fold", "type", "living.fold is true or false")
      if (l.disclosure !== undefined && (typeof l.disclosure !== "string" || !/\b(AI|agent|automated)\b/i.test(l.disclosure))) add("/living/disclosure", "type", "living.disclosure must say it is an AI agent")
      if (l.prepared !== undefined) {
        if (!Array.isArray(l.prepared)) add("/living/prepared", "type", "living.prepared lists scene intents")
        else l.prepared.forEach((p, i) => typeof p !== "string" || !(p in scenes) ? add(`/living/prepared/${i}`, "unknown-scene", `"${String(p)}" is not a scene in scenes`) : undefined)
      }
      // The honesty floor: a page that talks says who is talking.
      if (!isObject(doc.speaker)) add("/speaker", "no-speaker", "a page with a living layer names its speaker (who says I or we)")
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, page: doc as unknown as PageDocument }
}

type Add = (path: string, code: PageIssue["code"], message: string) => void

const withoutId = (spec: FieldSpec): Fields => {
  const of = (spec as { of: Fields }).of
  const { id: _id, ...rest } = of
  void _id
  return rest
}

function checkBlock(path: string, b: unknown, library: Record<string, unknown>, ids: Set<string>, add: Add) {
  if (!isObject(b)) return add(path, "type", "a block is an object with a `block` kind")
  const kind = b.block
  const spec = typeof kind === "string" ? BLOCKS[kind] : undefined
  if (!spec) return add(`${path}/block`, "unknown-block", `"${String(kind)}" is not a block of the library (${Object.keys(BLOCKS).join(", ")})`)
  if (b.id !== undefined) {
    if (typeof b.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.id)) add(`${path}/id`, "type", "a block id is a slug (it is its anchor)")
    else if (ids.has(b.id)) add(`${path}/id`, "duplicate-id", `the id "${b.id}" is used twice`)
    else ids.add(b.id)
  }
  const fields: Fields = { title: { kind: "text", max: 160 }, ...spec.fields }
  checkFields(path, b, fields, library, add, ["block", "id"])
}

function checkFields(path: string, value: unknown, fields: Fields, library: Record<string, unknown>, add: Add, extra: string[] = []) {
  if (!isObject(value)) return add(path, "type", "expected an object")
  for (const k of Object.keys(value)) if (!(k in fields) && !extra.includes(k)) add(`${path}/${esc(k)}`, "unknown-field", `${k} is not a field here (${Object.keys(fields).join(", ")})`)
  for (const [k, spec] of Object.entries(fields)) {
    const v = value[k]
    if (v === undefined) {
      if (spec.required) add(`${path}/${esc(k)}`, "missing", `${k} is required`)
      continue
    }
    checkField(`${path}/${esc(k)}`, v, spec, library, add)
  }
}

function checkField(path: string, v: unknown, spec: FieldSpec, library: Record<string, unknown>, add: Add) {
  switch (spec.kind) {
    case "text":
      if (typeof v !== "string") return add(path, "type", "expected text")
      if (spec.max && [...v].length > spec.max) add(path, "too-long", `at most ${spec.max} characters`)
      return
    case "number":
      if (typeof v !== "number" || !Number.isFinite(v)) add(path, "type", "expected a number")
      return
    case "boolean":
      if (typeof v !== "boolean") add(path, "type", "expected true or false")
      return
    case "enum":
      if (typeof v !== "string" || !spec.values.includes(v)) add(path, "type", `expected one of ${spec.values.join(", ")}`)
      return
    case "href":
      if (typeof v !== "string" || !isSafeHref(v)) add(path, "bad-href", "a link is http(s), mailto:, tel:, a path or an anchor")
      return
    case "media": {
      const src = typeof v === "string" ? v : isObject(v) ? v.src : undefined
      if (typeof src !== "string" || !isSafeMedia(src)) return add(path, "bad-media", "media is a path or an https URL, or { src, alt, poster, sources }")
      if (isObject(v) && v.alt === undefined && v.decorative !== true) add(`${path}/alt`, "missing", "media needs alt text, or decorative: true")
      return
    }
    case "texts":
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return add(path, "type", "expected a list of text")
      if (spec.min !== undefined && v.length < spec.min) add(path, "too-few", `at least ${spec.min}`)
      if (spec.max !== undefined && v.length > spec.max) add(path, "too-many", `at most ${spec.max}`)
      return
    case "list":
    case "refs": {
      if (!Array.isArray(v)) return add(path, "type", "expected a list")
      if (spec.min !== undefined && v.length < spec.min) add(path, "too-few", `at least ${spec.min}`)
      if (spec.max !== undefined && v.length > spec.max) add(path, "too-many", `at most ${spec.max}`)
      v.forEach((item, i) => {
        if (spec.kind === "refs" && typeof item === "string") {
          const coll = library[spec.library]
          if (!isObject(coll) || !(item in coll)) add(`${path}/${i}`, "unknown-ref", `"${item}" is not in library.${spec.library}`)
        } else checkFields(`${path}/${i}`, item, spec.of, library, add)
      })
      return
    }
  }
}

/** Resolves library references: every `work` item as a full object. Call on a validated page. */
export function resolveRefs(page: PageDocument): PageDocument {
  const work = page.library?.work ?? {}
  const resolve = (b: PageDocument["sections"][number]) => (b.block === "work" ? { ...b, items: b.items.map((it) => (typeof it === "string" ? { id: it, ...work[it] } : it)) } : b)
  return {
    ...page,
    sections: page.sections.map(resolve),
    ...(page.scenes ? { scenes: Object.fromEntries(Object.entries(page.scenes).map(([k, s]) => [k, { ...s, blocks: s.blocks.map(resolve) }])) } : {}),
  }
}
