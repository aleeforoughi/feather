// Font metrics from a WOFF2 file, for a metric-matched local fallback: the size-adjust and ascent, descent and line-gap
// overrides that make the swap from the fallback face to the real one shift nothing (docs/visual-system.md §14.1).
// Node only (zlib's Brotli); no dependencies. Reads the head, hhea and OS/2 tables, which WOFF2 never transforms.

import { brotliDecompressSync } from "node:zlib"

/** English letter frequencies (percent of letters, convention) and the share of spaces in running text: the width
 * a fallback must match is the width of text, not of the average glyph (OS/2 xAvgCharWidth counts every glyph in the
 * font, wide symbols included, and overstates it). */
const LETTER_FREQ = { a: 8.2, b: 1.5, c: 2.8, d: 4.3, e: 12.7, f: 2.2, g: 2.0, h: 6.1, i: 7.0, j: 0.15, k: 0.77, l: 4.0, m: 2.4, n: 6.7, o: 7.5, p: 1.9, q: 0.095, r: 6.0, s: 6.3, t: 9.1, u: 2.8, v: 0.98, w: 2.4, x: 0.15, y: 2.0, z: 0.074 }
const SPACE_SHARE = 0.18

/** The text-weighted average advance (in em) of the local faces a fallback may name, measured with textWidth() from
 * the faces macOS ships (/System/Library/Fonts). Helvetica and Helvetica Neue take Arial's (they are metric peers). */
export const LOCAL_FACES = {
  Arial: 0.44152,
  Helvetica: 0.44152,
  "Helvetica Neue": 0.44152,
  "Times New Roman": 0.40011,
  Georgia: 0.4392,
  "Courier New": 0.6001,
}

/** The local fallback face for a font category (Fontsource's: sans-serif, serif, monospace, display, handwriting). */
export function fallbackFace(category) {
  if (category === "serif") return "Times New Roman"
  if (category === "monospace") return "Courier New"
  return "Arial"
}

const KNOWN_TAGS = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"]

/** Reads a WOFF2 UIntBase128 at `at`; returns [value, next offset]. */
function base128(buf, at) {
  let value = 0
  for (let i = 0; i < 5; i++) {
    const byte = buf[at + i]
    if (i === 0 && byte === 0x80) throw new Error("woff2: UIntBase128 with a leading zero")
    value = value * 128 + (byte & 0x7f)
    if ((byte & 0x80) === 0) return [value, at + i + 1]
  }
  throw new Error("woff2: UIntBase128 longer than 5 bytes")
}

/** The tables of a TrueType or OpenType file (an .ttf or .otf, not a collection), by tag. */
export function sfntTables(file) {
  const buf = Buffer.from(file)
  const numTables = buf.readUInt16BE(4)
  const tables = {}
  for (let i = 0; i < numTables; i++) {
    const at = 12 + i * 16
    const tag = buf.toString("latin1", at, at + 4)
    const offset = buf.readUInt32BE(at + 8)
    const length = buf.readUInt32BE(at + 12)
    tables[tag] = buf.subarray(offset, offset + length)
  }
  return tables
}

/** A font's tables, from WOFF2 or plain sfnt. */
export function tablesOf(file) {
  return Buffer.from(file).toString("latin1", 0, 4) === "wOF2" ? woff2Tables(file) : sfntTables(file)
}

/** The glyph index of a code point, from a format 4 (BMP) cmap subtable. */
function glyphOf(cmap, cp) {
  const count = cmap.readUInt16BE(2)
  for (let i = 0; i < count; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8)
    const encoding = cmap.readUInt16BE(6 + i * 8)
    if (!((platform === 3 && (encoding === 1 || encoding === 10)) || platform === 0)) continue
    const sub = cmap.subarray(cmap.readUInt32BE(8 + i * 8))
    if (sub.readUInt16BE(0) !== 4) continue
    const segX2 = sub.readUInt16BE(6)
    const ends = 14
    const starts = ends + segX2 + 2
    const deltas = starts + segX2
    const ranges = deltas + segX2
    for (let s = 0; s < segX2 / 2; s++) {
      const end = sub.readUInt16BE(ends + s * 2)
      if (cp > end) continue
      const start = sub.readUInt16BE(starts + s * 2)
      if (cp < start) return 0
      const delta = sub.readInt16BE(deltas + s * 2)
      const rangeOffset = sub.readUInt16BE(ranges + s * 2)
      if (rangeOffset === 0) return (cp + delta) & 0xffff
      const g = sub.readUInt16BE(ranges + s * 2 + rangeOffset + (cp - start) * 2)
      return g === 0 ? 0 : (g + delta) & 0xffff
    }
    return 0
  }
  return 0
}

