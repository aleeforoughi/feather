// Kinetic type, framework-free: the presets of the display-title effects, the keyframes they play, the scramble and the
// swap. No React, no DOM at import time. The numbers come from how the award winners cut their type (file 27 section 1
// B and 7): a line mask at 0.8s / 0.1 per line, characters that slide and unskew at 992px and up, an oval clip over
// 1.5s, a film-cut blink of 210ms, a scramble that settles left to right, a masked word swap.
import type { Clock } from "./clock"
import { staggerDelays } from "./motion"

export type DisplayEffect = "rise" | "mask" | "skew" | "oval" | "blink" | "scramble" | "swap"
/** What a sequence is cut into. */
export type EffectUnit = "line" | "word" | "char"

/** The widest viewport below which skew becomes a mask (the winners ship skew on desktop only). */
export const SKEW_MIN_WIDTH = 992
/** The sequence cap in ms every effect ends within, except oval (its own cap below). */
export const EFFECT_CAP = 1200
/** Oval is the one long reveal: 1.5s per line, the whole sequence compressed to end within this. */
export const OVAL_CAP = 1800
export const OVAL_EASING = "cubic-bezier(0.45, 0, 0.55, 1)"

export interface EffectPreset {
  /** ms of one piece. */
  duration: number
  /** ms between pieces, per unit. */
  step: Record<EffectUnit, number>
  /** ms the whole sequence ends within. */
  cap: number
  /** A fixed easing, or null to take the theme's signature curve (expo-out by default). */
  easing: string | null
  /** The unit the effect cuts into when `split` is not given. */
  unit: EffectUnit
}

export const PRESETS: Record<"mask" | "skew" | "oval", EffectPreset> = {
  mask: { duration: 800, step: { line: 100, word: 75, char: 20 }, cap: EFFECT_CAP, easing: null, unit: "line" },
  skew: { duration: 800, step: { line: 100, word: 75, char: 20 }, cap: EFFECT_CAP, easing: null, unit: "char" },
  oval: { duration: 1500, step: { line: 150, word: 150, char: 150 }, cap: OVAL_CAP, easing: OVAL_EASING, unit: "line" },
}

/** The skew distances: characters enter 80px to the side, skewed 14deg, a touch short. */
export const SKEW = { x: 80, angle: 14, scaleY: 0.95 }

/** Whether skew may play: the viewport is wide enough and motion is not reduced. */
export function skewAllowed(reduced: boolean, width: number): boolean {
  return !reduced && width >= SKEW_MIN_WIDTH
}

/** The effect that actually plays: skew falls back to mask where it is not allowed. */
export function resolveEffect(effect: DisplayEffect, allowSkew: boolean): DisplayEffect {
  return effect === "skew" && !allowSkew ? "mask" : effect
}

/** The unit a title is cut into for an effect: the caller's `split` (none counts as one line), else the effect's own. */
export function effectUnit(effect: "mask" | "skew" | "oval", split?: "line" | "word" | "char" | "none"): EffectUnit {
  if (effect === "oval") return "line"
  if (split === "none") return "line"
  return split ?? PRESETS[effect].unit
}

type Frame = Keyframe & { transform?: string; clipPath?: string; opacity?: number }

/** The keyframes of one piece. `visible` (in view when it was armed) never starts at opacity 0: LCP-safe. */
export function effectFrames(effect: "mask" | "skew" | "oval", visible: boolean): Frame[] {
  if (effect === "mask") return [{ transform: "translateY(110%)" }, { transform: "translateY(0)" }]
  if (effect === "oval") return [{ clipPath: "ellipse(20% 0% at 50% 0%)" }, { clipPath: "ellipse(100% 120% at 50% 0%)" }]
  const start: Frame = { transform: `translateX(${SKEW.x}px) skewX(${SKEW.angle}deg) scaleY(${SKEW.scaleY})` }
  if (!visible) start.opacity = 0
  return [start, { transform: "none", opacity: 1 }]
}

/** The delays of a sequence of `count` pieces: the preset's step, compressed so the last ends within the cap. */
export function effectDelays(effect: "mask" | "skew" | "oval", unit: EffectUnit, count: number): number[] {
  const p = PRESETS[effect]
  return staggerDelays(count, p.step[unit], p.duration, p.cap)
}

// Blink: a film-cut flicker. Opacity 0, 1, 0, 1 at 0, 90, 150 and 210 ms, then held.
export const BLINK_TIMES = [0, 90, 150, 210] as const
export const BLINK_MS = BLINK_TIMES[BLINK_TIMES.length - 1]
export function blinkFrames(): Frame[] {
  return BLINK_TIMES.map((t, i) => ({ opacity: i % 2 === 0 ? 0 : 1, offset: t / BLINK_MS, easing: "steps(1, end)" }))
}

