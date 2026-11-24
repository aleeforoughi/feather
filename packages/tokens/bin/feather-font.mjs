#!/usr/bin/env node
// feather-font: any open font, self-hosted, with a metric-matched fallback, ready for a feather-tokens/3+ brand.
//
//   feather-font add <family> [--weights 400,700] [--styles normal,italic] [--subset latin]
//                    [--out public/fonts] [--base /fonts] [--cache <dir>] [--from <dir>]
//                    [--brand brand/tokens.json --role display|body|mono|voice] [--preload]
//
// It downloads the WOFF2 files once from Fontsource (open fonts only, the licence is printed), keeps them in a cache,
// copies them into --out, reads each file's metrics, and prints the font object (family, files, fallback with
// size-adjust and the ascent, descent and line-gap overrides). With --brand it writes the object into the brand
// file's typography.fontFamily[role]. A variable font is preferred when Fontsource has one. --from reads the WOFF2
// files from a local folder instead of the network (named [<id>-]<subset>-<weight|wght>-<style>.woff2, as Fontsource's
// packages name them).

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fallbackFace, fallbackFor, fontMetrics } from "../src/fontmetrics.mjs"

const [command, family, ...rest] = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = rest.indexOf(name)
  return i === -1 ? fallback : rest[i + 1]
}
const has = (name) => rest.includes(name)
const usage = () => {
  console.error("usage: feather-font add <family> [--weights 400,700] [--styles normal] [--subset latin] [--out dir] [--base /fonts] [--cache dir] [--from dir] [--brand tokens.json --role display|body|mono|voice] [--preload]")
  process.exit(2)
}
if (command !== "add" || !family) usage()

const id = family.trim().toLowerCase().replace(/\s+/g, "-")
if (!/^[a-z0-9-]+$/.test(id)) {
  console.error(`"${family}" is not a font family name`)
  process.exit(2)
}
const subset = flag("--subset", "latin")
const styles = flag("--styles", "normal").split(",")
const cacheDir = flag("--cache", process.env.FEATHER_FONT_CACHE ?? path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"), "feather", "fonts"))
const outDir = flag("--out", path.join("public", "fonts"))
const base = flag("--base", "/fonts").replace(/\/$/, "")
const from = flag("--from")

/** What Fontsource says about the family (offline with --from: a variable sans unless told otherwise). */
async function metadata() {
  if (from) return { family, category: flag("--category", "sans-serif"), variable: !flag("--weights"), weights: [400], styles, license: flag("--license", "see the font's own licence"), subsets: [subset] }
  const res = await fetch(`https://api.fontsource.org/v1/fonts/${id}`)
  if (!res.ok) throw new Error(`Fontsource has no open font "${family}" (${res.status})`)
  const m = await res.json()
  return { family: m.family, category: m.category, variable: !!m.variable && !flag("--weights"), weights: m.weights, styles: m.styles, license: m.license?.type ?? m.license ?? "unknown", subsets: m.subsets }
}

/** One WOFF2 file: from the cache, or downloaded once into it. */
async function file(name, url) {
  fs.mkdirSync(path.join(cacheDir, id), { recursive: true })
  const cached = path.join(cacheDir, id, name)
  if (fs.existsSync(cached)) return cached
  if (from) {
    const bare = name.startsWith(`${id}-`) ? name.slice(id.length + 1) : name
    const local = [path.join(from, name), path.join(from, bare)].find((p) => fs.existsSync(p))
    if (!local) throw new Error(`${name} (or ${bare}) is not in ${from}`)
    fs.copyFileSync(local, cached)
    return cached
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`could not download ${url} (${res.status})`)
  const tmp = `${cached}.part`
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
  fs.renameSync(tmp, cached)
  return cached
}

const meta = await metadata()
if (!meta.subsets.includes(subset)) throw new Error(`${meta.family} has no "${subset}" subset (${meta.subsets.join(", ")})`)
const weights = meta.variable ? ["wght"] : (flag("--weights")?.split(",") ?? [String(meta.weights.includes(400) ? 400 : meta.weights[0])])
const files = []
let metrics = null
for (const style of styles) {
  if (!meta.styles.includes(style)) throw new Error(`${meta.family} has no ${style} style (${meta.styles.join(", ")})`)
  for (const weight of weights) {
    const name = `${id}-${subset}-${weight}-${style}.woff2`
    const url = meta.variable ? `https://cdn.jsdelivr.net/fontsource/fonts/${id}:vf@latest/${subset}-wght-${style}.woff2` : `https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/${subset}-${weight}-${style}.woff2`
    const cached = await file(name, url)
    fs.mkdirSync(path.join(outDir, id), { recursive: true })
    fs.copyFileSync(cached, path.join(outDir, id, name))
    if (!metrics || (style === "normal" && (weight === "wght" || weight === "400"))) metrics = fontMetrics(fs.readFileSync(cached))
    files.push({ src: `${base}/${id}/${name}`, weight: weight === "wght" ? [100, 900] : Number(weight), style })
  }
}

const generic = meta.category === "serif" ? "serif" : meta.category === "monospace" ? "monospace" : "sans-serif"
const font = { family: meta.family, files, fallback: fallbackFor(metrics, fallbackFace(meta.category)), generic, ...(has("--preload") ? { preload: true } : {}) }

const brandPath = flag("--brand")
if (brandPath) {
  const role = flag("--role", "display")
  if (!["display", "body", "mono", "voice"].includes(role)) usage()
  const doc = JSON.parse(fs.readFileSync(brandPath, "utf8"))
  const tokens = doc.tokens ?? doc
  tokens.typography ??= {}
  if (role === "voice") tokens.typography.voiceFace = font
  else {
    tokens.typography.fontFamily ??= {}
    tokens.typography.fontFamily[role] = font
  }
  fs.writeFileSync(brandPath, `${JSON.stringify(doc, null, 2)}\n`)
  console.error(`${meta.family} set as the ${role} face of ${brandPath}`)
}
console.error(`${meta.family}: ${files.length} file${files.length === 1 ? "" : "s"} in ${path.join(outDir, id)}, licence ${meta.license}`)
console.log(JSON.stringify(font, null, 2))
