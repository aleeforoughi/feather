// Shared by QOOE's media tools. Node built-ins only: they run offline in the sandbox.
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

/** Every HTML page under source/ (render's own temporary copies excluded). */
export function sourcePages(root = process.cwd()) {
  const out = []
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== "fonts") walk(full)
      } else if (/\.html?$/i.test(entry.name) && !entry.name.startsWith(".render-")) out.push(path.relative(root, full).split(path.sep).join("/"))
    }
  }
  walk(path.join(root, "source"))
  return out.sort()
}

/** The content of <meta name="..."> in a page, whatever the attribute order. */
export function metaOf(html, name) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (a) => tag.match(new RegExp(`\\b${a}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1]
    if (attr("name")?.toLowerCase() === name) return attr("content")?.trim() ?? null
  }
  return null
}

/** A page's render target: its output path and pixel size, or a reason it has none. */
export function pageTarget(rel, root = process.cwd()) {
  const html = fs.readFileSync(path.join(root, rel), "utf8")
  const output = metaOf(html, "qooe:output")
  if (!output) return null
  const size = (metaOf(html, "qooe:size") ?? "").toLowerCase().match(/^(\d{2,5})x(\d{2,5})$/)
  if (!/^[a-z0-9][a-z0-9._/-]*\.(png|pdf)$/i.test(output) || output.includes("..") || output.startsWith("source/") || output.startsWith(".")) {
    return { rel, html, error: `${rel}: qooe:output "${output}" must be a deliverable path like graphics/post.png or guideline/name.pdf` }
  }
  if (!size) return { rel, html, error: `${rel}: needs <meta name="qooe:size" content="<W>x<H>"> (pixels)` }
  return { rel, html, output, width: Number(size[1]), height: Number(size[2]), pages: (html.match(/<section\b[^>]*class\s*=\s*["'][^"']*\bpage\b/gi) ?? []).length }
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export function parsePng(buf) {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIGNATURE)) return { error: "not a PNG (bad signature)" }
  let pos = 8
  let ihdr = null
  let hasTrns = false
  const idat = []
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.subarray(pos + 4, pos + 8).toString("ascii")
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (data.length < len) return { error: "truncated PNG" }
    if (type === "IHDR") ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9], interlace: data[12] }
    else if (type === "tRNS") hasTrns = true
    else if (type === "IDAT") idat.push(data)
    else if (type === "IEND") break
    pos += 12 + len
  }
  if (!ihdr) return { error: "missing IHDR chunk" }
  if (idat.length === 0) return { error: "PNG has no image data" }
  return { ...ihdr, hasTrns, idat: Buffer.concat(idat) }
}

export function hasAlpha(png) {
  return png.colorType === 6 || png.colorType === 4 || (png.colorType === 3 && png.hasTrns)
}

/** Alpha of the four corner pixels (8-bit RGBA, not interlaced), or null when they cannot be sampled. */
export function cornerAlphas(png) {
  if (png.colorType !== 6 || png.bitDepth !== 8 || png.interlace !== 0) return null
  let raw
  try {
    raw = zlib.inflateSync(png.idat)
  } catch {
    return null
  }
  const { width, height } = png
  const stride = width * 4
  if (raw.length < (stride + 1) * height) return null
  // Unfilter only the first and last rows' needs: decode every row (filters depend on the row above).
  const rows = []
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? line[x - 4] : 0
      const b = prev[x]
      const c = x >= 4 ? prev[x - 4] : 0
      if (filter === 1) line[x] = (line[x] + a) & 0xff
      else if (filter === 2) line[x] = (line[x] + b) & 0xff
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 0xff
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
      }
    }
    if (y === 0 || y === height - 1) rows[y === 0 ? 0 : 1] = line
    prev = line
  }
  const alphaAt = (row, x) => row[x * 4 + 3]
  return [alphaAt(rows[0], 0), alphaAt(rows[0], width - 1), alphaAt(rows[1], 0), alphaAt(rows[1], width - 1)]
}

/** Pages in a PDF (Chromium writes one /Type /Page object per page). */
export function pdfPages(buf) {
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return { error: "not a PDF" }
  return { pages: (buf.toString("latin1").match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length }
}

/** Where render saves an output's layout report (verify reads it from the same place). */
export const reportFile = (output) => `.qooe/report/${output.replaceAll("/", "__")}.json`

export function readManifest(root = process.cwd()) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, ".qooe/deliverables.json"), "utf8"))
  } catch {
    return null
  }
}

/** The deliverable that owns `output` when its `sources` folders do not include page `rel` (else null).
 *  Tasks own their outputs: one task's page must never write another task's file. */
export function foreignOwner(manifest, rel, output) {
  for (const d of manifest?.deliverables ?? []) {
    if (!d.files?.includes(output) || !Array.isArray(d.sources) || d.sources.length === 0) continue
    const prefixes = d.sources.map((s) => (s.endsWith("/") ? s : `${s}/`))
    if (!prefixes.some((p) => rel.startsWith(p))) return d
  }
  return null
}
