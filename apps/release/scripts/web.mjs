#!/usr/bin/env node
// The web bundle of a release, feather-page-web-<version>.zip: what a page built with `feather-page build --runtime`
// needs beside it. One list, read by the check (run after every build) and by the zip.
//
//   node scripts/web.mjs check          the runtime holds no Three.js, every chunk it loads is in the bundle, sizes
//   node scripts/web.mjs zip [<out.zip>] writes the zip (default dist/feather-page-web-<version>.zip)
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { gzipSync } from "node:zlib"

const dist = path.join(import.meta.dirname, "../dist")
const version = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../package.json"), "utf8")).version

/** Every file and folder of the web bundle, relative to dist. The Three.js chunk loads only on a page whose 3D scene
 * runs, from beside the runtime. */
export const WEB_FILES = ["feather-page.css", "feather-page-runtime.js", "feather-page-three.js", "fonts"]

const read = (f) => fs.readFileSync(path.join(dist, f), "utf8")
const kb = (n) => `${(n / 1000).toFixed(1)} kB`

function check() {
  const problems = []
  for (const f of WEB_FILES) if (!fs.existsSync(path.join(dist, f))) problems.push(`${f} is missing from dist (run the build)`)
  if (problems.length) return problems
  const runtime = read("feather-page-runtime.js")
  // Three.js's renderer never enters the runtime: only the dynamic import of its chunk does.
  if (/\bWebGLRenderer\b|\bTHREE\.REVISION\b|\bREVISION\s*=\s*"\d+"/.test(runtime)) problems.push("feather-page-runtime.js contains Three.js; it must load feather-page-three.js lazily")
  const relative = (src) => [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.\/[^"']+)["']/g)].map((m) => m[1].slice(2))
  const js = fs.readdirSync(dist).filter((f) => f.endsWith(".js") && f !== "feather-page.mjs")
  for (const f of js) {
    if (!WEB_FILES.includes(f)) problems.push(`dist/${f} is a chunk the runtime may load, but it is not in the web bundle (WEB_FILES)`)
    for (const dep of relative(read(f))) if (!WEB_FILES.includes(dep)) problems.push(`${f} loads ./${dep}, which is not in the web bundle`)
  }
  if (!/import\s*\(\s*["']\.\/feather-page-three\.js["']\s*\)/.test(runtime)) problems.push("feather-page-runtime.js does not load ./feather-page-three.js by a relative dynamic import")
  if (/^\s*import\s[^(]*["']\.\/feather-page-three\.js["']/m.test(runtime)) problems.push("feather-page-runtime.js imports the Three.js chunk statically")
  for (const f of ["feather-page-runtime.js", "feather-page-three.js"]) {
    const bytes = fs.readFileSync(path.join(dist, f))
    console.log(`${f}: ${kb(bytes.length)}, ${kb(gzipSync(bytes).length)} gzip`)
  }
  return problems
}

const [command, out] = process.argv.slice(2)
if (command === "check" || command === "zip") {
  const problems = check()
  if (problems.length) {
    console.error(`The web bundle is not right:\n- ${problems.join("\n- ")}`)
    process.exit(1)
  }
  if (command === "zip") {
    const target = path.resolve(out ?? path.join(dist, `feather-page-web-${version}.zip`))
    fs.rmSync(target, { force: true })
    execFileSync("zip", ["-qr", target, ...WEB_FILES], { cwd: dist, stdio: "inherit" })
    console.log(`wrote ${target}`)
  } else console.log("The web bundle is complete: the runtime, its Three.js chunk, the stylesheet and the fonts.")
} else if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  console.error("usage: node scripts/web.mjs check | zip [<out.zip>]")
  process.exit(2)
}
