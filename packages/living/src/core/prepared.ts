// Prepared scenes: the top intents as static, indexable routes that work with the model off. A starter that matches
// one plays it at once, with no fake slowness (a deliberate beat reads as care; pretending to generate does not).
import type { Block } from "./blocks"
import type { TurnEvent } from "./conversation"

export interface PreparedScene {
  /** The intent's key, also its route segment ("work" → /work). */
  intent: string
  /** The starter label that asks it, in the visitor's words ("Show me the work"). */
  ask: string
  /** The spoken line, in the speaker's voice. */
  line: string
  blocks: Block[]
  asks?: string[]
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Problems with a set of prepared scenes: slugs, unique intents, one to three blocks. */
export function checkPrepared(scenes: PreparedScene[]): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const [i, s] of scenes.entries()) {
    if (!SLUG.test(s.intent)) problems.push(`prepared[${i}].intent "${s.intent}" must be a route slug (a-z, 0-9, hyphens)`)
    if (seen.has(s.intent)) problems.push(`prepared[${i}].intent "${s.intent}" is prepared twice`)
    seen.add(s.intent)
    if (!s.line.trim()) problems.push(`prepared[${i}] needs a spoken line`)
    if (s.blocks.length < 1 || s.blocks.length > 3) problems.push(`prepared[${i}] brings ${s.blocks.length} blocks; a scene brings one to three`)
  }
  return problems
}

/** The scene a starter or typed ask maps to: an exact intent or ask match (case and spacing ignored). */
export function matchPrepared(scenes: PreparedScene[], ask: string): PreparedScene | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
  const a = norm(ask)
  return scenes.find((s) => norm(s.intent) === a || norm(s.ask) === a) ?? null
}

/** A prepared scene as the event stream a live answer would send: all at once, words with their spacing. */
export function preparedEvents(scene: PreparedScene): TurnEvent[] {
  const words = scene.line.split(/(?=\s)/)
  return [...words.map((text) => ({ type: "word" as const, text })), ...scene.blocks.slice(0, 3).map((block) => ({ type: "block" as const, block })), ...(scene.asks?.length ? [{ type: "asks" as const, asks: scene.asks }] : []), { type: "done" }]
}

/** The static routes to build: one per prepared scene, indexable, with its title. */
export function preparedRoutes(scenes: PreparedScene[], base = "/"): { path: string; intent: string; title: string }[] {
  const root = base.endsWith("/") ? base : `${base}/`
  return scenes.map((s) => ({ path: `${root}${s.intent}`, intent: s.intent, title: s.blocks.find((b) => typeof b.title === "string")?.title ?? s.ask }))
}
