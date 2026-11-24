// feather-tokens/3: the expression layer of a brand (docs/visual-system.md section 14).
// Open, self-hosted fonts with fallback metrics; a fluid display scale; type features; a voice face; the brand's
// signature curve and the expression motion roles; and the contrast, surface and focus axes. Product UI never reads
// any of this: its roles keep --ease-standard and the six durations (section 10). Deterministic, no dependencies.

/** The house signature curves (knowledge: file 23 section 5). A brand picks one, or a bounded custom curve. */
export const SIGNATURES = {
  "expo-out": [0.19, 1, 0.22, 1],
  "quint-out": [0.23, 1, 0.32, 1],
  "sine-out": [0.39, 0.575, 0.565, 1],
  scout: [0.38, 0.005, 0.215, 1],
  sheet: [0.32, 0.72, 0, 1],
  standard: [0.2, 0, 0, 1],
}
/** The signature a brand gets when it names none. */
export const DEFAULT_SIGNATURE = "expo-out"
/** The overshoot curve playful roles use when `overshoot` is on, and the cap a custom curve may reach. */
export const OVERSHOOT = [0.34, 1.56, 0.64, 1]
/** Bounds of a custom curve: x stays in [0, 1] (so time is monotone); y in [-0.6, 1.6], and outside [0, 1] only with
 * `overshoot: true`. */
export const CURVE_BOUNDS = { x: [0, 1], y: [-0.6, 1.6] }

/** Paces. Calm and snappy also set the product durations (section 10); cinematic stretches only the expression roles,
 * and product UI runs calm. */
export const PACES = ["calm", "snappy", "cinematic"]

/** The expression roles per pace, in ms (file 23 section 5): reveal 600 to 900, media 600 to 1000, scenes 800 to
 * 1200, stagger 30 to 80 per word and 80 to 120 per block, hover exit 250 to 320. Distances in px, media scale as a
 * factor, spring bounce 0 to 0.25. */
export const EXPRESSION_ROLES = {
  calm: { reveal: 700, media: 800, scene: 900, staggerWord: 40, staggerBlock: 100, hoverOut: 280, revealDistance: 32, mediaScale: 1.03, bounce: 0.1 },
  snappy: { reveal: 600, media: 700, scene: 800, staggerWord: 30, staggerBlock: 80, hoverOut: 250, revealDistance: 24, mediaScale: 1.02, bounce: 0.2 },
  cinematic: { reveal: 900, media: 1000, scene: 1200, staggerWord: 60, staggerBlock: 120, hoverOut: 320, revealDistance: 48, mediaScale: 1.04, bounce: 0.1 },
}
/** Every sequence (a stagger included) ends within this many ms. */
export const SEQUENCE_CAP_MS = 1200
/** The cross-fade every expression role becomes under reduced motion, unless it maps to nothing. */
export const REDUCED_FADE_MS = 150
/** Reduced motion per expression role: a short cross-fade, or nothing at all. A brand may only make one quieter. */
export const REDUCED_DEFAULTS = { reveal: "fade", media: "fade", scene: "fade", stagger: "none", hoverOut: "none", spring: "none" }
export const SPRING_BOUNCE = [0, 0.25]

/** The fluid display scale: each step's size (rem, from a 360px to a 1440px viewport), tracking (em, at the smallest
 * and at the largest size: it tightens as the type grows) and leading (file 23 section 3). */
export const FLUID_VIEWPORT = [360, 1440]
export const DISPLAY_STEPS = ["xl", "l", "m", "s"]
export const DISPLAY_DEFAULTS = {
  xl: { size: { min: 3, max: 9 }, tracking: { min: -0.02, max: -0.05 }, leading: 0.9 },
  l: { size: { min: 2.5, max: 6 }, tracking: { min: -0.02, max: -0.045 }, leading: 0.95 },
  m: { size: { min: 2, max: 4.5 }, tracking: { min: -0.015, max: -0.035 }, leading: 1 },
  s: { size: { min: 1.5, max: 3 }, tracking: { min: -0.01, max: -0.025 }, leading: 1.05 },
}
/** What a brand may set: no display text under 1rem or over 14rem, tracking from -0.08em to 0.02em, leading 0.72 to 1.15. */
export const DISPLAY_BOUNDS = { size: [1, 14], tracking: [-0.08, 0.02], leading: [0.72, 1.15] }

