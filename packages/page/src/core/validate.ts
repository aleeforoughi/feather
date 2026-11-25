// validatePage: a feather.page/0 or /1 document in, the page or every issue out. Deterministic, no dependencies. Reads the
// block table in spec.ts, so a block is described once.
import { ALIGNS, ANCHORS, BLOCK_RANGE, BLOCKS, EDGES, KINETIC_ENTERS, PAGE_KNOBS, PAGE_SCHEMAS, PINNED_PATTERNS, ROUTE_VARIANTS, SCROLL_PATTERNS, SPEAKER_KINDS, blockFields, type FieldSpec, type Fields } from "./spec"
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
  const edges = new Set([...Object.keys(EDGES), "transition", ...Object.keys(PAGE_KNOBS)])
  for (const k of Object.keys(doc)) {
    if (known.has(k)) continue
    if (!edges.has(k)) add(`/${esc(k)}`, "unknown-field", `${k} is not a page field`)
    else if (doc.schema === "feather.page/0") add(`/${esc(k)}`, "needs-schema-1", `${k} is a page edge of feather.page/1; set "schema": "feather.page/1"`)
  }
  for (const [k, { fields }] of Object.entries(EDGES)) if (doc[k] !== undefined) checkFields(`/${k}`, doc[k], fields, {}, add)
  if (doc.transition !== undefined) checkField("/transition", doc.transition, { kind: "enum", values: ROUTE_VARIANTS }, {}, add)
  for (const [k, spec] of Object.entries(PAGE_KNOBS)) if (doc[k] !== undefined) checkField(`/${k}`, doc[k], spec, {}, add)
  const ctx: BlockContext = { v1: doc.schema !== "feather.page/0", pageLoudness: typeof doc.loudness === "number" ? doc.loudness : undefined }

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
    blocks.forEach((b, i) => checkBlock(`${path}/${i}`, b, library, ids, add, ctx))
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

interface BlockContext {
  /** The page is /1: blocks take the knobs. */
  v1: boolean
  /** The page's own loudness, when it sets one. */
  pageLoudness?: number
}

function checkBlock(path: string, b: unknown, library: Record<string, unknown>, ids: Set<string>, add: Add, ctx: BlockContext) {
  if (!isObject(b)) return add(path, "type", "a block is an object with a `block` kind")
  const kind = b.block
  const spec = typeof kind === "string" ? BLOCKS[kind] : undefined
  if (!spec) return add(`${path}/block`, "unknown-block", `"${String(kind)}" is not a block of the library (${Object.keys(BLOCKS).join(", ")})`)
  if (b.id !== undefined) {
    if (typeof b.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.id)) add(`${path}/id`, "type", "a block id is a slug (it is its anchor)")
    else if (ids.has(b.id)) add(`${path}/id`, "duplicate-id", `the id "${b.id}" is used twice`)
    else ids.add(b.id)
  }
  if (!ctx.v1) {
    // A /1 field on a /0 page: name the schema it needs, as the edges do.
    const v1 = blockFields(kind as string, 1)
    const v0 = blockFields(kind as string, 0)
    const later = Object.keys(b).filter((k) => !(k in v0) && k in v1)
    for (const k of later) add(`${path}/${esc(k)}`, "needs-schema-1", `${k} is a knob of feather.page/1; set "schema": "feather.page/1"`)
    const { ...rest } = b
    for (const k of later) delete rest[k]
    return checkFields(path, rest, v0, library, add, ["block", "id"])
  }
  checkFields(path, b, blockFields(kind as string, 1), library, add, ["block", "id"])
  checkKnobs(path, kind as string, b, ctx, add)
}

const has = <T extends string>(list: readonly T[] | undefined, v: unknown): v is T => !!list && (list as readonly unknown[]).includes(v)

