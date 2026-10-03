// Builds the feather-sdk wheel with the browser bundle inside it: copies packages/embed/dist (run `pnpm build`
// first) into feather_sdk/static, then `pip wheel`. Usage: node packages/python/scripts/build-wheel.mjs [outDir]
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const pkg = resolve(here, "..")
const bundle = resolve(pkg, "../embed/dist")
const out = resolve(process.argv[2] ?? join(pkg, "dist"))
if (!existsSync(join(bundle, "feather-embed.js"))) {
  console.error(`No browser bundle in ${bundle}. Run \`pnpm build\` first.`)
  process.exit(1)
}
const target = join(pkg, "feather_sdk", "static")
rmSync(target, { recursive: true, force: true })
cpSync(bundle, target, { recursive: true, filter: (src) => !src.endsWith(".d.ts") })
rmSync(join(pkg, "build"), { recursive: true, force: true })
execFileSync("python3", ["-m", "pip", "wheel", pkg, "--no-deps", "-w", out], { stdio: "inherit" })
rmSync(join(pkg, "build"), { recursive: true, force: true })
console.log(`feather-sdk wheel in ${out}`)