/** The contrast axis: the display weight, and how much tighter the default tracking runs. */
export const CONTRASTS = { quiet: { weight: 500, tighten: 1 }, bold: { weight: 700, tighten: 1.25 } }
/** The surface axis: one idea of light and surface per brand. Glass is for overlays only; film is the one texture. */
export const SURFACES = ["flat", "paper", "glass", "film"]
export const GLASS_BLUR = { min: 8, max: 30, default: 16 }
export const FILM_GRAIN = { min: 0.02, max: 0.08, default: 0.04 }
/** The focus axis: which brand color the 2px ring (offset 2px) takes. It must reach 3:1 on the background and surface. */
export const FOCUS = ["accent", "primary"]
export const FOCUS_FLOOR = 3

/** Local faces a fallback may name (they exist on every platform, so the metric overrides land). */
export const FALLBACK_FACES = ["Arial", "Helvetica", "Helvetica Neue", "Times New Roman", "Georgia", "Courier New"]
const FALLBACK_BOUNDS = { sizeAdjust: [50, 200], ascentOverride: [50, 150], descentOverride: [0, 60], lineGapOverride: [0, 30] }
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 -]{0,60}$/
/** Self-hosted WOFF2 only: a relative or root-relative path, never a URL to another host. */
const WOFF2 = /^(?:\.{1,2}\/|\/(?!\/))?(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.woff2$/
const GENERICS = ["sans-serif", "serif", "monospace"]
const FONT_DISPLAY = ["swap", "optional", "fallback"]

const num = (v) => typeof v === "number" && Number.isFinite(v)
const within = (v, [lo, hi]) => num(v) && v >= lo && v <= hi
/** Rounds to 4 decimals and drops trailing zeros, so the CSS is stable and readable. */
const r4 = (v) => String(Math.round(v * 10000) / 10000)

/** `a + b·vw`, written with a minus when b is negative. */
const linear = (a, b) => (b < 0 ? `${r4(a)}rem - ${r4(-b)}vw` : `${r4(a)}rem + ${r4(b)}vw`)

/** `clamp(min, a + b·vw, max)` between the two fluid viewports, for rem endpoints. */
export function fluidClamp(min, max, [lo, hi] = FLUID_VIEWPORT) {
  if (min === max) return `${r4(min)}rem`
  const slope = (max - min) / (hi - lo) // rem per px
  const a = min - slope * lo
  const b = slope * 1600 // rem per px → vw (1vw = 1/100 of the viewport, 1rem = 16px)
  return `clamp(${r4(min)}rem, ${linear(a, b)}, ${r4(max)}rem)`
}

/** Fluid tracking: exact at both ends (tracking.min at size.min, tracking.max at size.max), linear between, in rem so
 * it can be clamped. Terminal's `min(-.075rem, -.308vw)` is the same idea. */
export function fluidTracking(size, tracking, [lo, hi] = FLUID_VIEWPORT) {
  const start = tracking.min * size.min
  const end = tracking.max * size.max
  if (start === end) return `${r4(start)}rem`
  const slope = (end - start) / (hi - lo)
  const a = start - slope * lo
  const b = slope * 1600
  return `clamp(${r4(Math.min(start, end))}rem, ${linear(a, b)}, ${r4(Math.max(start, end))}rem)`
}

const bezier = (p) => `cubic-bezier(${p.join(", ")})`

/** The signature curve: a house name, or { cubicBezier: [x1, y1, x2, y2] } within CURVE_BOUNDS. */
export function resolveSignature(value, overshoot, problems) {
  if (value === undefined) return SIGNATURES[DEFAULT_SIGNATURE]
  if (typeof value === "string") {
    if (SIGNATURES[value]) return SIGNATURES[value]
    problems.push(`signature must be one of ${Object.keys(SIGNATURES).join(", ")}, or { "cubicBezier": [x1, y1, x2, y2] }`)
    return null
  }
  const p = value?.cubicBezier
  if (!Array.isArray(p) || p.length !== 4 || !p.every(num)) {
    problems.push(`signature.cubicBezier must be four numbers`)
    return null
  }
  const [x1, y1, x2, y2] = p
  if (!within(x1, CURVE_BOUNDS.x) || !within(x2, CURVE_BOUNDS.x)) problems.push(`signature.cubicBezier x values must be in [0, 1] (time runs forward)`)
  if (!within(y1, CURVE_BOUNDS.y) || !within(y2, CURVE_BOUNDS.y)) problems.push(`signature.cubicBezier y values must be in [${CURVE_BOUNDS.y.join(", ")}]`)
  else if (!overshoot && [y1, y2].some((y) => y < 0 || y > 1)) problems.push(`signature.cubicBezier overshoots (a y value outside [0, 1]); set "overshoot": true to allow it`)
  return p
}

/**
 * One font slot: a foundation family name (string), or an open font object
 *   { family, files: [{ src, weight, style }], fallback: { family, sizeAdjust, ascentOverride, descentOverride,
 *     lineGapOverride }, preload, display, generic }.
 * Returns { kind: "foundation", name } | { kind: "open", ... } | null, pushing problems.
 */
export function checkFont(slot, value, foundation, problems, { preloadable = false } = {}) {
  if (typeof value === "string") {
    if (!foundation[value]) problems.push(`typography.fontFamily.${slot} "${value}" is not in the foundation font set: ${Object.keys(foundation).join(", ")}`)
    return { kind: "foundation", name: value }
  }
  const where = `typography.${slot === "voice" ? "voiceFace" : `fontFamily.${slot}`}`
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    problems.push(`${where} must be a foundation family name or a font object`)
    return null
  }
  const before = problems.length
  if (typeof value.family !== "string" || !FAMILY.test(value.family)) problems.push(`${where}.family must be a plain family name (letters, digits, spaces, hyphens)`)
  const files = Array.isArray(value.files) ? value.files : []
  if (files.length === 0) problems.push(`${where}.files must list at least one WOFF2 file`)
  files.forEach((f, i) => {
    if (typeof f?.src !== "string" || !WOFF2.test(f.src)) problems.push(`${where}.files[${i}].src must be a self-hosted .woff2 path (relative or root-relative, never another host)`)
    const w = f?.weight ?? 400
    const okWeight = Array.isArray(w) ? w.length === 2 && w.every((x) => within(x, [1, 1000])) && w[0] < w[1] : within(w, [1, 1000])
    if (!okWeight) problems.push(`${where}.files[${i}].weight must be a weight (1 to 1000) or a range [min, max]`)
    if (f?.style !== undefined && f.style !== "normal" && f.style !== "italic") problems.push(`${where}.files[${i}].style must be normal or italic`)
  })
  const fb = value.fallback
  if (!fb || typeof fb !== "object") problems.push(`${where}.fallback is required: a local face and its metric overrides, so the swap does not shift the layout`)
  else {
    if (!FALLBACK_FACES.includes(fb.family)) problems.push(`${where}.fallback.family must be one of ${FALLBACK_FACES.join(", ")}`)
    for (const [key, range] of Object.entries(FALLBACK_BOUNDS)) {
      if (fb[key] === undefined && key === "lineGapOverride") continue
      if (!within(fb[key], range)) problems.push(`${where}.fallback.${key} must be a percentage in [${range.join(", ")}]`)
    }
  }
  if (value.preload !== undefined && typeof value.preload !== "boolean") problems.push(`${where}.preload must be true or false`)
  if (value.preload === true && !preloadable) problems.push(`${where}.preload: only display faces are preloaded`)
  if (value.display !== undefined && !FONT_DISPLAY.includes(value.display)) problems.push(`${where}.display must be one of ${FONT_DISPLAY.join(", ")}`)
  if (value.generic !== undefined && !GENERICS.includes(value.generic)) problems.push(`${where}.generic must be one of ${GENERICS.join(", ")}`)
  if (problems.length > before) return null
  return { kind: "open", ...value, files }
}

