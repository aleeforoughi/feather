// feather-tokens/4: the range layer (docs/visual-system.md section 14.5).
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  BLOCK_COUNT,
  FACE_WEIGHTS,
  measuredDisplay,
  LAYERS,
  LOUDNESS,
  OPACITY,
  PERSONALITIES,
  SIGNATURES,
  buildTheme,
  contrastRatio,
  type BrandTokens,
} from "../src/index.mjs"

const here = import.meta.dirname
const read = (p: string) => fs.readFileSync(path.join(here, p), "utf8")
const json = (p: string) => JSON.parse(read(p))
/** The variables of a theme, as the root declares them (the first declaration: the AAA block comes later). */
const vars = (css: string) => Object.fromEntries([...css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].reverse().map((m) => [m[1], m[2]]))
const built = (t: unknown) => {
  const r = buildTheme(t)
  if (!r.ok) throw new Error(r.problems.join("\n"))
  return r
}
const problems = (t: unknown) => {
  const r = buildTheme(t)
  return r.ok ? [] : r.problems
}
/** The variables /4 adds to a theme, and nothing else. */
const NEW_VARS = ["--loudness", ...Array.from({ length: BLOCK_COUNT }, (_, i) => [`--block-${i + 1}`, `--block-${i + 1}-ink`]).flat(), "--media-scrim", "--ink-on-media"]
const v4 = (t: BrandTokens, extra: Record<string, unknown> = {}) => ({ ...t, schema: "feather-tokens/4", ...extra }) as BrandTokens
const base = () => v4(json("../themes/feather.json").tokens, { focus: "primary" })

/** `rgb(r g b / a)` composited over a frame, per channel in sRGB, as a hex color. */
function over(scrim: string, frame: string) {
  const m = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(scrim)
  if (!m) throw new Error(`not an rgb() scrim: ${scrim}`)
  const a = Number(m[4])
  const f = [1, 3, 5].map((i) => parseInt(frame.slice(i, i + 2), 16))
  return `#${[m[1], m[2], m[3]].map((v, i) => Math.round(a * Number(v) + (1 - a) * f[i]).toString(16).padStart(2, "0")).join("")}`
}

/** Every reference theme, and a hostile brand (yellow on white), as /4. */
const REFERENCES = ["feather", "feather-dark", "paper-sharp", "void-pill", "studio", "portrait", "seed"]
// A yellow primary on white. Its focus ring is the darker accent: a yellow ring cannot reach 3:1 on white.
const hostile = (): BrandTokens => ({
  schema: "feather-tokens/4",
  colors: { primary: "#FFEB3B", accent: "#8A6D00", background: "#FFFFFF", surface: "#FFFFFF", text: "#111111" },
  typography: { fontFamily: { body: "Inter" } },
  focus: "accent",
})
// The product themes (written as /2) keep the focus ring they had when read as /4.
const brands = REFERENCES.map((n): [string, () => BrandTokens] => [n, () => {
  const t = json(`../themes/${n}.json`).tokens
  return v4(t, { focus: t.focus ?? "primary" })
}])

