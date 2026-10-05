#!/usr/bin/env node
// feather-text: composes an experience and talks it through in the terminal. The conversation goes to stderr and every
// reply to stdout as one JSON line, so `feather-text exp.json > replies.jsonl` captures exactly the replies.
//
// Exit codes: 0 the conversation ran (finished, or the input closed); 1 the experience is not valid feather.ir/1;
// 2 the command line or a file could not be read.
import fs from "node:fs"
import process from "node:process"
import { formatIssues } from "@aleeforoughi/feather-intent"
import { compose } from "@aleeforoughi/feather-liquid"
import { parseArgs, USAGE } from "./args.ts"
import { runText } from "./run.ts"

type Context = NonNullable<Parameters<typeof compose>[1]>
const TEXT_CONTEXT: Context = { device: { surface: "terminal" } }

function readJson(file: string, what: string): unknown {
  let text: string
  try {
    text = fs.readFileSync(file === "-" ? 0 : file, "utf8")
  } catch (err) {
    throw new Error(`Cannot read ${what} ${file}: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
  }
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(`${what} ${file} is not JSON: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  if (typeof args === "string") {
    process.stderr.write(`${args}\n\n${USAGE}`)
    return 2
  }
  if ("help" in args) {
    process.stdout.write(USAGE)
    return 0
  }

  let document: unknown
  let context: Context = TEXT_CONTEXT
  try {
    document = readJson(args.file, "the experience")
    if (args.context !== undefined) context = readJson(args.context, "the context") as Context
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
    return 2
  }
  // A conformance fixture wraps the experience: { description, ir: { ... } }.
  const wrapped = typeof document === "object" && document !== null && typeof (document as { ir?: unknown }).ir === "object"
  const experience = wrapped ? (document as { ir: unknown }).ir : document

  // Text is always possible, so it runs whatever manifestation the plan chooses.
  const composed = compose(experience, context)
  if (!composed.ok) {
    process.stderr.write(`${args.file} is not a valid experience:\n${formatIssues(composed.issues)}\n`)
    return 1
  }

  await runText(composed.plan, {
    input: process.stdin,
    output: process.stderr,
    width: args.width,
    onReply: (reply) => {
      process.stdout.write(`${JSON.stringify(reply)}\n`)
    },
  })
  return 0
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (err: unknown) => {
    process.stderr.write(`feather-text failed: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exitCode = 2
  }
)