/** The family stack of an open font: the face, its metric-matched fallback, then the generic family. */
export const openStack = (font, generic) => `"${font.family}", "${font.family} Fallback", ${font.generic ?? generic}`

/** The @font-face rules of an open font: one per file, then its fallback face. */
export function fontFaces(font, defaultDisplay) {
  const faces = font.files.map((f) => {
    const weight = Array.isArray(f.weight) ? `${f.weight[0]} ${f.weight[1]}` : String(f.weight ?? 400)
    return `@font-face {\n  font-family: "${font.family}";\n  src: url("${f.src}") format("woff2");\n  font-weight: ${weight};\n  font-style: ${f.style ?? "normal"};\n  font-display: ${font.display ?? defaultDisplay};\n}`
  })
  const fb = font.fallback
  faces.push(
    `@font-face {\n  font-family: "${font.family} Fallback";\n  src: local("${fb.family}");\n  size-adjust: ${fb.sizeAdjust}%;\n  ascent-override: ${fb.ascentOverride}%;\n  descent-override: ${fb.descentOverride}%;\n  line-gap-override: ${fb.lineGapOverride ?? 0}%;\n}`
  )
  return faces
}

/** The display scale, the brand's partial values merged over the house defaults, checked against DISPLAY_BOUNDS. */
export function resolveDisplay(input, tighten, problems) {
  if (input !== undefined && (input === null || typeof input !== "object" || Array.isArray(input))) {
    problems.push(`typography.display must be an object keyed ${DISPLAY_STEPS.join(", ")}`)
    return null
  }
  for (const key of Object.keys(input ?? {})) if (!DISPLAY_STEPS.includes(key)) problems.push(`typography.display.${key} is not a display step (${DISPLAY_STEPS.join(", ")})`)
  const out = {}
  for (const step of DISPLAY_STEPS) {
    const given = input?.[step] ?? {}
    const d = DISPLAY_DEFAULTS[step]
    const tracking = given.tracking ? { ...d.tracking, ...given.tracking } : { min: d.tracking.min * tighten, max: d.tracking.max * tighten }
    const s = { size: { ...d.size, ...given.size }, tracking, leading: given.leading ?? d.leading }
    const at = `typography.display.${step}`
    if (!within(s.size.min, DISPLAY_BOUNDS.size) || !within(s.size.max, DISPLAY_BOUNDS.size)) problems.push(`${at}.size must stay in [${DISPLAY_BOUNDS.size.join(", ")}] rem`)
    else if (s.size.min > s.size.max) problems.push(`${at}.size.min must not exceed size.max`)
    if (!within(s.tracking.min, DISPLAY_BOUNDS.tracking) || !within(s.tracking.max, DISPLAY_BOUNDS.tracking)) problems.push(`${at}.tracking must stay in [${DISPLAY_BOUNDS.tracking.join(", ")}] em`)
    else if (s.tracking.max > s.tracking.min) problems.push(`${at}.tracking.max must be at most tracking.min: tracking tightens as the type grows`)
    if (!within(s.leading, DISPLAY_BOUNDS.leading)) problems.push(`${at}.leading must be in [${DISPLAY_BOUNDS.leading.join(", ")}]`)
    out[step] = s
  }
  for (let i = 1; i < DISPLAY_STEPS.length; i++) {
    const [big, small] = [out[DISPLAY_STEPS[i - 1]], out[DISPLAY_STEPS[i]]]
    if (num(big.size.max) && num(small.size.max) && (small.size.max > big.size.max || small.size.min > big.size.min)) problems.push(`typography.display.${DISPLAY_STEPS[i]} must not be larger than ${DISPLAY_STEPS[i - 1]}`)
  }
  return out
}