/** The advance width of a glyph from hmtx (plain, or WOFF2's transformed form, which keeps the advances). */
function advanceOf(t, glyph) {
  const numberOfHMetrics = t.hhea.readUInt16BE(34)
  const g = Math.min(glyph, numberOfHMetrics - 1)
  const plainLength = numberOfHMetrics * 4
  // A WOFF2-transformed hmtx starts with a flags byte and lists the advances first, two bytes each.
  if (t.hmtx.length !== plainLength && t.hmtx.length < plainLength && t.hmtx.length >= 1 + numberOfHMetrics * 2) return t.hmtx.readUInt16BE(1 + g * 2)
  return t.hmtx.readUInt16BE(g * 4)
}

/** The text-weighted average advance of a font, in em: English letters by frequency, and spaces. */
export function textWidth(file) {
  const t = tablesOf(file)
  const upm = t.head.readUInt16BE(18)
  const width = (ch) => advanceOf(t, glyphOf(t.cmap, ch.codePointAt(0))) / upm
  const total = Object.values(LETTER_FREQ).reduce((a, b) => a + b, 0)
  const letters = Object.entries(LETTER_FREQ).reduce((sum, [ch, f]) => sum + width(ch) * f, 0) / total
  return letters * (1 - SPACE_SHARE) + width(" ") * SPACE_SHARE
}

/** The uncompressed tables of a WOFF2 font, by tag. */
export function woff2Tables(file) {
  const buf = Buffer.from(file)
  if (buf.toString("latin1", 0, 4) !== "wOF2") throw new Error("not a WOFF2 file")
  if (buf.toString("latin1", 4, 8) === "ttcf") throw new Error("woff2: font collections are not supported")
  const numTables = buf.readUInt16BE(12)
  const compressedLength = buf.readUInt32BE(20)
  let at = 48
  const dir = []
  for (let i = 0; i < numTables; i++) {
    const flags = buf[at++]
    let tag
    if ((flags & 0x3f) === 0x3f) {
      tag = buf.toString("latin1", at, at + 4)
      at += 4
    } else tag = KNOWN_TAGS[flags & 0x3f]
    const version = (flags >> 6) & 0x03
    let length
    ;[length, at] = base128(buf, at)
    // glyf and loca are transformed unless version 3; other tables are transformed when version is not 0.
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0
    if (transformed) [length, at] = base128(buf, at)
    dir.push({ tag, length })
  }
  const data = brotliDecompressSync(buf.subarray(at, at + compressedLength))
  const tables = {}
  let offset = 0
  for (const { tag, length } of dir) {
    tables[tag] = data.subarray(offset, offset + length)
    offset += length
  }
  return tables
}

/** The vertical metrics and average width a fallback is matched on. */
export function fontMetrics(file) {
  const t = tablesOf(file)
  if (!t.head || !t.hhea || !t["OS/2"]) throw new Error("woff2: head, hhea or OS/2 table missing")
  const unitsPerEm = t.head.readUInt16BE(18)
  const os2 = t["OS/2"]
  const useTypo = (os2.readUInt16BE(62) & (1 << 7)) !== 0 && os2.length >= 74
  return {
    unitsPerEm,
    ascent: useTypo ? os2.readInt16BE(68) : t.hhea.readInt16BE(4),
    descent: Math.abs(useTypo ? os2.readInt16BE(70) : t.hhea.readInt16BE(6)),
    lineGap: useTypo ? os2.readInt16BE(72) : t.hhea.readInt16BE(8),
    xAvgCharWidth: os2.readInt16BE(2),
    textWidth: textWidth(file),
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const pct = (v) => Math.round(v * 10000) / 100

/**
 * The fallback block of a feather-tokens font object: the local face scaled to the font's average width, and the
 * vertical metrics expressed in the scaled face's em, within the engine's bounds (expression.mjs FALLBACK_BOUNDS).
 */
export function fallbackFor(metrics, face = "Arial") {
  const local = LOCAL_FACES[face]
  if (!local) throw new Error(`fallback face must be one of ${Object.keys(LOCAL_FACES).join(", ")}`)
  const size = metrics.textWidth / local
  return {
    family: face,
    sizeAdjust: clamp(pct(size), 50, 200),
    ascentOverride: clamp(pct(metrics.ascent / metrics.unitsPerEm / size), 50, 150),
    descentOverride: clamp(pct(metrics.descent / metrics.unitsPerEm / size), 0, 60),
    lineGapOverride: clamp(pct(metrics.lineGap / metrics.unitsPerEm / size), 0, 30),
  }
}
