// The 2-CPU render gate (docs/proposals/2026-11-24-range.md section 6): `feather-page build` of one direction (a page
// document in a brand), every route, in 500 ms or less. CI runs it pinned to two cores:
//
//   taskset -c 0,1 node scripts/render-gate.mjs
//
// In-process, on the built page package (run `pnpm build` first): every template and every reference example, in each
// of the three reference brands. Each direction is built once to warm up, then five times; the median of the five
// (validate, the layout check, render every route, write the files) must stay within the budget. The budget is never
// raised: a page that misses it gets a faster render path.
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const BUDGET_MS = 500
const RUNS = 5
const root = path.join(import.meta.dirname, "..")
const pkg = path.join(root, "packages/page")
const dist = path.join(pkg, "dist/index.js")
if (!fs.existsSync(dist)) {
  console.error("render gate: build the page package first (pnpm build)")
  process.exit(2)
}
const need = createRequire(path.join(pkg, "package.json"))
const load = (p) => import(pathToFileURL(p).href)
const lib = await load(dist)
const { buildPage } = await load(path.join(pkg, "bin/build.mjs"))
const { TEMPLATES, otherSet } = await load(path.join(pkg, "templates/index.js"))
const React = await load(need.resolve("react"))
const server = await load(need.resolve("react-dom/server"))

const BRANDS = ["studio", "portrait", "seed"]
const theme = (name) => JSON.parse(fs.readFileSync(path.join(root, `packages/tokens/themes/${name}.json`), "utf8")).tokens
const examples = fs.readdirSync(path.join(pkg, "examples")).filter((f) => f.endsWith(".page.json")).sort()
const documents = [
  ...Object.entries(TEMPLATES).map(([name, t]) => ({ name: `template ${name}`, doc: t.page })),
  ...examples.map((f) => ({ name: `example ${f.replace(".page.json", "")}`, doc: JSON.parse(fs.readFileSync(path.join(pkg, "examples", f), "utf8")) })),
]

const tmpBase = process.env.TMPDIR && fs.existsSync(process.env.TMPDIR) ? process.env.TMPDIR : os.tmpdir()
const work = fs.mkdtempSync(path.join(tmpBase, "feather-render-gate-"))
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

/** One build of a direction, timed: validate, check the layout in the brand, render and write every route. */
function build(doc, tokens, out) {
  const start = performance.now()
  const result = lib.validatePage(doc)
  if (!result.ok) throw new Error(result.issues.map((i) => `${i.path} ${i.code}: ${i.message}`).join("\n"))
  const issues = lib.checkLayout(result.page, tokens)
  if (issues.length) throw new Error(issues.map((i) => `${i.path} ${i.code}: ${i.message}`).join("\n"))
  const routes = buildPage({ lib, React, server, page: result.page, tokens, out })
  return { ms: performance.now() - start, routes }
}

const rows = []
try {
  for (const { name, doc } of documents) {
    for (const brand of BRANDS) {
      const tokens = theme(brand)
      // A page with a scheme toggle needs the brand's own other set.
      const direction = doc.scheme ? { ...doc, scheme: { ...doc.scheme, colors: otherSet(tokens.colors) } } : doc
      const out = path.join(work, `${name.replace(/\W+/g, "-")}-${brand}`)
      build(direction, tokens, out)
      const runs = Array.from({ length: RUNS }, () => build(direction, tokens, out))
      rows.push({ name, brand, routes: runs[0].routes, median: median(runs.map((r) => r.ms)), max: Math.max(...runs.map((r) => r.ms)) })
    }
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}

const cpus = os.availableParallelism?.() ?? os.cpus().length
console.log(`render gate: feather-page build of one direction, all routes, median of ${RUNS} after a warm-up, budget ${BUDGET_MS} ms (${cpus} CPU${cpus === 1 ? "" : "s"} available)`)
for (const r of rows) console.log(`  ${r.median <= BUDGET_MS ? "ok  " : "FAIL"} ${`${r.name}, ${r.brand}`.padEnd(46)} ${String(r.routes).padStart(2)} routes  median ${r.median.toFixed(1).padStart(6)} ms  max ${r.max.toFixed(1).padStart(6)} ms`)
const over = rows.filter((r) => r.median > BUDGET_MS)
if (over.length) {
  console.error(`render gate: ${over.length} direction${over.length === 1 ? "" : "s"} over ${BUDGET_MS} ms`)
  process.exit(1)
}
console.log(`render gate: every direction within ${BUDGET_MS} ms (slowest ${Math.max(...rows.map((r) => r.median)).toFixed(1)} ms)`)
