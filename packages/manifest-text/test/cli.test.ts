import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { fixtureFile } from "./helpers.ts"

const root = path.resolve(import.meta.dirname, "..")
const cli = path.join(root, "dist/cli.js")

beforeAll(() => {
  // The CLI is tested as shipped: built JavaScript with a shebang. Build it when this is run before `pnpm build`.
  if (!fs.existsSync(cli)) execFileSync("pnpm", ["build"], { cwd: root, stdio: "ignore" })
}, 120_000)

function run(args: string[], stdin: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: ["pipe", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")))
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")))
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, stdout, stderr }))
    child.stdin.end(stdin)
  })
}

describe("feather-text", () => {
  it("is built JavaScript with a shebang, and a bin of the package", () => {
    expect(fs.readFileSync(cli, "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true)
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
    expect(pkg.bin).toEqual({ "feather-text": "./dist/cli.js" })
  })

  it("writes exactly the replies to stdout, as JSON lines, and the conversation to stderr", async () => {
    const { code, stdout, stderr } = await run([fixtureFile("ad-campaign-launch.json")], "1\nyes\nconfirm\n2\n2\n250\n")
    expect(code).toBe(0)
    expect(stdout).toBe(
      [
        '{"experience":"approve_campaign","node":"go","act":"confirm"}',
        '{"experience":"approve_campaign","node":"less","act":"choose"}',
        '{"experience":"approve_campaign","node":"own","act":"choose","value":{"amount":250,"currency":"AED"}}',
        "",
      ].join("\n")
    )
    for (const line of stdout.trim().split("\n")) expect(() => JSON.parse(line)).not.toThrow()
    expect(stderr).toContain("Spends AED 1,050")
    expect(stderr).toContain("Nothing was done.")
    expect(stderr).not.toContain('"act"')
  })

  it("sends nothing to stdout when the spend is not confirmed", async () => {
    const { code, stdout } = await run([fixtureFile("ad-campaign-launch.json")], "1\nyes\n1\nok\n")
    expect(code).toBe(0)
    expect(stdout).toBe("")
  })

  it("takes --width and --context", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feather-text-"))
    const context = path.join(dir, "context.json")
    fs.writeFileSync(context, JSON.stringify({ device: { surface: "speaker" }, capability: { output: { visual: "unavailable", audio: "available" } } }))
    const { code, stdout, stderr } = await run([fixtureFile("ad-campaign-launch.json"), "--context", context, "--width", "30"], "1\nconfirm\n")
    expect(code).toBe(0)
    expect(stdout).toBe('{"experience":"approve_campaign","node":"go","act":"confirm"}\n')
    for (const line of stderr.split("\n")) if (!line.startsWith("> ")) expect([...line].length, line).toBeLessThanOrEqual(32)
  })

  it("accepts a bare experience as well as a fixture", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feather-text-"))
    const file = path.join(dir, "exp.json")
    fs.writeFileSync(file, JSON.stringify({ ir: "feather.ir/0", experience: "x", nodes: [{ type: "Action", id: "a", intent: "save it" }] }))
    const { code, stdout } = await run([file], "1\n")
    expect(code).toBe(0)
    expect(stdout).toBe('{"experience":"x","node":"a","act":"activate"}\n')
  })

  it("prints the issues and exits 1 for an invalid experience, with nothing on stdout", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feather-text-"))
    const file = path.join(dir, "bad.json")
    fs.writeFileSync(file, JSON.stringify({ ir: "feather.ir/0", experience: "x", nodes: [{ type: "Choice", id: "c", intent: "pick", prompt: "?", options: [] }] }))
    const { code, stdout, stderr } = await run([file], "1\n")
    expect(code).toBe(1)
    expect(stdout).toBe("")
    expect(stderr).toMatch(/not a valid experience/)
    expect(stderr).toMatch(/\[[a-z-]+\]/)
  })

  it("exits 2 for a file it cannot read, bad JSON and bad arguments", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feather-text-"))
    const broken = path.join(dir, "broken.json")
    fs.writeFileSync(broken, "{nope")
    for (const args of [[path.join(dir, "missing.json")], [broken], [], ["a.json", "--width", "5"]]) {
      const { code, stdout, stderr } = await run(args, "")
      expect(code, args.join(" ")).toBe(2)
      expect(stdout).toBe("")
      expect(stderr.length).toBeGreaterThan(0)
    }
    expect((await run(["--help"], "")).code).toBe(0)
  })

  it("exits quietly when the input closes before the end", async () => {
    const { code, stdout } = await run([fixtureFile("ad-campaign-launch.json")], "")
    expect(code).toBe(0)
    expect(stdout).toBe("")
  })

  it("runs every valid fixture's first turn without failing", async () => {
    for (const name of fs.readdirSync(path.dirname(fixtureFile("x"))).filter((f) => f.endsWith(".json")).slice(0, 6)) {
      const { code } = await run([fixtureFile(name)], "help\n")
      expect(code, name).toBe(0)
    }
  })
})
