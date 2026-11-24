// feather-tokens/3: the expression layer (docs/visual-system.md section 14).
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  CONTRASTS,
  DISPLAY_DEFAULTS,
  EASE_STANDARD,
  EXPRESSION_ROLES,
  FONTS,
  PACES,
  SIGNATURES,
  SURFACES,
  buildTheme,
  fluidClamp,
  fluidTracking,
  type BrandTokens,
} from "../src/index.mjs"

const here = import.meta.dirname
const json = (p: string) => JSON.parse(fs.readFileSync(path.join(here, p), "utf8"))
const base = (): BrandTokens => ({ ...json("../themes/feather.json").tokens, schema: "feather-tokens/3", focus: "primary" })
const v3 = (extra: Record<string, unknown> = {}) => ({ ...base(), ...extra }) as BrandTokens
const vars = (css: string) => Object.fromEntries([...css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2]]))
const built = (t: unknown) => {
  const r = buildTheme(t)
  if (!r.ok) throw new Error(r.problems.join("\n"))
  return r
}
const problems = (t: unknown) => {
  const r = buildTheme(t)
  return r.ok ? [] : r.problems
}

/** Evaluates `clamp(lo rem, a rem ± b vw, hi rem)` at a viewport width in px, in rem. */
function evalClamp(expr: string, width: number) {
  const m = /^clamp\((-?[\d.]+)rem, (-?[\d.]+)rem ([+-]) ([\d.]+)vw, (-?[\d.]+)rem\)$/.exec(expr)
  if (!m) return Number.parseFloat(expr)
  const [lo, a, sign, b, hi] = [Number(m[1]), Number(m[2]), m[3], Number(m[4]), Number(m[5])]
  const v = a + ((sign === "-" ? -b : b) * width) / 100 / 16
  return Math.min(hi, Math.max(lo, v))
}

describe("feather-tokens/3 is additive", () => {
  it("writes a /2 brand's theme exactly as before, and a /3 brand's as the same theme plus the expression block", () => {
    const v2 = json("../themes/feather.json").tokens
    const before = built(v2).css
    expect(before).not.toContain("--ease-signature")
    const after = built({ ...v2, schema: "feather-tokens/3", focus: "primary" }).css
    expect(after).toContain("--ease-signature")
    // Every /2 variable keeps its value.
    const [a, b] = [vars(before), vars(after)]
    for (const [k, v] of Object.entries(a)) expect([k, b[k]]).toEqual([k, v])
  })

  it("keeps product UI on --ease-standard and the six durations", () => {
    const t = built(v3({ pace: "cinematic", signature: "scout" }))
    const v = vars(t.css)
    expect(v["--ease-standard"]).toBe(EASE_STANDARD)
    expect(v["--motion-ease"]).toBe("var(--ease-standard)")
    expect(v["--duration-base"]).toBe("180ms") // cinematic runs product UI calm
    const foundation = fs.readFileSync(path.join(here, "../css/foundation.css"), "utf8")
    for (const role of ["press", "focus", "hover", "state", "switch", "tooltip", "popover", "panel", "dialog", "toast", "page"]) {
      const rule = new RegExp(`@utility motion-${role} \\{[^}]*\\}`).exec(foundation)?.[0] ?? ""
      expect(rule, role).toContain("var(--ease-standard)")
      expect(rule, role).not.toContain("--ease-signature")
    }
    for (const role of ["reveal", "media", "scene", "hover-out"]) {
      const rule = new RegExp(`@utility motion-${role} \\{[^}]*\\}`).exec(foundation)?.[0] ?? ""
      expect(rule, role).toContain("var(--ease-signature)")
      expect(rule, role).not.toMatch(/transition-property:[^;]*\ball\b/)
    }
  })

  it("matches foundation.css's house defaults to what the engine writes for a plain /3 brand", () => {
    const foundation = vars(fs.readFileSync(path.join(here, "../css/foundation.css"), "utf8").split("@layer base")[1] ?? "")
    const engine = vars(built(base()).css)
    for (const k of Object.keys(engine).filter((k) => /^--(display|title|body-wrap|numeric|ease-signature|ease-overshoot|duration-(reveal|media|scene|hover-out|reduced)|stagger|distance|scale-media|spring|sequence|reduced|surface-kind|expression|overlay|grain|ring-width|ring-offset)/.test(k))) {
      expect([k, foundation[k]]).toEqual([k, engine[k]])
    }
  })
})

