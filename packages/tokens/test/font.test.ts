// feather-font and the WOFF2 metrics reader: an open font, self-hosted, with a fallback that matches its width and
// vertical metrics, so the swap shifts nothing. Offline: the fonts come from the Fontsource packages already installed.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"
import { fallbackFace, fallbackFor, fontMetrics, LOCAL_FACES, textWidth, woff2Tables } from "../src/fontmetrics.mjs"
import { buildTheme } from "../src/index.mjs"

const require = createRequire(import.meta.url)
const fileOf = (pkg: string, name: string) => path.join(path.dirname(require.resolve(`${pkg}/package.json`)), "files", name)
const INTER = fileOf("@fontsource-variable/inter", "inter-latin-wght-normal.woff2")
const FRAUNCES = fileOf("@fontsource-variable/fraunces", "fraunces-latin-wght-normal.woff2")
const BIN = path.join(import.meta.dirname, "../bin/feather-font.mjs")

describe("fontMetrics", () => {
  it("reads the vertical metrics and units per em from a WOFF2 file", () => {
    const m = fontMetrics(fs.readFileSync(INTER))
    expect(m).toMatchObject({ unitsPerEm: 2048, ascent: 1984, descent: 494, lineGap: 0 })
    expect(Object.keys(woff2Tables(fs.readFileSync(INTER)))).toEqual(expect.arrayContaining(["head", "hhea", "OS/2", "cmap", "hmtx"]))
  })
  it("measures the width of text, not the average glyph", () => {
    const m = fontMetrics(fs.readFileSync(INTER))
    // OS/2 xAvgCharWidth (1250/2048 = 0.61em) counts every glyph; English text in Inter averages about 0.47em.
    expect(m.xAvgCharWidth / m.unitsPerEm).toBeGreaterThan(0.6)
    expect(m.textWidth).toBeGreaterThan(0.46)
    expect(m.textWidth).toBeLessThan(0.48)
    expect(textWidth(fs.readFileSync(INTER))).toBe(m.textWidth)
  })
  it("matches a fallback within half a percent of the values Next.js generates for Inter on Arial (107.1%, 90.5%, 22.6%; unverified)", () => {
    const f = fallbackFor(fontMetrics(fs.readFileSync(INTER)), "Arial")
    expect(f.family).toBe("Arial")
    expect(Math.abs(f.sizeAdjust - 107.12)).toBeLessThan(0.5)
    expect(Math.abs(f.ascentOverride - 90.49)).toBeLessThan(0.5)
    expect(Math.abs(f.descentOverride - 22.56)).toBeLessThan(0.5)
    expect(f.lineGapOverride).toBe(0)
  })
  it("picks the local face by category and stays within the engine's bounds", () => {
    expect([fallbackFace("serif"), fallbackFace("monospace"), fallbackFace("display"), fallbackFace("sans-serif")]).toEqual(["Times New Roman", "Courier New", "Arial", "Arial"])
    const f = fallbackFor(fontMetrics(fs.readFileSync(FRAUNCES)), "Times New Roman")
    expect(f.sizeAdjust).toBeGreaterThanOrEqual(50)
    expect(f.sizeAdjust).toBeLessThanOrEqual(200)
    expect(Object.keys(LOCAL_FACES)).toEqual(["Arial", "Helvetica", "Helvetica Neue", "Times New Roman", "Georgia", "Courier New"])
    expect(() => fallbackFor(fontMetrics(fs.readFileSync(INTER)), "Comic Sans MS")).toThrow(/fallback face/)
  })
  it("refuses a file that is not WOFF2", () => {
    expect(() => woff2Tables(Buffer.from("not a font"))).toThrow(/WOFF2/)
  })
})

describe("feather-font add", () => {
  it("self-hosts the font, caches it once, and writes a font object the engine builds", () => {
    const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), "feather-font-"))
    const brand = path.join(dir, "brand.json")
    fs.copyFileSync(path.join(import.meta.dirname, "../themes/seed.json"), brand)
    const run = () => JSON.parse(execFileSync("node", [BIN, "add", "Inter", "--from", path.dirname(INTER), "--cache", path.join(dir, "cache"), "--out", path.join(dir, "public/fonts"), "--brand", brand, "--role", "display", "--preload"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))
    const font = run()
    expect(font).toMatchObject({ family: "Inter", generic: "sans-serif", preload: true, files: [{ src: "/fonts/inter/inter-latin-wght-normal.woff2", weight: [100, 900], style: "normal" }] })
    expect(fs.existsSync(path.join(dir, "public/fonts/inter/inter-latin-wght-normal.woff2"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "cache/inter/inter-latin-wght-normal.woff2"))).toBe(true)
    expect(run()).toEqual(font)
    const theme = buildTheme(JSON.parse(fs.readFileSync(brand, "utf8")).tokens)
    expect(theme.ok).toBe(true)
    if (!theme.ok) return
    expect(theme.fonts).toContain('font-family: "Inter Fallback"')
    expect(theme.fonts).toContain("size-adjust: 107.35%")
    expect(theme.css).toContain('--brand-font-display: "Inter", "Inter Fallback", sans-serif')
    expect(theme.preload.map((p) => p.href)).toEqual(["/fonts/inter/inter-latin-wght-normal.woff2"])
  })
  it("refuses a name that is not a font family", () => {
    expect(() => execFileSync("node", [BIN, "add", "../etc"], { stdio: "pipe" })).toThrow()
  })
})

describe("src/fallbacks.mjs", () => {
  it("is generated from the installed foundation fonts (run `node packages/tokens/scripts/foundation-fallbacks.mjs`)", async () => {
    const { FOUNDATION_FALLBACKS } = await import("../src/fallbacks.mjs")
    const { FONTS, STATIC_FONT_WEIGHTS } = await import("../src/engine.mjs")
    expect(Object.keys(FOUNDATION_FALLBACKS)).toEqual(Object.keys(FONTS))
    for (const [family, pkg] of Object.entries(FONTS as Record<string, string>)) {
      const slug = path.basename(pkg)
      const name = (STATIC_FONT_WEIGHTS as Record<string, number[]>)[family] ? `${slug}-latin-400-normal.woff2` : `${slug}-latin-wght-normal.woff2`
      const face = (FOUNDATION_FALLBACKS as Record<string, { family: string }>)[family].family
      expect((FOUNDATION_FALLBACKS as Record<string, unknown>)[family], family).toEqual(fallbackFor(fontMetrics(fs.readFileSync(fileOf(pkg, name))), face))
    }
  })
})
