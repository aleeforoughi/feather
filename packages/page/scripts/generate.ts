// Writes schema/feather.page-0.json and feather.page-1.json from src/core/spec.ts. Run after changing the tables:
//   pnpm --filter @aleeforoughi/feather-page generate
import fs from "node:fs"
import path from "node:path"
import { pageJsonSchema } from "./json-schema.ts"

for (const version of [0, 1] as const) {
  const out = path.join(import.meta.dirname, `../schema/feather.page-${version}.json`)
  fs.writeFileSync(out, `${JSON.stringify(pageJsonSchema(version), null, 2)}\n`)
  console.log(`wrote ${path.relative(process.cwd(), out)}`)
}
