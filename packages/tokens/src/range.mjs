// feather-tokens/4: the range layer of a brand (docs/visual-system.md section 14.5).
// Loudness (how loud the brand's website patterns may get), the colour-blocking roles, the media scrim and the ink
// that reads on it, and the motion personality shorthand. Layers (z-index) and the opacity roles are house constants
// in foundation.css, the same in every brand. Every colour pair here is measured, and a pair under its floor is fixed
// (when the engine derived it) or refused (when the brand wrote it). Deterministic, no dependencies.

/** Loudness 0 to 3 (docs/proposals/2026-11-24-range.md section 3.3): 0 quiet, 1 composed, 2 expressive, 3 spectacle. */
export const LOUDNESS = [0, 1, 2, 3]
export const DEFAULT_LOUDNESS = 1

/** The colour-blocking roles: block-1..block-4, each a surface and the ink that reads on it. */
export const BLOCK_COUNT = 4
/** Every block's ink and the ink on media reach this on their surface (WCAG 2.2 AA, 1.4.3). */
export const BLOCK_FLOOR = 4.5
export const MEDIA_FLOOR = 4.5
/** The accent tint a tonal block takes: the same mix as --accent (accent 18% into the background). */
export const BLOCK_TINT = 18
/** The second tonal block when the accent is the primary: the --muted mix (text 8% into the background). */
export const BLOCK_MUTED = 8

/** The media scrim's opacity: it starts at 0.6 and the engine raises it, in steps of 0.02 up to 0.9, until the ink on
 * media reaches its floor over the brightest and the darkest frame. */
export const MEDIA_SCRIM = { start: 0.6, step: 0.02, max: 0.9 }

/** House constants (foundation.css), the same for every brand and every schema. */
export const LAYERS = { base: 0, raised: 10, sticky: 20, overlay: 40, modal: 50, toast: 60, cursor: 70 }
export const OPACITY = { dim: 0.6, muted: 0.72, disabled: 0.5 }

/** `personality`: one word that sets pace and signature together (and the overshoot, for playful). Anything the brand
 * sets explicitly wins. */
export const PERSONALITIES = {
  calm: { pace: "calm", signature: "expo-out" },
  precise: { pace: "snappy", signature: "standard" },
  playful: { pace: "snappy", signature: "quint-out", overshoot: true },
  cinematic: { pace: "cinematic", signature: "expo-out" },
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v)

/**
 * `personality` (feather-tokens/4, top level beside pace and signature, so `motion` stays the product durations axis
 * every reader already knows). Returns the tokens the motion layer reads, with pace, signature and overshoot filled
 * from the personality where the brand left them out, and the personality; pushes problems.
 */
export function applyPersonality(tokens, problems) {
  if (tokens.motion !== null && typeof tokens.motion === "object") problems.push(`motion is the product durations axis ("calm" or "snappy"); a motion personality is written as the top-level "personality" (${Object.keys(PERSONALITIES).join(", ")})`)
  const personality = tokens.personality
  if (personality === undefined) return { tokens, personality: undefined }
  const preset = typeof personality === "string" ? PERSONALITIES[personality] : undefined
  if (!preset) {
    problems.push(`personality must be one of ${Object.keys(PERSONALITIES).join(", ")}`)
    return { tokens, personality: undefined }
  }
  return {
    tokens: { ...tokens, pace: tokens.pace ?? preset.pace, signature: tokens.signature ?? preset.signature, overshoot: tokens.overshoot ?? preset.overshoot },
    personality,
  }
}

/** Loudness must be a whole step from 0 to 3. The engine checks it with the axes, so it is listed with every problem. */
export function checkLoudness(tokens, problems) {
  if (tokens.loudness !== undefined && !LOUDNESS.includes(tokens.loudness)) problems.push(`loudness must be 0, 1, 2 or 3 (0 quiet, 1 composed, 2 expressive, 3 spectacle), got ${JSON.stringify(tokens.loudness)}`)
}

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
/** `alpha` of `top` composited over `backdrop`, per channel in sRGB, as browsers paint it. */
function composite(top, backdrop, alpha) {
  const b = channels(backdrop)
  return `#${channels(top).map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]).toString(16).padStart(2, "0")).join("")}`
}

const rgb = (hex, alpha) => `rgb(${channels(hex).join(" ")} / ${alpha})`

/**
 * The range block of a feather-tokens/4 brand. `ctx` carries the colours the engine resolved (expanded hex) and its
 * helpers: { colors, primary, primaryText, accent, accentGiven, text, bg, contrast, mix, onColor, expand, isHex }.
 * Returns { vars, summary } and pushes problems.
 */
