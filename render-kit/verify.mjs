// QOOE's deliverable checks for media products: every deliverable that exists is the right format, size,
// transparency and page count, rendered from its current source; nothing but deliverables sits in the
// delivery folders. Deliverables not made yet are listed, not failed (each task checks its own exist).
// Deterministic, offline, Node built-ins only.
import fs from "node:fs"
import path from "node:path"
import { cornerAlphas, foreignOwner, hasAlpha, pageTarget, parsePng, pdfPages, reportFile, sourcePages } from "./lib.mjs"

const problems = []
const notes = []
if (!fs.existsSync(".qooe/deliverables.json")) {
  console.error("QOOE has not written .qooe/deliverables.json for this product: nothing to check against.")
  process.exit(1)
}
const manifest = JSON.parse(fs.readFileSync(".qooe/deliverables.json", "utf8"))
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const CSS_SIZE = /^-?\d+(?:\.\d+)?(?:px|rem|em)$/
const PX = /^\d+(?:\.\d+)?px$/

// Which page renders which output (an output made by hand, or by two pages, is a problem).
const targets = new Map()
for (const rel of sourcePages()) {
  const t = pageTarget(rel)
  if (!t) continue
  if (t.error) {
    problems.push(t.error)
    continue
  }
  const owner = foreignOwner(manifest, rel, t.output)
  if (owner) problems.push(`${rel} declares ${t.output}, which belongs to ${owner.title} (made from ${owner.sources.join(", ")}); remove its qooe:output meta or ask that task's owner`)
  if (targets.has(t.output)) problems.push(`${t.output} is rendered by two pages: ${targets.get(t.output).rel} and ${rel}`)
  targets.set(t.output, t)
}

const RENDERED = new Set(["palette", "typography", "guideline", "document", "deck"])

function checkPng(file, d) {
  const png = parsePng(fs.readFileSync(file))
  if (png.error) return problems.push(`${file}: ${png.error}. Export a real PNG, not another format renamed to .png`)
  const { width, height } = png
  if (d.size) {
    const [w, h] = d.size.split("x").map(Number)
    if (width !== w || height !== h) problems.push(`${file} is ${width}x${height}; it must be exactly ${d.size}. Render it from a page with <meta name="qooe:size" content="${d.size}">`)
  }
  if (d.type === "logo" && Math.max(width, height) < 1024) problems.push(`${file} is ${width}x${height}; the logo's long side must be at least 1024px`)
  if ((d.type === "mark" || d.type === "icon") && width !== height) problems.push(`${file} is ${width}x${height}; it must be square`)
  if (d.type === "mark" && width < 512) problems.push(`${file} is ${width}x${height}; the mark must be at least 512x512`)
  if (d.type === "icon" && width < 1024) problems.push(`${file} is ${width}x${height}; the app icon must be at least 1024x1024`)
  if (d.type === "logo" || d.type === "mark") {
    if (!hasAlpha(png)) return problems.push(`${file} has no transparency. Regenerate it on a transparent background, not a white or solid box`)
    const alphas = cornerAlphas(png)
    const opaque = alphas ? alphas.filter((a) => a > 16).length : 0
    if (opaque > 0) problems.push(`${file} has an opaque background (${opaque} of 4 corners). Remove the background so it sits on transparency`)
  }
}

function checkPdf(file, d) {
  const pdf = pdfPages(fs.readFileSync(file))
  if (pdf.error) return problems.push(`${file}: ${pdf.error}`)
  if (d.minPages && pdf.pages < d.minPages) problems.push(`${file} has ${pdf.pages} pages; ${d.title} needs at least ${d.minPages}`)
  notes.push(`${file}: ${pdf.pages} pages`)
}

// Smallest text (px) a reader can be expected to read, by what the deliverable is.
const MIN_TEXT = { graphic: 14, document: 9 }
const minText = (type) => MIN_TEXT[type] ?? 12

/** Gates on the layout report render measured: legibility, contrast, bounds, overlaps, clipping, images, fonts. */
function checkLayout(file, d, hasSource) {
  const reportPath = reportFile(file)
  if (!fs.existsSync(reportPath)) return hasSource ? notes.push(`${file}: no layout report: run render`) : undefined
  if (fs.statSync(reportPath).mtimeMs + 1000 < fs.statSync(file).mtimeMs) return notes.push(`${file}: layout report is older than the file and was ignored: run render`)
  let report
  try {
    report = JSON.parse(fs.readFileSync(reportPath, "utf8"))
  } catch {
    return notes.push(`${file}: layout report is unreadable: run render`)
  }
  if (report.error) return notes.push(`${file}: layout measurement failed (${report.error})`)
  const min = minText(d.type)
  const q = (s) => `'${s}'`
  for (const page of report.pages ?? []) {
    const at = report.kind === "pdf" ? `${file} page ${page.page}` : file
    const fail = (msg) => problems.push(`${at}: ${msg}`)
    for (const x of page.missingImages ?? []) fail(`image ${q(x.src)} did not load; fix its path or remove it`)
    for (const x of page.outOfBounds ?? []) fail(`${x.kind} ${q(x.text)} extends outside the page (${Object.entries(x.by).map(([side, px]) => `${px}px past the ${side}`).join(", ")}); move it inside or make it smaller`)
    for (const x of page.fontFallback ?? []) fail(`font "${x.family}" is not available (text ${q(x.text)} falls back to another font); load it with @font-face from source/fonts or use an available font`)
    for (const x of page.textBelowMin ?? []) if (x.px < min) fail(`text ${q(x.text)} is ${x.px}px; the minimum for a ${d.type} is ${min}px`)
    // Text already flagged as too small is not also flagged for contrast.
    for (const x of page.lowContrast ?? []) if (x.px >= min) fail(`text ${q(x.text)} has contrast ${x.ratio}:1 (${x.color} on ${x.background}); it needs at least ${x.required}:1, so darken the text or change the background`)
    for (const x of page.overlaps ?? []) fail(`text ${q(x.a)} overlaps ${q(x.b)} by ${x.percent}%; give each its own space`)
    for (const x of page.clipped ?? []) fail(`text ${q(x.text)} is clipped by <${x.el}> (overflows by ${x.overflowX}px across, ${x.overflowY}px down); enlarge the box or shorten the text`)
  }
}

