// Writes foundation.json: a machine-readable catalogue of the foundation (components, exports, slots, stories, theme axes).
// Run after the Storybook build (needs apps/storybook/storybook-static/index.json): `pnpm manifest` from the repo root.
import fs from "node:fs"
import path from "node:path"
import { DENSITY, ELEVATION, FONTS, MOTION, SHAPES, TOKEN_SCHEMA } from "@aleeforoughi/feather-tokens"

const root = path.resolve(import.meta.dirname, "..")
const uiDir = path.join(root, "src/components/ui")
const indexPath = path.resolve(root, "../../apps/storybook/storybook-static/index.json")
if (!fs.existsSync(indexPath)) {
  console.error("apps/storybook/storybook-static/index.json not found. Run `pnpm build-storybook` first.")
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"))
const sorted = (xs) => [...new Set(xs)].sort((a, b) => a.localeCompare(b))

/** Story names per component file, from the Storybook index (importPath ties a story to its component). */
const storiesByFile = new Map()
for (const entry of Object.values(index.entries ?? {})) {
  if (entry.type !== "story") continue
  const name = path.basename(entry.importPath).replace(/\.stories\.tsx?$/, "")
  if (!storiesByFile.has(name)) storiesByFile.set(name, [])
  storiesByFile.get(name).push(entry.name)
}

function exportsOf(source) {
  const names = []
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const t = part.trim().split(/\s+as\s+/).pop()
      if (t) names.push(t)
    }
  }
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) names.push(m[1])
  return sorted(names)
}

const components = fs
  .readdirSync(uiDir)
  .filter((f) => f.endsWith(".tsx") && !f.endsWith(".stories.tsx"))
  .sort()
  .map((file) => {
    const name = file.replace(/\.tsx$/, "")
    const source = fs.readFileSync(path.join(uiDir, file), "utf8")
    // A molecule composes atoms or behaviour into a reusable pattern (stories under "Molecules/"); an organism renders
    // one Experience IR node as a whole interaction (stories under "Organisms/").
    const storyFile = path.join(uiDir, `${name}.stories.tsx`)
    const stories = fs.existsSync(storyFile) ? fs.readFileSync(storyFile, "utf8") : ""
    const level = /title:\s*"Organisms\//.test(stories) ? "organism" : /title:\s*"Molecules\//.test(stories) ? "molecule" : "atom"
    return {
      name,
      level,
      file: `src/components/ui/${file}`,
      exports: exportsOf(source),
      slots: sorted([...source.matchAll(/data-slot="([^"]+)"/g)].map((m) => m[1])),
      stories: sorted(storiesByFile.get(name) ?? []),
    }
  })

const manifest = {
  name: pkg.name,
  version: pkg.version,
  tokenSchema: TOKEN_SCHEMA,
  themeAxes: {
    shape: Object.keys(SHAPES),
    density: Object.keys(DENSITY),
    elevation: Object.keys(ELEVATION),
    motion: Object.keys(MOTION),
  },
  fonts: Object.keys(FONTS).sort(),
  components,
}

fs.writeFileSync(path.join(root, "foundation.json"), `${JSON.stringify(manifest, null, 2)}\n`)
const total = components.reduce((n, c) => n + c.stories.length, 0)
console.log(`foundation.json written: ${components.length} components, ${total} stories`)