describe("motion", () => {
  it("offers the house signatures and writes the chosen one", () => {
    expect(Object.keys(SIGNATURES)).toEqual(["expo-out", "quint-out", "sine-out", "scout", "sheet", "standard"])
    expect(vars(built(v3({ signature: "scout" })).css)["--ease-signature"]).toBe("cubic-bezier(0.38, 0.005, 0.215, 1)")
    expect(vars(built(v3()).css)["--ease-signature"]).toBe("cubic-bezier(0.19, 1, 0.22, 1)")
  })

  it("accepts a bounded custom curve and rejects one that runs time backwards or overshoots unasked", () => {
    expect(vars(built(v3({ signature: { cubicBezier: [0.3, 0.1, 0.2, 1] } })).css)["--ease-signature"]).toBe("cubic-bezier(0.3, 0.1, 0.2, 1)")
    expect(problems(v3({ signature: { cubicBezier: [1.2, 0, 0.2, 1] } })).join()).toMatch(/x values must be in \[0, 1\]/)
    expect(problems(v3({ signature: { cubicBezier: [0.3, 1.4, 0.6, 1] } })).join()).toMatch(/overshoots/)
    expect(problems(v3({ overshoot: true, signature: { cubicBezier: [0.3, 1.4, 0.6, 1] } }))).toEqual([])
    expect(problems(v3({ overshoot: true, signature: { cubicBezier: [0.3, 1.7, 0.6, 1] } })).join()).toMatch(/y values must be in/)
    expect(problems(v3({ signature: "bouncy" })).join()).toMatch(/signature must be one of/)
  })

  it("keeps the overshoot curve off unless the brand turns it on, capped at (.34, 1.56, .64, 1)", () => {
    const off = vars(built(v3()).css)
    expect(off["--ease-overshoot"]).toBe(off["--ease-signature"])
    expect(vars(built(v3({ overshoot: true })).css)["--ease-overshoot"]).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)")
  })

  it.each(PACES)("writes the %s expression roles, every sequence within 1.2s", (pace) => {
    const v = vars(built(v3({ pace, motion: undefined })).css)
    const r = EXPRESSION_ROLES[pace]
    expect(v["--duration-reveal"]).toBe(`${r.reveal}ms`)
    expect(v["--duration-scene"]).toBe(`${r.scene}ms`)
    expect(v["--stagger-word"]).toBe(`${r.staggerWord}ms`)
    expect(v["--sequence-cap"]).toBe("1200ms")
    for (const ms of [r.reveal, r.media, r.scene]) expect(ms).toBeLessThanOrEqual(1200)
    expect(r.hoverOut).toBeGreaterThan(140) // the exit is slower than the hover entry
  })

  it("matches the spec's calm and cinematic table", () => {
    expect(EXPRESSION_ROLES.calm).toMatchObject({ reveal: 700, media: 800, scene: 900, staggerWord: 40, staggerBlock: 100, hoverOut: 280 })
    expect(EXPRESSION_ROLES.cinematic).toMatchObject({ reveal: 900, media: 1000, scene: 1200, staggerWord: 60, staggerBlock: 120, hoverOut: 320 })
  })

  it("maps every expression role under reduced motion, and only lets a brand make one quieter", () => {
    const v = vars(built(v3({ reduced: { reveal: "none" } })).css)
    expect(v["--reduced-reveal"]).toBe("none")
    expect(v["--reduced-media"]).toBe("fade")
    expect(v["--reduced-stagger"]).toBe("none")
    expect(v["--duration-reduced"]).toBe("150ms")
    expect(problems(v3({ reduced: { stagger: "fade" } })).join()).toMatch(/can only get quieter/)
    expect(problems(v3({ reduced: { wobble: "none" } })).join()).toMatch(/not an expression role/)
  })

  it("bounds the spring", () => {
    expect(vars(built(v3({ spring: { bounce: 0.25 } })).css)["--spring-bounce"]).toBe("0.25")
    expect(problems(v3({ spring: { bounce: 0.4 } })).join()).toMatch(/spring\.bounce/)
  })

  it("rejects a pace the motion axis contradicts", () => {
    expect(problems(v3({ motion: "snappy", pace: "calm" })).join()).toMatch(/disagree/)
    expect(problems(v3({ motion: "calm", pace: "cinematic" }))).toEqual([])
    expect(vars(built(v3({ motion: undefined, pace: "snappy" })).css)["--duration-base"]).toBe("140ms")
  })
})