export function rangeTheme(tokens, ctx, problems) {
  const { contrast, mix, onColor, expand, isHex } = ctx
  const loudness = tokens.loudness ?? DEFAULT_LOUDNESS

  // ── Colour blocks: primary, accent, then two tonal surfaces; a brand may write up to four of its own. ──
  const ink = (surface, preferred) => (preferred && contrast(preferred, surface) >= BLOCK_FLOOR ? preferred : onColor(surface, ctx.text, ctx.bg))
  const inverse = { surface: ctx.text, ink: ink(ctx.text, ctx.bg) }
  const accentBlock = ctx.accentGiven && ctx.accent !== ctx.primary ? { surface: ctx.accent, ink: ink(ctx.accent) } : null
  const derived = [
    { surface: ctx.primary, ink: ink(ctx.primary, ctx.primaryText) },
    accentBlock ?? inverse,
    { surface: mix(ctx.accent, ctx.bg, BLOCK_TINT), ink: null },
    accentBlock ? inverse : { surface: mix(ctx.text, ctx.bg, BLOCK_MUTED), ink: null },
  ].map((b) => ({ surface: b.surface, ink: b.ink ?? ink(b.surface, ctx.text) }))
  const given = ctx.colors.blocks
  const blocks = [...derived]
  if (given !== undefined) {
    if (!Array.isArray(given)) problems.push(`colors.blocks must be a list of up to ${BLOCK_COUNT} { "surface", "ink" } pairs`)
    else {
      if (given.length > BLOCK_COUNT) problems.push(`colors.blocks has ${given.length} entries; a brand has at most ${BLOCK_COUNT} (block-1 to block-${BLOCK_COUNT})`)
      given.slice(0, BLOCK_COUNT).forEach((b, i) => {
        const at = `colors.blocks[${i}]`
        if (!isObject(b)) return problems.push(`${at} must be { "surface": hex, "ink": hex }`)
        for (const key of Object.keys(b)) if (key !== "surface" && key !== "ink") problems.push(`${at}.${key} is not a block field (surface, ink)`)
        if (!isHex(b.surface)) return problems.push(`${at}.surface must be a hex color`)
        const surface = expand(b.surface)
        if (b.ink === undefined) return (blocks[i] = { surface, ink: ink(surface) })
        if (!isHex(b.ink)) return problems.push(`${at}.ink must be a hex color`)
        const r = contrast(expand(b.ink), surface)
        if (r < BLOCK_FLOOR) problems.push(`${at}: ink ${b.ink} reaches ${r.toFixed(2)}:1 on ${b.surface}; a block's ink needs ${BLOCK_FLOOR}:1 (leave "ink" out and the engine picks one that reads)`)
        blocks[i] = { surface, ink: expand(b.ink) }
      })
    }
  }

  // ── The media scrim: the overlay under text on photographs and film, the inverse surface by default. ──
  const c = ctx.colors
  const scrimColor = isHex(c.mediaScrim) ? expand(c.mediaScrim) : ctx.text
  const inkGiven = isHex(c.inkOnMedia) ? expand(c.inkOnMedia) : null
  const frames = ["#ffffff", "#000000"]
  const worstOn = (fg, alpha) => Math.min(...frames.map((frame) => contrast(fg, composite(scrimColor, frame, alpha))))
  const alphaFor = (fg) => {
    for (let a = MEDIA_SCRIM.start; a <= MEDIA_SCRIM.max + 1e-9; a += MEDIA_SCRIM.step) {
      const alpha = Math.round(a * 100) / 100
      if (worstOn(fg, alpha) >= MEDIA_FLOOR) return alpha
    }
    return null
  }
  // The brand's own ink first (its background, the inverse of the scrim), then black or white, whichever reads better.
  const bw = contrast("#ffffff", scrimColor) >= contrast("#000000", scrimColor) ? "#ffffff" : "#000000"
  const candidates = inkGiven ? [inkGiven] : [ctx.bg, bw]
  let inkOnMedia = candidates[0]
  let scrimAlpha = null
  for (const cand of candidates) {
    scrimAlpha = alphaFor(cand)
    inkOnMedia = cand
    if (scrimAlpha !== null) break
  }
  if (scrimAlpha === null) problems.push(`the media scrim (${scrimColor} up to ${MEDIA_SCRIM.max * 100}%) cannot carry --ink-on-media (${inkOnMedia}) at ${MEDIA_FLOOR}:1 over a white and a black frame${inkGiven ? "; leave colors.inkOnMedia out, or choose a darker or lighter one" : "; choose a darker or lighter colors.mediaScrim"}`)

  if (problems.length > 0) return null
  const vars = {
    // Loudness (section 14.5): the brand's default; a block's data-loudness overrides it.
    "--loudness": String(loudness),
    ...Object.fromEntries(blocks.flatMap((b, i) => [[`--block-${i + 1}`, b.surface], [`--block-${i + 1}-ink`, b.ink]])),
    "--media-scrim": rgb(scrimColor, scrimAlpha),
    "--ink-on-media": inkOnMedia,
  }
  return { vars, summary: { loudness } }
}
