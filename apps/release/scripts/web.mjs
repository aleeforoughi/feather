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

/** Every file and folder of the web bundle, relative to dist. The runtime and the helpers it shares with its chunks
 * (feather-page-shared.js) load on every page. The rest load only where a page needs them, from beside the runtime:
 * the Three.js chunk where a 3D scene runs, the media family (gallery, comparison, story, testimonials, journal, form,
 * showreel) and the flows family (quiz, booking, calculator, chart, places, podcast, the scheme toggle, the view switch)
 * where the page's document uses one, and the parts chunk where a gallery opens an image. */
export const WEB_FILES = ["feather-page.css", "feather-page-runtime.js", "feather-page-shared.js", "feather-page-three.js", "feather-page-media.js", "feather-page-flows.js", "feather-page-parts.js", "fonts"]

/** The family chunks, and the blocks whose code must never be in the runtime (their data-slot prefixes). */
const FAMILIES = {
  "feather-page-media.js": ["gallery", "comparison", "story", "testimonials", "journal", "form", "showreel"],
  "feather-page-flows.js": ["quiz", "booking", "calculator", "chart", "places", "podcast", "scheme-toggle", "work-view", "view-switch"],
}
/** What every page downloads (the runtime and the chunks it imports statically), in gzip: Feather 1.22.0's runtime
 * (158.0 KB) plus 10%. A gate: wave 5 put the page blocks in families so a plain page does not pay for them. */
export const EAGER_BUDGET = 174_000

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
  // The lazy chunks load by a relative dynamic import, never statically: the Three.js chunk and the two families.
  for (const chunk of ["feather-page-three.js", ...Object.keys(FAMILIES)]) {
    const name = chunk.replace(/[.-]/g, (c) => `\\${c}`)
    if (!new RegExp(`import\\s*\\(\\s*["']\\./${name}["']\\s*\\)`).test(runtime) && !js.some((f) => f !== "feather-page-runtime.js" && new RegExp(`import\\s*\\(\\s*["']\\./${name}["']\\s*\\)`).test(read(f)))) problems.push(`nothing loads ./${chunk} by a relative dynamic import`)
    if (new RegExp(`^\\s*import\\s[^(]*["']\\./${name}["']`, "m").test(runtime)) problems.push(`feather-page-runtime.js imports ${chunk} statically`)
  }
  // No family's blocks in the runtime, or in the chunks every page loads with it.
  const eager = ["feather-page-runtime.js", ...relative(runtime).filter((d) => !/^\s*$/.test(d) && new RegExp(`^\\s*import\\s[^(]*["']\\./${d.replace(/[.-]/g, (c) => `\\${c}`)}["']`, "m").test(runtime))]
  for (const f of eager) {
    for (const [chunk, blocks] of Object.entries(FAMILIES)) {
      for (const block of blocks) if (new RegExp(`"data-slot":\\s*"${block}[-"]`).test(read(f))) problems.push(`${f} holds the ${block} block's code, which belongs in ${chunk}`)
    }
  }
  for (const f of WEB_FILES.filter((f) => f.endsWith(".js"))) {
    const bytes = fs.readFileSync(path.join(dist, f))
    console.log(`${f}: ${kb(bytes.length)}, ${kb(gzipSync(bytes).length)} gzip${eager.includes(f) ? " (every page)" : ""}`)
  }
  const eagerBytes = eager.reduce((sum, f) => sum + gzipSync(fs.readFileSync(path.join(dist, f))).length, 0)
  console.log(`every page: ${eager.join(" + ")} = ${kb(eagerBytes)} gzip (budget ${kb(EAGER_BUDGET)})`)
  if (eagerBytes > EAGER_BUDGET) problems.push(`every page downloads ${kb(eagerBytes)} gzip (${eager.join(" + ")}), over the ${kb(EAGER_BUDGET)} budget`)
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
