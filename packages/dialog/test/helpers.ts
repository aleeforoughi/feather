import fs from "node:fs"
import path from "node:path"
import type { Experience, IRNode } from "@aleeforoughi/feather-intent"
import { compose, type LayoutPlan } from "@aleeforoughi/feather-liquid"
type RenderContext = NonNullable<Parameters<typeof compose>[1]>
import { createDialog, type DialogOptions, type Turn } from "../src/index.ts"

export const TEXT: RenderContext = { device: { surface: "terminal" } }
export const WEB: RenderContext = { device: { surface: "desktop" } }

export const fixturesDir = path.resolve(import.meta.dirname, "../../../conformance/ir/valid")
export const fixtureNames = fs.readdirSync(fixturesDir).filter((f) => f.endsWith(".json")).sort()
export const fixture = (name: string): Experience => JSON.parse(fs.readFileSync(path.join(fixturesDir, name), "utf8")).ir

export function experience(nodes: IRNode[], extra: Partial<Experience> = {}): Experience {
  return { ir: "feather.ir/0", experience: "test", nodes, ...extra }
}

export function planOf(ir: Experience, context: RenderContext = TEXT): LayoutPlan {
  const result = compose(ir, context)
  if (!result.ok) throw new Error(`does not compose: ${result.issues.map((i) => i.message).join("; ")}`)
  return result.plan
}

export function dialogOf(ir: Experience, context: RenderContext = TEXT, options?: DialogOptions) {
  return createDialog(planOf(ir, context), options)
}

export const texts = (turn: Turn, kind?: string) => turn.parts.filter((p) => kind === undefined || p.kind === kind).map((p) => p.text)
export const labels = (turn: Turn) => turn.choices.map((c) => c.label)
/** The number of the choice for a node and act. */
export function numberOf(turn: Turn, node: string, act?: string): string {
  const c = turn.choices.find((x) => x.node === node && (act === undefined || x.act === act))
  if (!c) throw new Error(`no choice for ${node} ${act ?? ""}`)
  return String(c.n)
}
