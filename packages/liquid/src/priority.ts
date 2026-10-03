// Principle 8: when rules conflict, the higher priority wins.
// safety and critical comprehension → explicit accessibility needs → explicit user settings → OS settings →
// task needs → learned preferences → aesthetics. Defaults come last.
import type { RuleId, TraceEntry } from "./plan.ts"

export const PRIORITY = {
  safety: 1,
  accessibility: 2,
  "user-setting": 3,
  os: 4,
  task: 5,
  learned: 6,
  aesthetics: 7,
  default: 8,
} as const

export type Level = keyof typeof PRIORITY

export interface Candidate<T> {
  rule: RuleId
  level: Level
  value: T
  because: string
}

/**
 * Picks the candidate with the highest priority (the first one listed among equals), records the decision and
 * whatever it overrode in the trace, and returns its value. There is always a default candidate, so it never fails.
 */
export function decide<T>(trace: TraceEntry[], subject: string, candidates: Array<Candidate<T> | false | undefined | null>): T {
  const live = candidates.filter((c): c is Candidate<T> => Boolean(c))
  let winner = live[0]
  for (const c of live) if (PRIORITY[c.level] < PRIORITY[winner.level]) winner = c
  const overrode = live.filter((c) => c !== winner && !same(c.value, winner.value)).map(({ rule, value, because }) => ({ rule, value, because }))
  trace.push({ rule: winner.rule, level: winner.level, subject, value: winner.value, because: winner.because, ...(overrode.length ? { overrode } : {}) })
  return winner.value
}

const same = (a: unknown, b: unknown) => a === b || (a !== null && b !== null && typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b))
