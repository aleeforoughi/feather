import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { PassThrough } from "node:stream"
import { createDialog } from "@aleeforoughi/feather-dialog"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import { beforeAll, describe, expect, it } from "vitest"
import { renderTurn, runText } from "../src/index.ts"
import { fixtureFile, plan } from "./helpers.ts"

const load = (name: string) => JSON.parse(fs.readFileSync(fixtureFile(name), "utf8")).ir

function streams() {
  const input = new PassThrough()
  const output = new PassThrough()
  let written = ""
  output.on("data", (chunk: Buffer) => (written += chunk.toString("utf8")))
  return { input, output, text: () => written }
}

describe("a Form in text", () => {
  it("asks the poster form in one conversation, reads every answer back, and sends one reply", async () => {
    const { input, output, text } = streams()
    const replies: ReplyEvent[] = []
    input.end(["1", "9am to 2pm", "2026-03-07", "skip", "25", "sam@example.com", "change 3", "Pier 7", "send", ""].join("\n"))
    const result = await runText(plan(load("poster-details-form.json")), { input, output, onReply: (r) => void replies.push(r) })
    expect(replies).toEqual([
      { experience: "poster_details", node: "details", act: "submit", value: { market_time: "9am to 2pm", opening_date: "2026-03-07", venue: "Pier 7", stall_fee: 25, contact: "sam@example.com" } },
    ])
    expect(result.replies).toEqual(replies)
    const out = text().replace(/\s+/g, " ")
    expect(out).toContain("5 questions.")
    expect(out).toContain('Question 4 of 5: Stall fee (an amount in AED of at least 0). Say "skip" to leave it out.')
    expect(out).toContain('3. Venue address: "Pier 7".')
    expect(out).toContain("Noted: 5 answers.")
    expect(out).not.toMatch(new RegExp(String.fromCharCode(27)))
  })

  it("sends nothing when the input ends before the person sends", async () => {
    const { input, output } = streams()
    const replies: ReplyEvent[] = []
    input.end(["1", "Sam", "1 Marina Walk", "Dubai", "skip", ""].join("\n"))
    const result = await runText(plan(load("shipping-address-form.json")), { input, output, onReply: (r) => void replies.push(r) })
    expect(replies).toEqual([])
    expect(result.done).toBe(false)
  })

  it("skips the poster form with one skip reply", async () => {
    const { input, output } = streams()
    const replies: ReplyEvent[] = []
    input.end("2\n")
    await runText(plan(load("poster-details-form.json")), { input, output, onReply: (r) => void replies.push(r) })
    expect(replies).toEqual([{ experience: "poster_details", node: "details", act: "skip" }])
  })

  it("renders the read-back as numbered lines with the question last, and the questions with a prompt", () => {
    const d = createDialog(plan(load("shipping-address-form.json")))
    d.answer("1")
    for (const line of ["Sam", "1 Marina Walk", "Dubai", "skip"]) d.answer(line)
    const out = renderTurn(d.turn, { width: 60 })
    expect(out).toBe(
      [
        "Your answers:",
        '1. Full name: "Sam".',
        '2. Street and number: "1 Marina Walk".',
        '3. City: "Dubai".',
        "4. Phone for the courier: not answered.",
        "",
        'Say "send" to give the shipping address, or "change" and a',
        "number from 1 to 4 or a field name.",
        "> ",
      ].join("\n"),
    )
  })
})

describe("feather-text with a Form", () => {
  const root = path.resolve(import.meta.dirname, "..")
  const cli = path.join(root, "dist/cli.js")
  beforeAll(() => {
    if (!fs.existsSync(cli)) execFileSync("pnpm", ["build"], { cwd: root, stdio: "ignore" })
  }, 120_000)

  it("writes the one submit reply to stdout and the conversation to stderr", async () => {
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [cli, fixtureFile("shipping-address-form.json")], { stdio: ["pipe", "pipe", "pipe"] })
      let stdout = ""
      let stderr = ""
      child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")))
      child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")))
      child.on("error", reject)
      child.on("close", () => resolve({ stdout, stderr }))
      child.stdin.end("1\nSam Rivera\n1 Marina Walk\nDubai\n+971 50 123 4567\nsend\n")
    })
    expect(result.stdout).toBe('{"experience":"shipping_address","node":"address","act":"submit","value":{"name":"Sam Rivera","street":"1 Marina Walk","city":"Dubai","phone":"+971 50 123 4567"}}\n')
    expect(result.stderr).toContain("Question 1 of 4, required: Full name")
  })
})