describe("type", () => {
  it("compiles a fluid size that is exact at 360px and 1440px", () => {
    for (const [min, max] of [[3, 9], [2, 4.5], [1.5, 3]]) {
      const expr = fluidClamp(min, max)
      expect(evalClamp(expr, 360)).toBeCloseTo(min, 3)
      expect(evalClamp(expr, 1440)).toBeCloseTo(max, 3)
      expect(evalClamp(expr, 200)).toBeCloseTo(min, 3)
      expect(evalClamp(expr, 2560)).toBeCloseTo(max, 3)
      expect(evalClamp(expr, 900)).toBeCloseTo((min + max) / 2, 3)
    }
  })

  it("tightens tracking as the type grows", () => {
    const { size, tracking } = DISPLAY_DEFAULTS.xl
    const expr = fluidTracking(size, tracking)
    expect(evalClamp(expr, 360)).toBeCloseTo(tracking.min * size.min, 3)
    expect(evalClamp(expr, 1440)).toBeCloseTo(tracking.max * size.max, 3)
    expect(evalClamp(expr, 1440)).toBeLessThan(evalClamp(expr, 360))
  })

  it("merges a brand's display steps over the defaults and checks the bounds", () => {
    const v = vars(built(v3({ typography: { ...base().typography, display: { xl: { size: { max: 10 }, leading: 0.8 } } } })).css)
    expect(evalClamp(v["--display-xl-size"], 1440)).toBeCloseTo(10, 3)
    expect(v["--display-xl-leading"]).toBe("0.8")
    const bad = (display: unknown) => problems(v3({ typography: { ...base().typography, display } })).join("\n")
    expect(bad({ xl: { leading: 0.6 } })).toMatch(/leading must be in \[0.72, 1.15\]/)
    expect(bad({ xl: { size: { max: 20 } } })).toMatch(/size must stay in/)
    expect(bad({ m: { tracking: { min: -0.04, max: -0.01 } } })).toMatch(/tracking tightens/)
    expect(bad({ s: { size: { min: 4, max: 8 } } })).toMatch(/must not be larger than m/)
    expect(bad({ xxl: {} })).toMatch(/not a display step/)
  })

  it("sets the display weight and tracking range from the contrast axis", () => {
    expect(CONTRASTS).toEqual({ quiet: { weight: 500, tighten: 1 }, bold: { weight: 700, tighten: 1.25 } })
    const [quiet, bold] = [vars(built(v3({ contrast: "quiet" })).css), vars(built(v3({ contrast: "bold" })).css)]
    expect(quiet["--display-weight"]).toBe("500")
    expect(bold["--display-weight"]).toBe("700")
    expect(evalClamp(bold["--display-xl-tracking"], 1440)).toBeLessThan(evalClamp(quiet["--display-xl-tracking"], 1440))
  })

  it("turns the type features on by default and off one by one", () => {
    const on = vars(built(v3()).css)
    expect([on["--title-wrap"], on["--body-wrap"], on["--numeric-figures"]]).toEqual(["balance", "pretty", "tabular-nums"])
    const off = vars(built(v3({ typography: { ...base().typography, features: { tabularNums: false, prettyBody: false } } })).css)
    expect([off["--title-wrap"], off["--body-wrap"], off["--numeric-figures"]]).toEqual(["balance", "wrap", "normal"])
  })

  const brier = {
    family: "Brier",
    files: [{ src: "/fonts/brier-var.woff2", weight: [300, 800] }, { src: "fonts/brier-italic.woff2", weight: 400, style: "italic" }],
    fallback: { family: "Arial", sizeAdjust: 104, ascentOverride: 92, descentOverride: 24 },
    preload: true,
  }

  it("writes open fonts as self-hosted @font-face rules with a metric-matched fallback, and preloads display faces", () => {
    const t = built(v3({ typography: { fontFamily: { display: brier, body: "Inter" } } }))
    expect(t.fonts).toContain('@import "@aleeforoughi/feather-tokens/fonts/inter.css";')
    expect(t.fonts).toContain('src: url("/fonts/brier-var.woff2") format("woff2");\n  font-weight: 300 800;')
    expect(t.fonts).toContain("font-display: swap;")
    expect(t.fonts).toContain('font-family: "Brier Fallback";\n  src: local("Arial");\n  size-adjust: 104%;\n  ascent-override: 92%;\n  descent-override: 24%;\n  line-gap-override: 0%;')
    expect(vars(t.css)["--brand-font-display"]).toBe('"Brier", "Brier Fallback", sans-serif')
    expect(t.preload).toEqual([
      { href: "/fonts/brier-var.woff2", as: "font", type: "font/woff2", crossorigin: "anonymous" },
      { href: "fonts/brier-italic.woff2", as: "font", type: "font/woff2", crossorigin: "anonymous" },
    ])
    expect(t.summary.display).toBe("Brier")
  })

  it("sets body faces to font-display optional, and never preloads them", () => {
    const body = { ...brier, family: "Brier Text", preload: false }
    const t = built(v3({ typography: { fontFamily: { display: "Sora", body } } }))
    expect(t.fonts).toContain("font-display: optional;")
    expect(t.preload).toEqual([])
    expect(problems(v3({ typography: { fontFamily: { display: "Sora", body: { ...body, preload: true } } } })).join()).toMatch(/only display faces are preloaded/)
  })

  it("refuses fonts from another host, non-WOFF2 files and missing fallback metrics", () => {
    const p = (font: unknown) => problems(v3({ typography: { fontFamily: { display: font, body: "Inter" } } })).join("\n")
    expect(p({ ...brier, files: [{ src: "https://fonts.example.com/brier.woff2" }] })).toMatch(/self-hosted \.woff2/)
    expect(p({ ...brier, files: [{ src: "//cdn.example.com/brier.woff2" }] })).toMatch(/self-hosted \.woff2/)
    expect(p({ ...brier, files: [{ src: "/fonts/brier.ttf" }] })).toMatch(/self-hosted \.woff2/)
    expect(p({ ...brier, fallback: undefined })).toMatch(/fallback is required/)
    expect(p({ ...brier, fallback: { ...brier.fallback, family: "Comic Sans MS" } })).toMatch(/fallback\.family must be one of/)
    expect(p({ ...brier, fallback: { ...brier.fallback, sizeAdjust: 400 } })).toMatch(/sizeAdjust/)
    expect(p({ ...brier, family: 'Brier"; } body { color: red' })).toMatch(/plain family name/)
  })

  it("adds a mono slot and a voice face", () => {
    const t = built(v3({ typography: { fontFamily: { display: "Inter", body: "Inter", mono: "Geist Mono" }, voiceFace: "Fraunces" } }))
    const v = vars(t.css)
    expect(v["--brand-font-mono"]).toBe('"Geist Mono Variable", monospace')
    expect(v["--brand-font-voice"]).toBe('"Fraunces Variable", sans-serif')
    expect(t.fonts).toContain("fonts/fraunces.css")
    expect(t.fonts).toContain("fonts/geist-mono.css")
    expect(problems(v3({ typography: { fontFamily: { display: "Inter", body: "Inter" }, voiceFace: "Comic" } })).join()).toMatch(/voice "Comic" is not in the foundation font set/)
  })

  it("keeps the mono slot, the voice face and open fonts for /3 documents", () => {
    const v2 = json("../themes/feather.json").tokens
    expect(problems({ ...v2, typography: { fontFamily: { display: "Inter", body: "Inter", mono: "Geist Mono" } } }).join()).toMatch(/need "schema": "feather-tokens\/3"/)
    expect(problems({ ...v2, typography: { fontFamily: { display: brier, body: "Inter" } } }).join()).toMatch(/not in the foundation font set/)
  })
})

