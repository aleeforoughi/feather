import { PassThrough } from "node:stream"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import { describe, expect, it } from "vitest"
import { canStyle, runText } from "../src/index.ts"
import { campaign, plan } from "./helpers.ts"

const ESC = new RegExp(String.fromCharCode(27))
const BOLD = new RegExp(`${String.fromCharCode(27)}\\[1m`)

/** Streams as a test sees them: lines in, text out. */
function streams(options: { tty?: boolean } = {}) {
  const input = new PassThrough()
  const output = new PassThrough()
  if (options.tty) (output as unknown as { isTTY: boolean }).isTTY = true
  let written = ""
  output.on("data", (chunk: Buffer) => (written += chunk.toString("utf8")))
  return { input, output, text: () => written }
}

describe("runText", () => {
  it("completes ad-campaign-launch end to end: the spend is confirmed only by typing the keyword", async () => {
    const { input, output, text } = streams()
    const replies: ReplyEvent[] = []
    input.end(["1", "yes", "confirm spend", "Confirm", "1", "2", "300 usd", ""].join("\n"))
    const result = await runText(plan(campaign()), { input, output, onReply: (r) => void replies.push(r), experience: campaign() })
    expect(replies).toEqual([
      { experience: "approve_campaign", node: "go", act: "confirm" },
      { experience: "approve_campaign", node: "rec", act: "accept" },
      { experience: "approve_campaign", node: "own", act: "choose", value: { amount: 300, currency: "USD" } },
    ])
    expect(result.replies).toEqual(replies)
    expect(result.done).toBe(false) // "less" is still on offer; the input closed
    const out = text()
    expect(out).toContain("Spends AED 1,050")
    expect(out).toContain('Type "confirm" to go ahead, or "cancel".')
    // "1" opened the confirm; "yes" and the label did nothing; "Confirm" committed.
    expect(out.match(/Nothing was done\./g)).toHaveLength(2)
    expect(out).toContain("Confirmed: spends AED 1,050.")
    expect(out).not.toMatch(ESC)
  })

  it("never sends the spend without the keyword", async () => {
    const { input, output } = streams()
    const replies: ReplyEvent[] = []
    input.end("1\n1\nyes\nok\ngo\n")
    await runText(plan(campaign()), { input, output, onReply: (r) => void replies.push(r) })
    expect(replies).toEqual([])
  })

  it("backing out of the spend sends cancel", async () => {
    const { input, output } = streams()
    const replies: ReplyEvent[] = []
    input.end("confirm spend\ncancel\n")
    await runText(plan(campaign()), { input, output, onReply: (r) => void replies.push(r) })
    expect(replies).toEqual([{ experience: "approve_campaign", node: "go", act: "cancel" }])
  })

  it("ends when the dialog is done, without waiting for the input to close", async () => {
    const { input, output, text } = streams()
    const replies: ReplyEvent[] = []
    const ir = { ir: "feather.ir/1", experience: "x", nodes: [{ type: "Action", id: "a", intent: "save it" }] }
    input.write("1\n") // never ended
    const result = await runText(plan(ir), { input, output, onReply: (r) => void replies.push(r) })
    expect(result.done).toBe(true)
    expect(replies).toEqual([{ experience: "x", node: "a", act: "activate" }])
    expect(text()).toContain("Done: Save it.")
  })

  it("returns at once for an experience with nothing to act on", async () => {
    const { input, output, text } = streams()
    const ir = { ir: "feather.ir/1", experience: "x", nodes: [{ type: "Text", id: "t", text: "Hello" }] }
    const result = await runText(plan(ir), { input, output, onReply: () => {} })
    expect(result).toEqual({ done: true, replies: [] })
    expect(text()).toBe("Hello\n")
  })

  it("waits for an async onReply before the next turn", async () => {
    const { input, output } = streams()
    const order: string[] = []
    input.end("3\n")
    await runText(plan(campaign()), {
      input,
      output,
      onReply: async () => {
        await new Promise((r) => setTimeout(r, 5))
        order.push("reply")
      },
    })
    expect(order).toEqual(["reply"])
  })

  it("echoes typed lines for a pipe, wraps at the width, and reads values back when asked", async () => {
    const { input, output, text } = streams()
    const replies: ReplyEvent[] = []
    input.end("4\n500\nyes\n")
    await runText(plan(campaign()), { input, output, width: 40, readback: true, onReply: (r) => void replies.push(r) })
    expect(replies).toEqual([{ experience: "approve_campaign", node: "own", act: "choose", value: { amount: 500, currency: "AED" } }])
    expect(text()).toContain("> 500\n")
    expect(text()).toContain("You said AED 500.")
    for (const line of text().split("\n")) expect([...line].length, line).toBeLessThanOrEqual(42)
  })

  describe("color", () => {
    const run = async (tty: boolean, env?: string, color?: boolean) => {
      const { input, output, text } = streams({ tty })
      input.end("")
      const saved = process.env.NO_COLOR
      if (env === undefined) delete process.env.NO_COLOR
      else process.env.NO_COLOR = env
      try {
        await runText(plan(campaign()), { input, output, onReply: () => {}, color })
      } finally {
        if (saved === undefined) delete process.env.NO_COLOR
        else process.env.NO_COLOR = saved
      }
      return text()
    }

    it("is bold only on a TTY with NO_COLOR unset", async () => {
      expect(await run(true, undefined)).toMatch(BOLD)
      expect(await run(true, "1")).not.toMatch(ESC)
      expect(await run(false, undefined)).not.toMatch(ESC)
      expect(await run(true, "")).toMatch(BOLD)
    })

    it("can be forced either way", async () => {
      expect(await run(false, undefined, true)).toMatch(BOLD)
      expect(await run(true, undefined, false)).not.toMatch(ESC)
    })

    it("canStyle follows the TTY and NO_COLOR", () => {
      expect(canStyle({ isTTY: true }, {})).toBe(true)
      expect(canStyle({ isTTY: true }, { NO_COLOR: "1" })).toBe(false)
      expect(canStyle({}, {})).toBe(false)
      expect(canStyle(undefined, {})).toBe(false)
    })
  })
})
