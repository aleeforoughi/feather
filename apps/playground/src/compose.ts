// Composing for the playground: parse, compose, and time it.
import type { RenderContext } from "@aleeforoughi/feather-context"
import type { Experience } from "@aleeforoughi/feather-intent"
import { compose, type LayoutPlan } from "@aleeforoughi/feather-liquid"

/** What the left side shows when the IR cannot be rendered. */
export interface Problem {
  path: string
  code: string
  message: string
}

export type Composed = { ok: true; experience: Experience; plan: LayoutPlan } | { ok: false; problems: Problem[] }

export const RUNS = 50

/** Parses the text and composes it; the average of RUNS compositions is the compose time, in milliseconds. */
export function composeText(text: string, context: RenderContext): { composed: Composed; ms: number } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { composed: { ok: false, problems: [{ path: "", code: "invalid-json", message: `This is not valid JSON: ${err instanceof Error ? err.message : String(err)}` }] }, ms: 0 }
  }
  let result = compose(parsed, context)
  const start = performance.now()
  for (let i = 0; i < RUNS; i++) result = compose(parsed, context)
  const ms = (performance.now() - start) / RUNS
  if (!result.ok) return { composed: { ok: false, problems: result.issues.map((i) => ({ path: i.path, code: i.code, message: i.message })) }, ms }
  return { composed: { ok: true, experience: parsed as Experience, plan: result.plan }, ms }
}