describe("feather-tokens/4: the measured defaults (Qooler file 28)", () => {
  const vars = (css: string) => Object.fromEntries([...css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
  const theme = (typography: Record<string, unknown>, extra: Record<string, unknown> = {}) => vars(built({ schema: "feather-tokens/4", colors: { primary: "#1f3fd1", background: "#ffffff", surface: "#f5f5f5", text: "#111111" }, typography, ...extra }).css)

  it("sets the heading and display weight by the display face's class, where the brand sets neither", () => {
    expect(FACE_WEIGHTS).toEqual({ serif: 400, mono: 400, grotesk: 500, rounded: 600 })
    for (const [face, weight] of [["Fraunces", "400"], ["JetBrains Mono", "400"], ["Inter", "500"], ["Nunito", "600"]]) {
      const v = theme({ fontFamily: { display: face, body: "Inter" } })
      expect([face, v["--heading-weight"], v["--display-weight"]]).toEqual([face, weight, weight])
    }
    // A brand that sets either keeps it: headingWeight for headings, contrast for display.
    const set = theme({ fontFamily: { display: "Fraunces", body: "Inter" }, headingWeight: 700 }, { contrast: "bold" })
    expect([set["--heading-weight"], set["--display-weight"]]).toEqual(["700", "700"])
    expect(theme({ fontFamily: { display: "Fraunces", body: "Inter" } }, { contrast: "quiet" })["--display-weight"]).toBe("500")
  })

  it("writes the measured display scale for what the brand leaves unset, and keeps what it sets", () => {
    const grotesk = measuredDisplay("grotesk")
    expect(grotesk.xl.leading).toBeGreaterThanOrEqual(0.95)
    expect(grotesk.xl.leading).toBeLessThanOrEqual(0.98)
    expect([grotesk.xl.tracking.min, grotesk.xl.tracking.max]).toEqual([-0.01, -0.03])
    expect(measuredDisplay("serif").xl.tracking).toEqual({ min: -0.005, max: -0.02 })
    expect(measuredDisplay("mono").xl.tracking).toEqual({ min: 0, max: 0 })
    // Graded toward body, step by step.
    const leading = (["xl", "l", "m", "s"] as const).map((k) => grotesk[k].leading)
    expect([...leading].sort((a, b) => a - b)).toEqual(leading)
    const v = theme({ fontFamily: { display: "Inter", body: "Inter" }, display: { xl: { leading: 0.86, size: { min: 3.5, max: 10 } } } })
    expect(v["--display-xl-leading"]).toBe("0.86")
    expect(v["--display-l-leading"]).toBe("1")
  })

  it("puts each step on a phone (390 px) at about 0.45 to 0.6 of its desktop size", () => {
    const at = (min: number, max: number, w: number) => min + ((max - min) * (w - 360)) / 1080
    for (const [step, share] of [["xl", 0.45], ["l", 0.5], ["m", 0.55], ["s", 0.6]] as const) {
      const { size } = measuredDisplay("grotesk")[step]
      expect(at(size.min, size.max, 390) / size.max, step).toBeCloseTo(share, 1)
    }
  })

  it("gives a /3 brand none of them: its display scale and weights stay the house's", () => {
    const v = vars(built({ ...json("golden/v3-brands.json").portrait }).css)
    expect(v["--heading-weight"]).toBeUndefined()
    expect(v["--display-xl-leading"]).toBe("0.9")
  })
})

describe("feather-tokens/4 is additive", () => {
  it.each(["studio", "portrait", "seed"])("writes the %s theme as its /3 theme plus exactly the new variables", (name) => {
    const v3 = json("golden/v3-brands.json")[name]
    // The deliberate changes in existing lines: /4 adds each foundation family's metric-matched fallback face to the
    // font stacks (src/fallbacks.mjs), and what the brand leaves unset of the display scale and the heading weight is
    // the measured defaults (the next describe). Without them, the theme is the /3 theme plus the new variables.
    const measured = (css: string) => css.split("\n").filter((l) => !/^\s*--(display-(xl|l|m|s)-(size|tracking|leading)|display-weight|heading-weight):/.test(l)).join("\n")
    const unmatched = (css: string) => measured(css.replace(/, "[^"]+ Fallback"/g, ""))
    const [before, after] = [measured(built(v3).css), unmatched(built({ ...v3, schema: "feather-tokens/4" }).css)]
    const added = after.split("\n").filter((line) => !before.split("\n").includes(line))
    expect(added.map((l) => l.trim().split(":")[0])).toEqual(NEW_VARS)
    // Remove the new lines and the theme is the /3 theme, byte for byte.
    expect(after.split("\n").filter((line) => !added.includes(line)).join("\n")).toBe(before)
  })

  it("gives a /4 brand's foundation families their metric-matched fallback faces, and a /3 brand none", () => {
    const v3 = json("golden/v3-brands.json").studio
    const v4theme = built({ ...v3, schema: "feather-tokens/4" })
    expect(v4theme.css).toMatch(/--brand-font-display: "Space Grotesk Variable", "Space Grotesk Variable Fallback", sans-serif/)
    expect(v4theme.fonts).toContain('font-family: "Space Grotesk Variable Fallback";')
    expect(v4theme.fonts).toMatch(/size-adjust: \d+(\.\d+)?%;/)
    expect(built(v3).fonts).not.toContain("Fallback")
  })

  it("writes none of the new variables for a /2 or /3 brand, which keep the foundation's house defaults", () => {
    for (const schema of ["feather-tokens/2", "feather-tokens/3"]) {
      const css = built({ ...json("../themes/feather.json").tokens, schema, focus: "primary" }).css
      for (const name of NEW_VARS) expect(css, `${schema} ${name}`).not.toContain(`${name}:`)
    }
  })

  it("asks for /4 when an older document uses a /4 field, and lists every one", () => {
    const v3 = { ...json("../themes/feather.json").tokens, schema: "feather-tokens/3", focus: "primary", loudness: 2, personality: "calm", colors: { ...json("../themes/feather.json").tokens.colors, blocks: [], mediaScrim: "#000000", inkOnMedia: "#ffffff" } }
    expect(problems(v3)).toEqual(["loudness", "colors.blocks", "colors.mediaScrim", "colors.inkOnMedia", "personality"].map((f) => `${f} needs "schema": "feather-tokens/4"`))
  })

  it("reads the upgraded reference themes as /4, with a loudness that fits each", () => {
    const loudness = Object.fromEntries(["studio", "portrait", "seed"].map((n) => [n, built(json(`../themes/${n}.json`).tokens).summary.loudness]))
    expect(loudness).toEqual({ studio: 2, portrait: 1, seed: 2 })
    // The four product themes stay as they were written.
    for (const n of ["feather", "feather-dark", "paper-sharp", "void-pill"]) expect(json(`../themes/${n}.json`).tokens.schema ?? "qooe-tokens/1", n).not.toBe("feather-tokens/4")
  })
})

describe("loudness", () => {
  it("defaults to 1 and writes --loudness on the theme root", () => {
    const t = built(base())
    expect(vars(t.css)["--loudness"]).toBe("1")
    expect(t.summary.loudness).toBe(1)
    for (const n of LOUDNESS) expect(vars(built(v4(base(), { loudness: n })).css)["--loudness"]).toBe(String(n))
  })

  it.each([4, -1, 1.5, "2", null])("refuses %s", (loudness) => {
    expect(problems(v4(base(), { loudness })).join()).toMatch(/loudness must be 0, 1, 2 or 3/)
  })

  it("is listed with every other problem", () => {
    const p = problems(v4(base(), { loudness: 7, shape: "blob", personality: "loud", colors: { primary: "red" } }))
    expect(p.some((x) => /loudness must be/.test(x))).toBe(true)
    expect(p.some((x) => /personality must be one of calm, precise, playful, cinematic/.test(x))).toBe(true)
    expect(p.some((x) => /shape must be one of/.test(x))).toBe(true)
    expect(p.some((x) => /colors\.background must be a hex color/.test(x))).toBe(true)
  })
})

describe("personality", () => {
  it.each(Object.entries(PERSONALITIES))("%s sets pace and signature together", (name, preset) => {
    const t = built(v4(base(), { personality: name }))
    expect(t.summary).toMatchObject({ personality: name, pace: preset.pace, signature: preset.signature })
    const v = vars(t.css)
    expect(v["--ease-signature"]).toBe(`cubic-bezier(${SIGNATURES[preset.signature].join(", ")})`)
    // Playful turns on the overshoot; the others keep the signature there.
    expect(v["--ease-overshoot"] === v["--ease-signature"]).toBe(!preset.overshoot)
  })

  it("lets anything set explicitly win", () => {
    const t = built(v4(base(), { personality: "playful", signature: "sheet", overshoot: false }))
    expect(t.summary).toMatchObject({ personality: "playful", pace: "snappy", signature: "sheet" })
    expect(vars(t.css)["--ease-overshoot"]).toBe(vars(t.css)["--ease-signature"])
    expect(built(v4(base(), { personality: "cinematic", pace: "calm" })).summary.pace).toBe("calm")
    // An explicit product motion axis is kept, and a personality's pace never makes it disagree.
    expect(built(v4(base(), { personality: "playful", motion: "calm" })).summary).toMatchObject({ motion: "calm", pace: "snappy" })
  })

  it("writes the same theme as the pace and signature it stands for", () => {
    // Without the /2 product axis feather.json carries, so the durations follow the pace.
    const plain = { ...base(), motion: undefined }
    const short = built(v4(plain, { personality: "precise" })).css
    const long = built(v4(plain, { pace: "snappy", signature: "standard" })).css
    expect(short).toBe(long)
  })

  it("is a top-level field: a motion object is refused with the way to write it", () => {
    expect(problems(v4(base(), { motion: { personality: "calm" } })).join()).toMatch(/a motion personality is written as the top-level "personality"/)
    expect(problems(v4(base(), { personality: "loud" }))).toEqual(["personality must be one of calm, precise, playful, cinematic"])
  })
})

describe("colour blocks", () => {
  const pairs = (css: string) => {
    const v = vars(css)
    return Array.from({ length: BLOCK_COUNT }, (_, i) => [v[`--block-${i + 1}`], v[`--block-${i + 1}-ink`]] as const)
  }

  it.each([...brands, ["hostile (yellow on white)", hostile] as [string, () => BrandTokens]])("every block pair in %s reaches 4.5:1", (_, tokens) => {
    for (const [surface, ink] of pairs(built(tokens()).css)) {
      expect(contrastRatio(ink, surface), `${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("derives primary, accent, then two tonal surfaces from the palette", () => {
    const seed = json("../themes/seed.json").tokens
    const v = vars(built(seed).css)
    expect(v["--block-1"]).toBe(v["--primary"])
    // Seed's accent is its primary, so block 2 is the inverse surface and block 4 the muted ground.
    expect([v["--block-2"], v["--block-2-ink"]]).toEqual([v["--surface-inverse"], v["--text-inverse"]])
    const portrait = vars(built(json("../themes/portrait.json").tokens).css)
    expect(portrait["--block-2"]).toBe("#7a4e1d") // its own accent
    expect([portrait["--block-4"], portrait["--block-4-ink"]]).toEqual([portrait["--surface-inverse"], portrait["--text-inverse"]])
  })

  it("fixes a derived ink that does not read: yellow takes a dark ink", () => {
    const v = vars(built(hostile()).css)
    expect(v["--block-1"]).toBe("#ffeb3b")
    expect(contrastRatio(v["--block-1-ink"], "#ffeb3b")).toBeGreaterThanOrEqual(4.5)
    expect(v["--block-1-ink"]).not.toBe("#ffffff")
  })

  it("takes a brand's own blocks, derives an ink it leaves out, and refuses one that does not read", () => {
    const own = built(v4(base(), { colors: { ...base().colors, blocks: [{ surface: "#0B3D2E", ink: "#F2E9D8" }, { surface: "#FFEB3B" }] } }))
    const v = vars(own.css)
    expect([v["--block-1"], v["--block-1-ink"]]).toEqual(["#0b3d2e", "#f2e9d8"])
    expect(v["--block-2"]).toBe("#ffeb3b")
    expect(contrastRatio(v["--block-2-ink"], "#ffeb3b")).toBeGreaterThanOrEqual(4.5)
    // Blocks 3 and 4 still come from the palette.
    expect(v["--block-3"]).toBe(vars(built(base()).css)["--block-3"])

    const yellowOnWhite = problems(v4(hostile(), { colors: { ...hostile().colors, blocks: [{ surface: "#FFFF00", ink: "#FFFFFF" }, { surface: "#FFEB3B", ink: "#FFF59D" }] } }))
    expect(yellowOnWhite).toHaveLength(2)
    expect(yellowOnWhite[0]).toMatch(/^colors\.blocks\[0\]: ink #FFFFFF reaches 1\.\d\d:1 on #FFFF00; a block's ink needs 4\.5:1/)
    expect(yellowOnWhite[1]).toMatch(/^colors\.blocks\[1\]: ink #FFF59D/)
  })

  it("lists every malformed block", () => {
    const p = problems(v4(base(), { colors: { ...base().colors, blocks: [{ surface: "teal" }, { surface: "#000", ink: "white", tone: 1 }, "x", {}, { surface: "#fff" }] } }))
    expect(p).toEqual([
      "colors.blocks has 5 entries; a brand has at most 4 (block-1 to block-4)",
      "colors.blocks[0].surface must be a hex color",
      "colors.blocks[1].tone is not a block field (surface, ink)",
      "colors.blocks[1].ink must be a hex color",
      'colors.blocks[2] must be { "surface": hex, "ink": hex }',
      "colors.blocks[3].surface must be a hex color",
    ])
    expect(problems(v4(base(), { colors: { ...base().colors, blocks: { surface: "#000" } } }))).toEqual(['colors.blocks must be a list of up to 4 { "surface", "ink" } pairs'])
  })
})

describe("the media scrim", () => {
  it.each([...brands, ["hostile (yellow on white)", hostile] as [string, () => BrandTokens]])("carries --ink-on-media at 4.5:1 over a white and a black frame in %s", (_, tokens) => {
    const v = vars(built(tokens()).css)
    for (const frame of ["#ffffff", "#000000"]) {
      expect(contrastRatio(v["--ink-on-media"], over(v["--media-scrim"], frame)), `${v["--ink-on-media"]} on ${v["--media-scrim"]} over ${frame}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("is the inverse surface at about 60%, raised only as far as the ink needs", () => {
    const v = vars(built(base()).css)
    expect(v["--media-scrim"]).toBe("rgb(24 24 27 / 0.62)")
    expect(v["--ink-on-media"]).toBe(v["--text-inverse"])
    const dark = vars(built(v4(json("../themes/feather-dark.json").tokens, { focus: "primary" })).css)
    expect(dark["--media-scrim"]).toBe("rgb(237 237 239 / 0.6)")
  })

  it("takes a brand's scrim and ink, and refuses an ink no opacity up to 90% can carry", () => {
    const v = vars(built(v4(base(), { colors: { ...base().colors, mediaScrim: "#0B3D2E", inkOnMedia: "#FFFFFF" } })).css)
    expect(v["--media-scrim"]).toMatch(/^rgb\(11 61 46 \/ 0\.\d+\)$/)
    expect(v["--ink-on-media"]).toBe("#ffffff")
    expect(problems(v4(base(), { colors: { ...base().colors, mediaScrim: "#808080", inkOnMedia: "#FFFFFF" } })).join()).toMatch(/the media scrim \(#808080 up to 90%\) cannot carry --ink-on-media \(#ffffff\)/)
    expect(problems(v4(base(), { colors: { ...base().colors, inkOnMedia: "white" } })).join()).toMatch(/colors\.inkOnMedia must be a hex color/)
  })
})

describe("foundation.css: the /4 house roles", () => {
  const foundation = read("../css/foundation.css")
  const house = vars(foundation.split("@layer base")[1] ?? "")

  it("declares the layers and opacity roles as house constants, with their utilities", () => {
    for (const [name, z] of Object.entries(LAYERS)) {
      expect(house[`--layer-${name}`], name).toBe(String(z))
      expect(foundation).toMatch(new RegExp(`@utility z-layer-${name} \\{\\s*z-index: var\\(--layer-${name}\\);\\s*\\}`))
    }
    for (const [name, value] of Object.entries(OPACITY)) {
      if (name !== "disabled") expect(house[`--opacity-${name}`], name).toBe(String(value))
      expect(foundation).toMatch(new RegExp(`@utility opacity-${name} \\{\\s*opacity: var\\(--opacity-${name}\\);\\s*\\}`))
    }
    expect(house["--loudness"]).toBe("1")
  })

  it("maps every block, the media scrim and its ink into Tailwind, with a default for every brand", () => {
    for (const name of NEW_VARS.filter((n) => n !== "--loudness")) {
      expect(foundation, name).toContain(`--color-${name.slice(2)}: var(${name});`)
      expect(house[name], name).toBeDefined()
    }
    // The dialog scrim (bg-scrim) is product UI's and keeps its own role.
    expect(foundation).toContain("--color-scrim: var(--scrim);")
  })

  it("defaults the media scrim to at least the opacity the engine solves for the default themes", () => {
    const pct = Number(/--media-scrim: color-mix\(in oklab, var\(--surface-inverse\) (\d+)%, transparent\)/.exec(foundation)?.[1])
    for (const n of ["feather", "feather-dark"]) {
      const alpha = Number(/\/ ([\d.]+)\)$/.exec(vars(built(v4(json(`../themes/${n}.json`).tokens, { focus: "primary" })).css)["--media-scrim"])?.[1])
      expect(pct / 100, n).toBeGreaterThanOrEqual(alpha)
    }
  })

  it("matches the default theme's blocks to the engine where the palette has no separate accent", () => {
    const engine = vars(built(base()).css)
    const theme = vars(foundation.split("/* default-theme:start")[1].split("\n.dark {")[0])
    const resolve = (v: string): string => (v.startsWith("var(") ? resolve(theme[v.slice(4, -1)]) : v)
    for (const name of ["--block-1", "--block-1-ink", "--block-2", "--block-2-ink", "--block-3-ink", "--block-4-ink", "--ink-on-media"]) {
      expect(resolve(house[name]), name).toBe(engine[name])
    }
  })
})

describe("schema/feather-tokens-4.json", () => {
  const schema = json("../schema/feather-tokens-4.json")
  const v3 = json("../schema/feather-tokens-3.json")
  it("is /3 plus the range fields, with exactly the engine's values", () => {
    expect(schema.properties.schema.const).toBe("feather-tokens/4")
    expect(schema.properties.loudness.enum).toEqual([...LOUDNESS])
    expect(schema.properties.personality.enum).toEqual(Object.keys(PERSONALITIES))
    expect(schema.properties.colors.properties.blocks.maxItems).toBe(BLOCK_COUNT)
    expect(Object.keys(schema.properties.colors.properties.blocks.items.properties)).toEqual(["surface", "ink"])
    expect(schema.properties.colors.properties.mediaScrim.pattern).toBe(v3.properties.colors.properties.primary.pattern)
    // Everything /3 has, /4 has unchanged.
    for (const [key, value] of Object.entries(v3.properties)) if (key !== "schema" && key !== "colors") expect(schema.properties[key], key).toEqual(value)
    expect(schema.$defs).toEqual(v3.$defs)
  })
})
