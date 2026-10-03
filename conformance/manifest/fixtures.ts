// The valid IR fixtures, loaded from conformance/ir/valid, and the context that routes an experience to each body.
import fs from "node:fs"
import path from "node:path"
import type { RenderContext } from "@aleeforoughi/feather-context"
import type { Experience } from "@aleeforoughi/feather-intent"
import { compose, REFERENCE_CONTEXTS, type LayoutPlan } from "@aleeforoughi/feather-liquid"

const dir = path.resolve(import.meta.dirname, "../ir/valid")

export interface Fixture {
  name: string
  ir: Experience
}

export const FIXTURES: Fixture[] = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((file) => ({ name: file.replace(/\.json$/, ""), ir: JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")).ir as Experience }))

export type Body = "web" | "switch" | "text" | "voice"
export const BODIES: Body[] = ["web", "switch", "text", "voice"]

/** The contexts docs/manifestations.md section 5 gives each body. */
export const CONTEXTS: Record<Body, RenderContext> = {
  web: { device: { surface: "desktop" } },
  switch: { capability: { input: { switch: true } } },
  voice: REFERENCE_CONTEXTS.screenless.context,
  text: { device: { surface: "terminal" } },
}

/** The plan of a fixture for a body; throws when it does not compose or the composer routes it to another body. */
export function planFor(ir: Experience, body: Body): LayoutPlan {
  const result = compose(ir, CONTEXTS[body])
  if (!result.ok) throw new Error(`${ir.experience} does not compose for ${body}: ${result.issues.map((i) => i.message).join("; ")}`)
  if (result.plan.manifestation !== body) throw new Error(`${ir.experience} composed for ${body} came out as ${result.plan.manifestation}`)
  return result.plan
}