describe("axes", () => {
  it("offers one surface idea per brand", () => {
    expect(SURFACES).toEqual(["flat", "paper", "glass", "film"])
    const glass = vars(built(v3({ surface: "glass", blur: 20 })).css)
    expect(glass["--overlay-blur"]).toBe("20px")
    expect(glass["--grain-opacity"]).toBe("0")
    const film = vars(built(v3({ surface: "film" })).css)
    expect(film["--grain-opacity"]).toBe("0.04")
    expect(film["--overlay-blur"]).toBe("0px")
    expect(vars(built(v3({ surface: "paper" })).css)["--expression-shadow"]).toBe("none")
  })

  it("keeps glass blur in 8 to 30px and grain on film only", () => {
    expect(problems(v3({ surface: "glass", blur: 40 })).join()).toMatch(/blur is for the glass surface only, 8 to 30/)
    expect(problems(v3({ surface: "flat", blur: 12 })).join()).toMatch(/blur is for the glass surface only/)
    expect(problems(v3({ surface: "glass", grain: 0.04 })).join()).toMatch(/grain is for the film surface only/)
    expect(problems(v3({ surface: "neon" })).join()).toMatch(/surface must be one of/)
  })

  it("draws the focus ring in the accent, 2px offset 2px, only when the accent reaches 3:1", () => {
    const t = vars(built(v3({ focus: "accent", colors: { ...base().colors, accent: "#2F4AE0" } })).css)
    expect(t["--ring"]).toBe("#2f4ae0")
    expect([t["--ring-width"], t["--ring-offset"]]).toEqual(["2px", "2px"])
    expect(problems(v3({ focus: "accent", colors: { ...base().colors, accent: "#E9E778" } })).join()).toMatch(/focus ring needs 3:1/)
    expect(vars(built(v3({ focus: "primary" })).css)["--ring"]).toBe(vars(built(v3()).css)["--primary"])
  })
})