// Scramble: characters cycle through a charset and settle left to right.
export const SCRAMBLE_LOWER = "abcdefghijklmnopqrstuvwxyz"
export const SCRAMBLE_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
export const SCRAMBLE_DIGITS = "0123456789"
export const SCRAMBLE_SYMBOLS = "#%&*+=/<>"
/** The share of the run before the first character may settle. */
export const SCRAMBLE_LEAD = 0.25
/** ms between two redraws of the cycling characters. */
export const SCRAMBLE_STEP = 45

/** Characters that never cycle: whitespace and punctuation keep the shape of the sentence. */
export const isStatic = (ch: string) => /[\s.,;:!?'"’‘“”()\-–—…]/.test(ch)

/** How long a scramble of `length` characters runs, 600 to 900 ms. */
export function scrambleDuration(length: number): number {
  return Math.min(900, Math.max(600, 450 + length * 12))
}

/** A random character of the same kind as `ch` (lower, upper, digit, else a symbol). */
export function scrambleChar(ch: string, rand: () => number = Math.random): string {
  const set = /[a-z]/.test(ch) ? SCRAMBLE_LOWER : /[A-Z]/.test(ch) ? SCRAMBLE_UPPER : /\d/.test(ch) ? SCRAMBLE_DIGITS : SCRAMBLE_SYMBOLS
  return set[Math.min(set.length - 1, Math.floor(rand() * set.length))]
}

/** The progress (0 to 1) at which character `index` of `count` settles: left to right, the last at 1. */
export function settleAt(index: number, count: number): number {
  return SCRAMBLE_LEAD + (1 - SCRAMBLE_LEAD) * ((index + 1) / Math.max(1, count))
}

/** The characters of the scramble at `progress`: settled ones are final, the rest cycle. At 1 it is exactly the text. */
export function scrambleFrame(chars: string[], progress: number, rand: () => number = Math.random): string[] {
  const n = chars.length
  return chars.map((ch, i) => (progress >= 1 || isStatic(ch) || progress >= settleAt(i, n) ? ch : scrambleChar(ch, rand)))
}

export interface ScrambleOptions {
  clock: Clock
  /** Called with the characters to show, first at progress 0 (synchronously), last the exact text. */
  onFrame: (chars: string[]) => void
  onDone?: () => void
  duration?: number
  rand?: () => number
}

/** Runs a scramble on the clock. Returns the cancel, which shows the final text. */
export function createScramble(text: string, { clock, onFrame, onDone, duration, rand = Math.random }: ScrambleOptions): () => void {
  const chars = [...text]
  const total = duration ?? scrambleDuration(chars.length)
  let start: number | null = null
  let lastDraw = -Infinity
  let stop = () => {}
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    stop()
    onFrame(chars)
    onDone?.()
  }
  onFrame(scrambleFrame(chars, 0, rand))
  stop = clock.add((time) => {
    if (start === null) start = time
    const elapsed = time - start
    if (elapsed >= total) return finish()
    if (elapsed - lastDraw < SCRAMBLE_STEP) return
    lastDraw = elapsed
    onFrame(scrambleFrame(chars, elapsed / total, rand))
  })
  return () => {
    if (finished) return
    finished = true
    stop()
    onFrame(chars)
  }
}

// Swap: one word inside the sentence changes in a masked vertical swap.
export const SWAP_MS = 600
export const SWAP_INTERVAL = 2400
/** Never faster than this: a swap needs time to be read. */
export const SWAP_MIN_INTERVAL = 1200
export const SWAP_SLOT = "{word}"

/** The sentence around the cycling word. Without a `{word}` slot the words follow the text. */
export function swapParts(text: string, words: string[]): { before: string; after: string; name: string } {
  const at = text.indexOf(SWAP_SLOT)
  const first = words[0] ?? ""
  if (at < 0) return { before: `${text} `, after: "", name: `${text} ${first}`.trim() }
  const before = text.slice(0, at)
  const after = text.slice(at + SWAP_SLOT.length)
  return { before, after, name: `${before}${first}${after}` }
}

export const swapNext = (index: number, count: number) => (count <= 0 ? 0 : (index + 1) % count)
export const swapInterval = (interval: number | undefined) => Math.max(SWAP_MIN_INTERVAL, interval ?? SWAP_INTERVAL)
