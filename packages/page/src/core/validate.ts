// validatePage: a feather.page/0 or /1 document in, the page or every issue out. Deterministic, no dependencies. Reads the
// block table in spec.ts, so a block is described once.
import { ALIGNS, ANCHORS, BLOCK_RANGE, BLOCKS, EDGES, KINETIC_ENTERS, MOVING_TREATMENTS, OPTION_FIELDS, PAGE_BLOCKS, PAGE_KNOBS, PAGE_SCHEMAS, PINNED_PATTERNS, ROUTE_VARIANTS, SCENE_KINDS, SCENE_PRESETS, SCROLL_PATTERNS, SPEAKER_KINDS, blockFields, type FieldSpec, type Fields } from "./spec"
import type { PageDocument, PageIssue, PageResult } from "./types"
import { checkFlowBlock, checkScheme, checkViews } from "./validate-flows"

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

/** Whether media may carry a srcset: the document is /1 (set at the start of each validatePage, which is synchronous). */
let widthsAllowed = true

/** The most renditions a srcset lists, and the widest a w descriptor may be (px). */
export const SRCSET_MAX = 8
export const SRCSET_MAX_WIDTH = 10000

/** An image's widths (`srcset`): a list of 1 to 8 { src, w }, or the same as a srcset string of w descriptors. Each URL
 * is checked as a media src; each width is a whole number of px, given once. A malformed entry is `bad-srcset`. */
