// Writes schema/feather.page-0.json from src/core/spec.ts. Run after changing the block table:
//   pnpm --filter @aleeforoughi/feather-page generate
import fs from "node:fs"
import path from "node:path"
import { pageJsonSchema } from "./json-schema.ts"

const out = path.join(import.meta.dirname, "../schema/feather.page-0.json")
fs.writeFileSync(out, `${JSON.stringify(pageJsonSchema(), null, 2)}\n`)
console.log(`wrote ${path.relative(process.cwd(), out)}`)