const delivered = new Set()
for (const d of manifest.deliverables) {
  for (const file of d.files) {
    delivered.add(file)
    if (!fs.existsSync(file)) {
      notes.push(`${file} (${d.title}): not made yet`)
      continue
    }
    if (file.endsWith(".png")) checkPng(file, d)
    else if (file.endsWith(".pdf")) checkPdf(file, d)
    const source = targets.get(file)
    if (RENDERED.has(d.type) && !source) problems.push(`${file} must be rendered from an HTML page in source/ (<meta name="qooe:output" content="${file}">), so it stays editable and its text stays crisp`)
    checkLayout(file, d, Boolean(source))
    if (source && fs.statSync(path.join(source.rel)).mtimeMs > fs.statSync(file).mtimeMs + 1000) problems.push(`${file} is older than ${source.rel}: run "render" again`)
  }
}

// Brand tokens, when the product has them, are the source of truth for color and type.
if (fs.existsSync("brand/tokens.json")) {
  let t = null
  try {
    t = JSON.parse(fs.readFileSync("brand/tokens.json", "utf8"))
  } catch (err) {
    problems.push(`brand/tokens.json is not valid JSON: ${err.message}`)
  }
  const obj = (v) => v && typeof v === "object" && !Array.isArray(v)
  if (t) {
    if (typeof t.name !== "string" || !t.name.trim()) problems.push("tokens.name must be a non-empty string")
    if (!obj(t.colors)) problems.push("tokens.colors must be an object of role -> #hex")
    else {
      for (const role of ["primary", "background", "surface", "text"]) if (!(role in t.colors)) problems.push(`tokens.colors.${role} is required`)
      for (const [role, v] of Object.entries(t.colors)) if (typeof v !== "string" || !HEX.test(v)) problems.push(`tokens.colors.${role} must be a #hex color, got ${JSON.stringify(v)}`)
    }
    const ty = t.typography
    if (!obj(ty) || !obj(ty.fontFamily) || !ty.fontFamily.display || !ty.fontFamily.body) problems.push("tokens.typography needs fontFamily { display, body }")
    else if (!obj(ty.scale) || Object.keys(ty.scale).length < 4) problems.push("tokens.typography.scale needs at least 4 steps")
    else for (const [k, v] of Object.entries(ty.scale)) if (typeof v !== "string" || !CSS_SIZE.test(v)) problems.push(`tokens.typography.scale.${k} must be a size like "16px", got ${JSON.stringify(v)}`)
    for (const [key, min] of [["spacing", 4], ["radius", 2]]) {
      if (!obj(t[key]) || Object.keys(t[key]).length < min) problems.push(`tokens.${key} needs at least ${min} steps like { "sm": "8px" }`)
      else for (const [k, v] of Object.entries(t[key])) if (typeof v !== "string" || !PX.test(v)) problems.push(`tokens.${key}.${k} must be a "<n>px" value, got ${JSON.stringify(v)}`)
    }
  }
}

// The delivery folders hold deliverables only (and the brand's tokens and rationale).
const KEEP = new Set(["brand/tokens.json", "brand/BRAND.md"])
const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`])) : [])
for (const folder of ["brand", "graphics", "guideline", "document", "deck"]) {
  for (const file of walk(folder)) {
    if (!delivered.has(file) && !KEEP.has(file) && !file.endsWith("/.DS_Store")) problems.push(`${file} is not a deliverable: move explorations and alternatives to source/explorations/`)
  }
}

for (const n of notes) console.log(`note: ${n}`)
if (problems.length > 0) {
  console.error(`Deliverable checks failed:\n${problems.map((p) => `- ${p}`).join("\n")}`)
  // For QOOE: which files each failure concerns, so a task is held only to failures in its own files (parallel
  // tasks share one product; Godpip's follow-ups failed on each other's pages and routed requests in a loop).
  const known = [...new Set([...manifest.deliverables.flatMap((d) => d.files), ...sourcePages(), "brand/tokens.json", ...problems.flatMap((p) => p.match(/[a-z0-9_-][a-z0-9_.-]*(?:\/[a-z0-9_.-]+)*\/[a-z0-9_-][a-z0-9_.-]*\.[a-z0-9]+/gi) ?? [])])]
  const subjects = (p) => {
    const named = known.filter((k) => p.includes(k))
    return named.length > 0 ? named : /^tokens\./.test(p) ? ["brand/tokens.json"] : ["*"]
  }
  console.log(`qooe-failures: ${JSON.stringify(problems.map((message) => ({ subjects: subjects(message), message: message.slice(0, 400) })))}`)
  process.exit(1)
}
console.log("Deliverable checks passed.")
