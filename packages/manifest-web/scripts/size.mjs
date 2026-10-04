// The size target (docs/PLAN.md section 9): @aleeforoughi/feather-liquid and manifest-web, minified and gzipped,
// excluding React, stay under 60 KB. Feather's own composing layer is measured as a product would bundle it: the
// composer, the IR, the dialog engine and the plan renderer, with React and the component library (feather-react,
// feather-tokens and what they bring) left to the product. The full figure, with the component library bundled in,
// is printed for information and not gated. Run after `pnpm build`: the workspace packages resolve to their dist.
import { writeFileSync, rmSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { resolve } from "node:path"
import { build } from "vite"

const BUDGET = 60 * 1024
const here = resolve(import.meta.dirname, "..")
const entry = resolve(here, ".size-entry.mjs")
writeFileSync(entry, 'export * from "@aleeforoughi/feather-liquid"\nexport * from "@aleeforoughi/feather-manifest-web"\n')

const react = ["react", "react-dom"]
const library = [...react, "@aleeforoughi/feather-react", "@aleeforoughi/feather-tokens"]

async function measure(external) {
  const out = await build({
    configFile: false,
    root: here,
    logLevel: "silent",
    build: {
      write: false,
      minify: true,
      lib: { entry, formats: ["es"], fileName: "size" },
      rolldownOptions: { external: (id) => external.some((dep) => id === dep || id.startsWith(`${dep}/`)) },
    },
  })
  const code = [out].flat().flatMap((o) => o.output).filter((c) => c.type === "chunk").map((c) => c.code).join("\n")
  return gzipSync(code, { level: 9 }).length
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
try {
  const own = await measure(library)
  const full = await measure(react)
  console.log(`liquid + manifest-web, gzipped, without React or the component library: ${kb(own)} (budget ${kb(BUDGET)})`)
  console.log(`with the component library bundled in (not gated): ${kb(full)}`)
  if (own > BUDGET) {
    console.error(`Over the size budget by ${kb(own - BUDGET)}.`)
    process.exitCode = 1
  }
} finally {
  rmSync(entry, { force: true })
}
