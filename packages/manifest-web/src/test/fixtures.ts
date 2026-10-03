// The valid conformance fixtures, loaded for tests, and a spy that fails a test on any console error or warning (a React
// warning is one).
import fs from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, vi } from "vitest"

const dir = path.resolve(import.meta.dirname, "../../../../conformance/ir/valid")

export const FIXTURES = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((file) => ({ name: file.replace(/\.json$/, ""), ir: JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")).ir as unknown }))

export function fixture(name: string): unknown {
  const found = FIXTURES.find((f) => f.name === name)
  if (!found) throw new Error(`no fixture ${name}`)
  return found.ir
}

/** Fails the test that logs a console error or warning. Call at the top of a describe. */
export function failOnConsole() {
  const spies: Array<ReturnType<typeof vi.spyOn>> = []
  beforeEach(() => {
    for (const method of ["error", "warn"] as const) spies.push(vi.spyOn(console, method))
  })
  afterEach(() => {
    const calls = spies.flatMap((spy) => spy.mock.calls)
    spies.splice(0).forEach((spy) => spy.mockRestore())
    if (calls.length > 0) throw new Error(`console output during the test:\n${calls.map((c) => c.map(String).join(" ")).join("\n")}`)
  })
}