describe("schema/feather-tokens-3.json", () => {
  const schema = json("../schema/feather-tokens-3.json")
  it("offers exactly the engine's axes, curves and fonts", () => {
    expect(schema.properties.schema.const).toBe("feather-tokens/3")
    expect(schema.properties.pace.enum).toEqual([...PACES])
    expect(schema.properties.surface.enum).toEqual([...SURFACES])
    expect(schema.properties.contrast.enum).toEqual(Object.keys(CONTRASTS))
    expect(schema.properties.signature.anyOf[0].enum).toEqual(Object.keys(SIGNATURES))
    expect(schema.$defs.font.anyOf[0].enum).toEqual(Object.keys(FONTS))
  })
})

describe("the expression reference themes (written as feather-tokens/4)", () => {
  it.each(["studio", "portrait", "seed"])("%s compiles and differs from the others in every expression axis it names", (name) => {
    const theme = json(`../themes/${name}.json`)
    expect(theme.tokens.schema).toBe("feather-tokens/4")
    const t = built(theme.tokens)
    expect(t.css).toContain("--ease-signature")
  })

  it("makes three different brands from the same axes", () => {
    const summaries = ["studio", "portrait", "seed"].map((n) => built(json(`../themes/${n}.json`).tokens).summary)
    expect(new Set(summaries.map((s) => s.signature)).size).toBe(3)
    expect(new Set(summaries.map((s) => s.surface)).size).toBe(3)
    expect(new Set(summaries.map((s) => s.pace)).size).toBe(3)
  })
})
