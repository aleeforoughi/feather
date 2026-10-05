#!/usr/bin/env node
// feather-ir: validate Experience IR documents.
//
//   feather-ir validate <file.json>...
//
// Prints every problem with its path and code; exits 1 if any document is invalid. A conformance fixture
// ({ "description", "ir": {...} }) is checked by its "ir".
import fs from "node:fs"
import { formatIssues, validate } from "../dist/index.js"

const [command, ...files] = process.argv.slice(2)
if (command !== "validate" || files.length === 0) {
  console.error("Usage: feather-ir validate <file.json>...")
  process.exit(2)
}
let failed = false
for (const file of files) {
  let doc
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"))
  } catch (err) {
    console.error(`${file}: cannot read JSON (${err.message})`)
    failed = true
    continue
  }
  if (doc && typeof doc.ir === "object" && doc.ir !== null) doc = doc.ir
  const result = validate(doc)
  if (result.ok) console.log(`${file}: valid feather.ir/1 (${result.experience.nodes.length} nodes)`)
  else {
    failed = true
    console.error(`${file}: ${result.issues.length} problem${result.issues.length === 1 ? "" : "s"}\n${formatIssues(result.issues)}`)
  }
}
process.exit(failed ? 1 : 0)