function checkSrcset(path: string, v: unknown, add: Add) {
  if (!widthsAllowed) return add(path, "needs-schema-1", 'srcset is a field of feather.page/1; set "schema": "feather.page/1"')
  const seen = new Set<number>()
  const width = (at: string, w: unknown) => {
    if (typeof w !== "number" || !Number.isInteger(w) || w < 1 || w > SRCSET_MAX_WIDTH) return add(at, "bad-srcset", `a width is a whole number of px, 1 to ${SRCSET_MAX_WIDTH}`)
    if (seen.has(w)) add(at, "bad-srcset", `the width ${w} is listed twice`)
    seen.add(w)
  }
  const count = (n: number) => {
    if (n < 1) add(path, "too-few", "at least 1")
    if (n > SRCSET_MAX) add(path, "too-many", `at most ${SRCSET_MAX}`)
  }
  if (Array.isArray(v)) {
    count(v.length)
    v.forEach((c, i) => {
      if (!isObject(c)) return add(`${path}/${i}`, "bad-srcset", "a rendition is { src, w }")
      for (const k of Object.keys(c)) if (k !== "src" && k !== "w") add(`${path}/${i}/${esc(k)}`, "bad-srcset", "a rendition is { src, w }")
      if (typeof c.src !== "string" || !isSafeMedia(c.src) || /[\s,]/.test(c.src)) add(`${path}/${i}/src`, "bad-srcset", "a rendition's src is a path or an https URL, with no spaces or commas")
      width(`${path}/${i}/w`, c.w)
    })
    return
  }
  if (typeof v !== "string") return add(path, "type", "srcset is a list of { src, w }, or a srcset string (\"a-800.jpg 800w, a-1600.jpg 1600w\")")
  const candidates = v.split(",").map((c) => c.trim())
  count(candidates.filter(Boolean).length)
  for (const c of candidates) {
    const m = /^(\S+)\s+([1-9]\d*)w$/.exec(c)
    if (!m || !isSafeMedia(m[1])) {
      add(path, "bad-srcset", `"${c}" is not a candidate: a path or an https URL, a space, and its width ("a-800.jpg 800w")`)
      continue
    }
    width(path, Number(m[2]))
  }
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
  if (doc.schema !== "feather.page/0") checkScheme(doc, add)
  const ctx: BlockContext = { v1: doc.schema !== "feather.page/0", pageLoudness: typeof doc.loudness === "number" ? doc.loudness : undefined }
  widthsAllowed = ctx.v1

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
  const checkBlocks = (path: string, blocks: unknown, min: number, max: number, scene = false) => {
    if (!Array.isArray(blocks)) return add(path, "missing", `${path.split("/").pop()} is a list of blocks`)
    if (blocks.length < min) add(path, "too-few", `at least ${min} block${min === 1 ? "" : "s"}`)
    if (blocks.length > max) add(path, "too-many", `at most ${max} blocks`)
    blocks.forEach((b, i) => checkBlock(`${path}/${i}`, b, library, ids, add, { ...ctx, scene }))
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
    checkBlocks(`${at}/blocks`, scene.blocks, 1, 3, true)
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
  /** The block is in a prepared scene (an answer): only the Living Page's library may be. */
  scene?: boolean
}

function checkBlock(path: string, b: unknown, library: Record<string, unknown>, ids: Set<string>, add: Add, ctx: BlockContext) {
  if (!isObject(b)) return add(path, "type", "a block is an object with a `block` kind")
  const kind = b.block
  const pageOnly = typeof kind === "string" && kind in PAGE_BLOCKS
  if (pageOnly && ctx.scene) return add(`${path}/block`, "unknown-block", `"${kind}" is a page block; an answer is built from the Living Page's library (${Object.keys(BLOCKS).join(", ")})`)
  if (pageOnly && !ctx.v1) return add(`${path}/block`, "needs-schema-1", `${kind} is a block of feather.page/1; set "schema": "feather.page/1"`)
  const spec = typeof kind === "string" ? (BLOCKS[kind] ?? (pageOnly ? PAGE_BLOCKS[kind] : undefined)) : undefined
  if (!spec) return add(`${path}/block`, "unknown-block", `"${String(kind)}" is not a block of the library (${[...Object.keys(BLOCKS), ...Object.keys(PAGE_BLOCKS)].join(", ")})`)
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

/** One filled action per section (feather.page/1): at most one action says `primary: true`. (A hero whose starters
 * show, on a Living Page, leads with its first starter and renders every action quiet.) */
function checkActions(path: string, kind: string, b: Record<string, unknown>, add: Add) {
  if (kind !== "hero" && kind !== "contact") return
  const actions = Array.isArray(b.actions) ? b.actions : []
  const filled = actions.filter((a) => isObject(a) && a.primary === true).length
  if (filled > 1) add(`${path}/actions`, "contradiction", `one filled action per section: ${filled} actions are primary; mark one, and the rest are quiet`)
}

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
  if (isObject(b.scene)) checkScene(`${path}/scene`, kind, variant, b, b.scene, level, add)
  checkTreatment(path, kind, b.treatment, level, add)
  checkPageBlock(path, kind, variant, b, add)
  checkFlowBlock(path, kind, b, add)
  checkViews(path, b, add)
  checkActions(path, kind, b, add)

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

/** treatment: only where the block has images, and a moving one only at a loudness that lets it move. */
function checkTreatment(path: string, kind: string, treatment: unknown, level: number | undefined, add: Add) {
  if (treatment === undefined) return
  if (!BLOCK_RANGE[kind].treatment) return add(`${path}/treatment`, "unsupported", `${kind} has no images to treat`)
  const needs = typeof treatment === "string" ? MOVING_TREATMENTS[treatment] : undefined
  if (needs !== undefined && level !== undefined && level < needs) add(`${path}/treatment`, "contradiction", `${treatment} moves, which needs loudness ${needs} (the block is at ${level})`)
}

const VIDEO = /\.(?:mp4|webm|mov|m4v)(?:[?#]|$)/i
const mediaSrcOf = (m: unknown): string | undefined => (typeof m === "string" ? m : isObject(m) && typeof m.src === "string" ? m.src : undefined)
const isVideo = (m: unknown) => (isObject(m) && Array.isArray(m.sources) && m.sources.some((x) => isObject(x) && typeof x.type === "string" && x.type.startsWith("video/"))) || VIDEO.test(mediaSrcOf(m) ?? "")
/** An image that is content: written with its alt text (a bare path, or decorative, has none). */
const contentImage = (path: string, m: unknown, what: string, add: Add) => {
  if (m === undefined || mediaSrcOf(m) === undefined) return
  if (typeof m === "string") add(path, "missing", `${what} is content: write it as { src, alt }`)
  else if (isObject(m) && m.decorative === true) add(`${path}/decorative`, "contradiction", `${what} is content, never decorative: give it alt text`)
}
const ISO_DATE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The rules of the page blocks (and the new variants of the living ones) that the field table cannot say. */
function checkPageBlock(path: string, kind: string, variant: string | undefined, b: Record<string, unknown>, add: Add) {
  const list = (k: string) => (Array.isArray(b[k]) ? (b[k] as unknown[]) : [])
  if (kind === "gallery") {
    if (b.loop !== undefined && variant !== undefined && variant !== "rail" && variant !== "wheel") add(`${path}/loop`, "contradiction", `loop is the rail's and the wheel's (this gallery is ${variant})`)
    list("items").forEach((item, i) => isObject(item) && contentImage(`${path}/items/${i}/media`, item.media, "a gallery image", add))
  }
  if (kind === "comparison") for (const k of ["before", "after"]) contentImage(`${path}/${k}`, b[k], `the ${k} image`, add)
  if (kind === "journal") list("items").forEach((item, i) => isObject(item) && typeof item.date === "string" && !ISO_DATE.test(item.date) && add(`${path}/items/${i}/date`, "type", "a date is written YYYY-MM-DD"))
  if (kind === "showreel") {
    const m = b.media
    if (mediaSrcOf(m) !== undefined && !isVideo(m)) add(`${path}/media`, "bad-media", "a showreel is a video (mp4, webm, mov, or video sources)")
    else if (mediaSrcOf(m) !== undefined && !(isObject(m) && typeof m.poster === "string")) add(`${path}/media/poster`, "missing", "a showreel needs its poster: the still before it plays, under reduced motion and on data saver")
    const captions = mediaSrcOf(b.captions)
    if (b.speech === true && b.captions === undefined) add(`${path}/captions`, "missing", "a film with speech needs its captions (a WebVTT file)")
    if (captions !== undefined && !/\.vtt(?:[?#]|$)/i.test(captions)) add(`${path}/captions`, "bad-media", "captions are a WebVTT file (.vtt)")
  }
  if (kind === "form") {
    if (typeof b.action === "string" && !/^(https?:\/\/|mailto:|\/(?!\/)|\.{1,2}\/|[A-Za-z0-9_-])/.test(b.action.trim())) add(`${path}/action`, "bad-href", "a form posts to an http(s) URL or a path, or opens a mailto: address")
    else if (typeof b.action === "string" && /^(tel:|#)/.test(b.action.trim())) add(`${path}/action`, "bad-href", "a form posts to an http(s) URL or a path, or opens a mailto: address")
    const seen = new Set<string>()
    list("fields").forEach((f, i) => {
      if (!isObject(f)) return
      const at = `${path}/fields/${i}`
      if (typeof f.name === "string") {
        if (!SLUG_RE.test(f.name)) add(`${at}/name`, "type", "a field name is a slug (it is what the form sends)")
        else if (seen.has(f.name)) add(`${at}/name`, "duplicate-id", `the field name "${f.name}" is used twice`)
        seen.add(f.name)
      }
      const type = typeof f.type === "string" ? f.type : "text"
      const options = has(OPTION_FIELDS, type)
      if (options && f.options === undefined) add(`${at}/options`, "missing", `a ${type} needs its options`)
      if (!options && f.options !== undefined) add(`${at}/options`, "contradiction", "options are a select's or a choice's")
      if (options && f.max !== undefined) add(`${at}/max`, "contradiction", `a ${type} has no length`)
      if (type === "choice" && f.placeholder !== undefined) add(`${at}/placeholder`, "contradiction", "a choice has no placeholder")
    })
  }
  if (kind === "offer") {
    const items = list("items")
    if (variant === "toggle") {
      if (b.periods === undefined) add(`${path}/periods`, "missing", "the toggle offer switches between two periods (or plans): name them")
      items.forEach((item, i) => isObject(item) && item.prices === undefined && add(`${path}/items/${i}/prices`, "missing", "in a toggle offer every item has a price for each period"))
    } else {
      if (b.periods !== undefined) add(`${path}/periods`, "contradiction", "periods are the toggle offer's; set variant: toggle")
      items.forEach((item, i) => isObject(item) && item.prices !== undefined && add(`${path}/items/${i}/prices`, "contradiction", "prices are the toggle offer's; set variant: toggle"))
    }
  }
}

/** A scene's knobs against its kind, its block and the loudness: what the field table cannot say. */
function checkScene(path: string, block: string, variant: string | undefined, b: Record<string, unknown>, scene: Record<string, unknown>, level: number | undefined, add: Add) {
  const kind = has(SCENE_KINDS, scene.kind) ? scene.kind : undefined
  // A World scene needs loudness 3 wherever one is declared (the brand's own default decides where none is).
  if (level !== undefined && level < 3) add(path, "contradiction", `a scene is spectacle, which needs loudness 3 (the block is at ${level})`)
  if (block === "hero" && variant !== "interactive") add(path, "contradiction", `the scene is the interactive hero's; set variant: interactive${variant ? ` (this hero is ${variant})` : ""}`)
  if (block === "case" && variant === "scale") add(path, "contradiction", "the scale case grows its media as it pins; a scene cannot sit inside it")
  if (!kind) return
  const presets = SCENE_PRESETS[kind]
  if (typeof scene.preset === "string" && !presets.includes(scene.preset) && Object.values(SCENE_PRESETS).flat().includes(scene.preset)) {
    add(`${path}/preset`, "unsupported", presets.length ? `a ${kind} scene takes the presets ${presets.join(", ")}` : `a ${kind} scene has no presets`)
  }
  for (const k of ["model", "hotspots", "variants"]) if (scene[k] !== undefined && kind !== "model") add(`${path}/${k}`, "unsupported", `${k} is the model scene's (this scene is ${kind})`)
  if (scene.depth !== undefined && kind !== "depth") add(`${path}/depth`, "unsupported", `depth is the depth scene's (this scene is ${kind})`)
  if (kind === "model" && scene.model === undefined) add(`${path}/model`, "missing", "a model scene needs its model (a GLB)")
  const model = typeof scene.model === "string" ? scene.model : isObject(scene.model) && typeof scene.model.src === "string" ? scene.model.src : undefined
  if (kind === "model" && model !== undefined && !/\.(?:glb|gltf)(?:[?#]|$)/i.test(model)) add(`${path}/model`, "bad-media", "a model is a GLB (or glTF) file")
  if (kind === "depth") {
    if (b.media === undefined) add(`${path.slice(0, -"/scene".length)}/media`, "missing", "a depth scene gives the block's photo depth: it needs the photo (media)")
    if (scene.depth === undefined) add(`${path}/depth`, "missing", "a depth scene needs the photo's depth map (depth)")
  }
  for (const k of ["hotspots", "variants"] as const) {
    const list = scene[k]
    if (!Array.isArray(list)) continue
    const seen = new Set<string>()
    list.forEach((item, i) => {
      const id = isObject(item) ? item.id : undefined
      if (typeof id !== "string") return
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) add(`${path}/${k}/${i}/id`, "type", `a ${k === "hotspots" ? "hotspot" : "variant"} id is a slug`)
      else if (seen.has(id)) add(`${path}/${k}/${i}/id`, "duplicate-id", `the id "${id}" is used twice`)
      seen.add(id)
    })
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
      if (isObject(v) && v.srcset !== undefined) checkSrcset(`${path}/srcset`, v.srcset, add)
      if (isObject(v) && Array.isArray(v.sources)) v.sources.forEach((s, i) => isObject(s) && s.srcset !== undefined && checkSrcset(`${path}/sources/${i}/srcset`, s.srcset, add))
      return
    }
    case "texts":
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return add(path, "type", "expected a list of text")
      if (spec.min !== undefined && v.length < spec.min) add(path, "too-few", `at least ${spec.min}`)
      if (spec.max !== undefined && v.length > spec.max) add(path, "too-many", `at most ${spec.max}`)
      return
    case "numbers":
      if (!Array.isArray(v) || v.some((x) => typeof x !== "number" || !Number.isFinite(x))) return add(path, "type", "expected a list of numbers")
      if (spec.min !== undefined && v.length < spec.min) add(path, "too-few", `at least ${spec.min}`)
      if (spec.max !== undefined && v.length > spec.max) add(path, "too-many", `at most ${spec.max}`)
      return
    case "vector":
      if (!Array.isArray(v) || v.length !== spec.length || v.some((x) => typeof x !== "number" || !Number.isFinite(x))) return add(path, "type", `expected ${spec.length} numbers`)
      if (v.some((x) => (spec.min !== undefined && x < spec.min) || (spec.max !== undefined && x > spec.max))) add(path, "out-of-range", `each number from ${spec.min} to ${spec.max}`)
      return
    case "map": {
      if (!isObject(v)) return add(path, "type", `expected an object of ${spec.key ?? "names"} to text`)
      const entries = Object.entries(v)
      if (entries.length === 0) add(path, "too-few", "at least 1")
      if (spec.max !== undefined && entries.length > spec.max) add(path, "too-many", `at most ${spec.max}`)
      for (const [k, x] of entries) {
        if (typeof x !== "string") add(`${path}/${esc(k)}`, "type", "expected text")
        else if (spec.value && [...x].length > spec.value) add(`${path}/${esc(k)}`, "too-long", `at most ${spec.value} characters`)
      }
      return
    }
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
