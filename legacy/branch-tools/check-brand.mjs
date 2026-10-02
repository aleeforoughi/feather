// QOOE brand checks. Deterministic: no network, no dependencies (Node built-ins only).
// Brand assets are raster images made with an image model: logo.png and logo-mark.png must be
// real PNGs with a transparent background. brand/tokens.json is the design-token source of truth.
import fs from "node:fs"
import zlib from "node:zlib"

const problems = []
const notes = []
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const CSS_SIZE = /^-?\d+(?:\.\d+)?(?:px|rem|em)$/
const PX = /^\d+(?:\.\d+)?px$/
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

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
    if (type === "IHDR") {
      if (len !== 13) return { error: "bad IHDR chunk" }
      ihdr = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8],
        colorType: data[9], interlace: data[12],
      }
    } else if (type === "tRNS") hasTrns = true
    else if (type === "IDAT") idat.push(data)
    else if (type === "IEND") break
    pos += 12 + len
  }
  if (!ihdr) return { error: "missing IHDR chunk" }
  if (!(ihdr.colorType in CHANNELS)) return { error: `unknown PNG color type ${ihdr.colorType}` }
  if (idat.length === 0) return { error: "PNG has no image data" }
  return { ...ihdr, hasTrns, idat: Buffer.concat(idat) }
}

export function hasAlphaChannel(png) {
  return png.colorType === 6 || png.colorType === 4 || (png.colorType === 3 && png.hasTrns)
}

// Alpha of the four corner pixels, or null when the pixels cannot be sampled (then callers
// fall back to the color-type check).
export function cornerAlphas(png) {
  if (png.colorType !== 6 || png.bitDepth !== 8 || png.interlace !== 0) return null
  let raw
  try {
    raw = zlib.inflateSync(png.idat)
  } catch {
    return null
  }
  const { width, height } = png
  const bpp = 4
  const stride = width * bpp
  if (raw.length < (stride + 1) * height) return null
  const cur = Buffer.alloc(stride)
  let prev = Buffer.alloc(stride)
  const rows = new Map([[0, null], [height - 1, null]])
  let p = 0
  for (let y = 0; y < height; y++) {
    const ft = raw[p++]
    for (let x = 0; x < stride; x++) {
      const v = raw[p++]
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let add = 0
      if (ft === 1) add = a
      else if (ft === 2) add = b
      else if (ft === 3) add = (a + b) >> 1
      else if (ft === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else if (ft !== 0) return null
      cur[x] = (v + add) & 255
    }
    if (rows.has(y)) rows.set(y, Buffer.from(cur))
    prev = Buffer.from(cur)
  }
  const top = rows.get(0)
  const bottom = rows.get(height - 1)
  return [top[3], top[stride - 1], bottom[3], bottom[stride - 1]]
}

function checkPng(file, { minLong, minSquare, transparent, pixelSample }) {
  if (!fs.existsSync(file)) {
    problems.push(`${file} is missing`)
    return
  }
  const png = parsePng(fs.readFileSync(file))
  if (png.error) {
    problems.push(`${file}: ${png.error}. Export a real PNG image, not another format renamed to .png`)
    return
  }
  const { width, height } = png
  if (minLong && Math.max(width, height) < minLong) problems.push(`${file} is ${width}x${height}; the long side must be at least ${minLong}px`)
  if (minSquare) {
    if (width !== height) problems.push(`${file} is ${width}x${height}; the mark must be square`)
    if (width < minSquare || height < minSquare) problems.push(`${file} is ${width}x${height}; it must be at least ${minSquare}x${minSquare}`)
  }
  if (!transparent) return
  if (!hasAlphaChannel(png)) {
    problems.push(`${file} has no transparency (PNG color type ${png.colorType}). Regenerate it with a transparent background (RGBA PNG), not a white or solid box`)
    return
  }
  if (!pixelSample) return
  const alphas = cornerAlphas(png)
  if (!alphas) {
    notes.push(`${file}: pixels not sampled (needs non-interlaced 8-bit RGBA); only the color type was checked`)
    return
  }
  const opaque = alphas.filter((a) => a > 16).length
  if (opaque > 0) problems.push(`${file} has an opaque background: ${opaque} of 4 corner pixels are not transparent (alpha ${alphas.join(", ")}). Remove the background so the logo sits on transparency`)
}

function checkTokens() {
  const file = "brand/tokens.json"
  if (!fs.existsSync(file)) {
    problems.push(`${file} is missing`)
    return
  }
  let t
  try {
    t = JSON.parse(fs.readFileSync(file, "utf8"))
  } catch (err) {
    problems.push(`${file} is not valid JSON: ${err.message}`)
    return
  }
  const obj = (v) => v && typeof v === "object" && !Array.isArray(v)
  if (!obj(t)) {
    problems.push(`${file} must be a JSON object`)
    return
  }
  if (typeof t.name !== "string" || !t.name.trim()) problems.push("tokens.name must be a non-empty string")
  if (!obj(t.colors)) problems.push("tokens.colors must be an object of role -> #hex")
  else {
    for (const role of ["primary", "background", "surface", "text"]) {
      if (!(role in t.colors)) problems.push(`tokens.colors.${role} is required`)
    }
    for (const [role, v] of Object.entries(t.colors)) {
      if (typeof v !== "string" || !HEX.test(v)) problems.push(`tokens.colors.${role} must be a #hex color, got ${JSON.stringify(v)}`)
    }
  }
  const ty = t.typography
  if (!obj(ty)) problems.push("tokens.typography is required: { fontFamily: { display, body }, scale: { ... } }")
  else {
    const ff = ty.fontFamily
    if (!obj(ff) || typeof ff.display !== "string" || !ff.display.trim() || typeof ff.body !== "string" || !ff.body.trim()) {
      problems.push("tokens.typography.fontFamily needs non-empty display and body strings")
    }
    if (!obj(ty.scale) || Object.keys(ty.scale).length < 4) problems.push("tokens.typography.scale needs at least 4 steps")
    else for (const [k, v] of Object.entries(ty.scale)) if (typeof v !== "string" || !CSS_SIZE.test(v)) problems.push(`tokens.typography.scale.${k} must be a size like "16px" or "1rem", got ${JSON.stringify(v)}`)
  }
  for (const [key, min] of [["spacing", 4], ["radius", 2]]) {
    if (!obj(t[key]) || Object.keys(t[key]).length < min) problems.push(`tokens.${key} needs at least ${min} steps like { "sm": "8px" }`)
    else for (const [k, v] of Object.entries(t[key])) if (typeof v !== "string" || !PX.test(v)) problems.push(`tokens.${key}.${k} must be a "<n>px" value, got ${JSON.stringify(v)}`)
  }
  if (t.shadow !== undefined && !obj(t.shadow)) problems.push("tokens.shadow, when present, must be an object")
  if (t.voice !== undefined && !(Array.isArray(t.voice) && t.voice.every((s) => typeof s === "string"))) problems.push("tokens.voice, when present, must be an array of strings")
}

checkPng("brand/logo.png", { minLong: 1024, transparent: true, pixelSample: true })
checkPng("brand/logo-mark.png", { minSquare: 512, transparent: true, pixelSample: true })
checkTokens()
if (!fs.existsSync("brand/BRAND.md")) problems.push("brand/BRAND.md (the usage guide) is missing")

for (const n of notes) console.log(`note: ${n}`)
if (problems.length > 0) {
  console.log(`Brand check failed:\n- ${problems.join("\n- ")}`)
  process.exit(1)
}
console.log("Brand check passed.")