/** What the field table cannot say: the values a block supports, and the contradictions between knobs. */
function checkKnobs(path: string, kind: string, b: Record<string, unknown>, ctx: BlockContext, add: Add) {
  const range = BLOCK_RANGE[kind]
  const variant = typeof b.variant === "string" ? b.variant : undefined
  const level = typeof b.loudness === "number" ? b.loudness : ctx.pageLoudness
  const motion = isObject(b.motion) ? b.motion : undefined
  const scroll = isObject(b.scroll) ? b.scroll : undefined
  if (has(ALIGNS, b.align) && !has(range.aligns, b.align)) {
    add(`${path}/align`, "unsupported", `${kind} takes align ${range.aligns.join(", ")}`)
  }
  if (b.crop !== undefined && !range.crop) add(`${path}/crop`, "unsupported", `${kind} has no media to crop`)
  if (b.scale !== undefined && !range.scale) add(`${path}/scale`, "unsupported", `${kind} has no display title to scale`)
  if (variant && has(range.needsMedia, variant) && b.media === undefined) add(`${path}/media`, "missing", `the ${variant} ${kind} is built on its media`)
  // statement: swap cycles its words, and words are only for swap.
  if (kind === "statement") {
    if (variant === "swap" && b.words === undefined) add(`${path}/words`, "missing", "the swap statement needs the words it cycles")
    if (variant !== "swap" && b.words !== undefined) add(`${path}/words`, "contradiction", "words are the swap statement's; set variant: swap")
  }
  if (kind === "quote" && b.items !== undefined && variant !== "rail") add(`${path}/items`, "contradiction", "more quotes are the rail's; set variant: rail")

  if (motion) {
    const enter = motion.enter
    if (level === 0 && typeof enter === "string" && enter !== "none") add(`${path}/motion/enter`, "contradiction", `loudness 0 is quiet: no entrance but none (this block enters with ${enter})`)
    else if (level !== undefined && level < 2 && has(KINETIC_ENTERS, enter)) add(`${path}/motion/enter`, "contradiction", `${enter} is kinetic type, which needs loudness 2 (the block is at ${level})`)
    const dir = motion.direction
    if ((dir === "left" || dir === "right") && !has(range.sideways, variant)) add(`${path}/motion/direction`, "unsupported", `${dir} is for a marquee (${kind}${range.sideways ? ` variant ${range.sideways.join(", ")}` : " has none"}); a reveal travels up or down`)
  }

  const implied = variant ? range.implies?.[variant] : undefined
  if (scroll) {
    if (level === 0) add(`${path}/scroll`, "contradiction", "loudness 0 is quiet: native scroll, no scroll move")
    const pattern = scroll.pattern
    if (has(SCROLL_PATTERNS, pattern) && !has(range.scroll, pattern)) {
      add(`${path}/scroll/pattern`, "unsupported", `${kind} supports the scroll patterns ${range.scroll.join(", ")}`)
    } else if (typeof pattern === "string" && implied && pattern !== implied && pattern !== "reveal") {
      add(`${path}/scroll/pattern`, "contradiction", `the ${variant} ${kind} is a ${implied}; a ${pattern} cannot sit inside it`)
    }
    if (level !== undefined && level > 0 && level < 2 && typeof pattern === "string" && pattern !== "reveal") add(`${path}/scroll/pattern`, "contradiction", `${pattern} is scroll choreography, which needs loudness 2 (the block is at ${level})`)
    if (pattern !== undefined && !has(SCROLL_PATTERNS, pattern)) return
    const effective = typeof pattern === "string" ? pattern : implied
    if (scroll.length !== undefined && !has(PINNED_PATTERNS, effective)) add(`${path}/scroll/length`, "contradiction", `length is for a pinned pattern (${PINNED_PATTERNS.join(", ")}); this block ${effective ? `is a ${effective}` : "does not pin"}`)
    if (scroll.snap !== undefined && effective !== "pin") add(`${path}/scroll/snap`, "contradiction", "snap settles on a pin's steps; this block does not pin")
  }
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
      if (typeof v !== "number" || !Number.isFinite(v)) return add(path, "type", "expected a number")
      if ((spec.integer && !Number.isInteger(v)) || (spec.min !== undefined && v < spec.min) || (spec.max !== undefined && v > spec.max)) {
        add(path, "out-of-range", `expected ${spec.integer ? "a whole number" : "a number"}${spec.min !== undefined && spec.max !== undefined ? ` from ${spec.min} to ${spec.max}` : spec.min !== undefined ? ` of at least ${spec.min}` : spec.max !== undefined ? ` of at most ${spec.max}` : ""}`)
      }
      return
    case "boolean":
      if (typeof v !== "boolean") add(path, "type", "expected true or false")
      return
    case "enum":
      if (typeof v !== "string" || !spec.values.includes(v)) add(path, spec.code && typeof v === "string" ? spec.code : "type", `expected one of ${spec.values.join(", ")}`)
      return
    case "object":
      return checkFields(path, v, spec.of, library, add)
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
