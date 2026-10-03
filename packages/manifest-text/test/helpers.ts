import fs from "node:fs"
import path from "node:path"
import type { Experience } from "@aleeforoughi/feather-intent"
import { compose } from "@aleeforoughi/feather-liquid"

export const fixturesDir = path.resolve(import.meta.dirname, "../../../conformance/ir/valid")
export const fixtureFile = (name: string) => path.join(fixturesDir, name)
export const campaign = (): Experience => JSON.parse(fs.readFileSync(fixtureFile("ad-campaign-launch.json"), "utf8")).ir

export function plan(ir: unknown, context: Parameters<typeof compose>[1] = { device: { surface: "terminal" } }) {
  const result = compose(ir, context)
  if (!result.ok) throw new Error(`does not compose: ${result.issues.map((i) => i.message).join("; ")}`)
  return result.plan
}