/**
 * The expression block of a feather-tokens/3 brand. `ctx` carries what the engine already resolved: the foundation
 * font table, the generic fallback helper, the brand colors and a contrast function.
 * Returns { vars, faces, preload, summary } and pushes problems.
 */
export function expressionTheme(tokens, ctx, problems) {
  const t = tokens.typography ?? {}
  const pace = tokens.pace ?? "calm"
  if (!PACES.includes(pace)) problems.push(`pace must be one of ${PACES.join(", ")}`)
  if (tokens.overshoot !== undefined && typeof tokens.overshoot !== "boolean") problems.push(`overshoot must be true or false`)
  const overshoot = tokens.overshoot === true
  const signature = resolveSignature(tokens.signature, overshoot, problems)
  const contrastAxis = tokens.contrast ?? "quiet"
  if (!CONTRASTS[contrastAxis]) problems.push(`contrast must be one of ${Object.keys(CONTRASTS).join(", ")}`)
  const surface = tokens.surface ?? "flat"
  if (!SURFACES.includes(surface)) problems.push(`surface must be one of ${SURFACES.join(", ")}`)
  if (tokens.blur !== undefined && (surface !== "glass" || !within(tokens.blur, [GLASS_BLUR.min, GLASS_BLUR.max]))) problems.push(`blur is for the glass surface only, ${GLASS_BLUR.min} to ${GLASS_BLUR.max} px`)
  if (tokens.grain !== undefined && (surface !== "film" || !within(tokens.grain, [FILM_GRAIN.min, FILM_GRAIN.max]))) problems.push(`grain is for the film surface only, ${FILM_GRAIN.min} to ${FILM_GRAIN.max}`)
  const focus = tokens.focus ?? "accent"
  if (!FOCUS.includes(focus)) problems.push(`focus must be one of ${FOCUS.join(", ")}`)
  const roles = EXPRESSION_ROLES[pace] ?? EXPRESSION_ROLES.calm
  const bounce = tokens.spring?.bounce ?? roles.bounce
  if (!within(bounce, SPRING_BOUNCE)) problems.push(`spring.bounce must be in [${SPRING_BOUNCE.join(", ")}]`)
  const reduced = { ...REDUCED_DEFAULTS }
  for (const [role, value] of Object.entries(tokens.reduced ?? {})) {
    if (!(role in REDUCED_DEFAULTS)) problems.push(`reduced.${role} is not an expression role (${Object.keys(REDUCED_DEFAULTS).join(", ")})`)
    else if (value !== "fade" && value !== "none") problems.push(`reduced.${role} must be fade or none`)
    else if (REDUCED_DEFAULTS[role] === "none" && value === "fade") problems.push(`reduced.${role} is already none; reduced motion can only get quieter`)
    else reduced[role] = value
  }
  const features = { tabularNums: true, balanceTitles: true, prettyBody: true, ...(t.features ?? {}) }
  for (const [k, v] of Object.entries(t.features ?? {})) {
    if (!["tabularNums", "balanceTitles", "prettyBody"].includes(k)) problems.push(`typography.features.${k} is not a type feature (tabularNums, balanceTitles, prettyBody)`)
    else if (typeof v !== "boolean") problems.push(`typography.features.${k} must be true or false`)
  }
  const display = resolveDisplay(t.display, CONTRASTS[contrastAxis]?.tighten ?? 1, problems)

  // Fonts: the slots the engine already checked as strings come in as `ctx.fonts`; open fonts are checked here.
  const slots = { ...ctx.fonts }
  const faces = []
  const preload = []
  const stacks = {}
  const open = new Set()
  for (const [slot, value] of Object.entries(slots)) {
    if (value === undefined) continue
    const generic = slot === "mono" ? "monospace" : ctx.generic(typeof value === "string" ? value : "")
    const font = checkFont(slot, value, ctx.foundation, problems, { preloadable: slot === "display" })
    if (!font) continue
    if (font.kind === "foundation") {
      const fb = ctx.fallbacks?.[font.name]
      const name = ctx.familyName(font.name)
      if (fb) {
        // feather-tokens/4: a foundation family gets its metric-matched fallback too (src/fallbacks.mjs), so the swap
        // shifts nothing. Older documents keep their stack byte for byte.
        stacks[slot] = `"${name}", "${name} Fallback", ${slot === "mono" ? "monospace" : generic}`
        open.add(slot)
        const face = `@font-face {\n  font-family: "${name} Fallback";\n  src: local("${fb.family}");\n  size-adjust: ${fb.sizeAdjust}%;\n  ascent-override: ${fb.ascentOverride}%;\n  descent-override: ${fb.descentOverride}%;\n  line-gap-override: ${fb.lineGapOverride}%;\n}`
        if (!faces.includes(face)) faces.push(face)
      } else stacks[slot] = `"${name}", ${slot === "mono" ? "monospace" : generic}`
      continue
    }
    stacks[slot] = openStack(font, generic)
    open.add(slot)
    faces.push(...fontFaces(font, slot === "display" || slot === "voice" ? "swap" : "optional"))
    if (font.preload) for (const f of font.files) preload.push({ href: f.src, as: "font", type: "font/woff2", crossorigin: "anonymous" })
  }

  // Focus: the accent must reach 3:1 against the background and the surface to carry the ring.
  const ringColor = focus === "accent" ? ctx.accent : ctx.primary
  const ringOk = ctx.on.every((s) => ctx.contrast(ringColor, s) >= FOCUS_FLOOR)
  if (FOCUS.includes(focus) && !ringOk) problems.push(`focus: ${focus} (${ringColor}) reaches under ${FOCUS_FLOOR}:1 on colors.background or colors.surface; the focus ring needs ${FOCUS_FLOOR}:1 (choose "primary" or a stronger accent)`)

  if (problems.length > 0) return null
  const ms = (v) => `${v}ms`
  const vars = {
    // Type (section 14.1).
    ...(open.has("display") ? { "--brand-font-display": stacks.display } : {}),
    ...(open.has("body") ? { "--brand-font-body": stacks.body } : {}),
    ...(stacks.voice ? { "--brand-font-voice": stacks.voice } : {}),
    ...(stacks.mono ? { "--brand-font-mono": stacks.mono } : {}),
    "--display-weight": String(CONTRASTS[contrastAxis].weight),
    ...Object.fromEntries(
      DISPLAY_STEPS.flatMap((step) => [
        [`--display-${step}-size`, fluidClamp(display[step].size.min, display[step].size.max)],
        [`--display-${step}-tracking`, fluidTracking(display[step].size, display[step].tracking)],
        [`--display-${step}-leading`, r4(display[step].leading)],
      ])
    ),
    "--title-wrap": features.balanceTitles ? "balance" : "wrap",
    "--body-wrap": features.prettyBody ? "pretty" : "wrap",
    "--numeric-figures": features.tabularNums ? "tabular-nums" : "normal",
    // Motion (section 14.2). Product UI keeps --ease-standard; these are read by expression roles only.
    "--ease-signature": bezier(signature),
    "--ease-overshoot": bezier(overshoot ? OVERSHOOT : signature),
    "--duration-reveal": ms(roles.reveal),
    "--duration-media": ms(roles.media),
    "--duration-scene": ms(roles.scene),
    "--duration-hover-out": ms(roles.hoverOut),
    "--stagger-word": ms(roles.staggerWord),
    "--stagger-block": ms(roles.staggerBlock),
    "--distance-reveal": `${roles.revealDistance}px`,
    "--scale-media": String(roles.mediaScale),
    "--spring-bounce": String(bounce),
    "--sequence-cap": ms(SEQUENCE_CAP_MS),
    "--duration-reduced": ms(REDUCED_FADE_MS),
    ...Object.fromEntries(Object.entries(reduced).map(([role, v]) => [`--reduced-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, v])),
    // Axes (section 14.3).
    "--surface-kind": surface,
    "--expression-shadow": surface === "paper" ? "none" : "var(--elevation-2)",
    "--expression-edge": surface === "paper" ? "var(--border-tertiary)" : "transparent",
    "--overlay-blur": surface === "glass" ? `${tokens.blur ?? GLASS_BLUR.default}px` : "0px",
    "--overlay-fill": surface === "glass" ? "color-mix(in oklab, var(--popover) 85%, transparent)" : "var(--popover)",
    "--grain-opacity": surface === "film" ? String(tokens.grain ?? FILM_GRAIN.default) : "0",
    "--ring": ringColor,
    "--ring-width": "2px",
    "--ring-offset": "2px",
  }
  return {
    vars,
    faces,
    preload,
    summary: { pace, signature: typeof tokens.signature === "string" ? tokens.signature : tokens.signature ? "custom" : DEFAULT_SIGNATURE, contrast: contrastAxis, surface, focus },
  }
}
