// A turn as plain text (docs/manifestations.md section 2). No meaning depends on color or styling: bold is added only
// when the caller says the output can show it, and only to what the plan emphasizes as critical or primary.
import type { Part, Turn } from "@aleeforoughi/feather-dialog"

export interface RenderOptions {
  /** Where lines wrap, in characters. Default 80. Words are never broken. */
  width?: number
  /** Add ANSI bold to critical and primary parts. Default false: the caller decides (TTY, NO_COLOR). */
  color?: boolean
}

export const DEFAULT_WIDTH = 80

/** Control characters (including ESC) would let a plan's text drive the terminal; they are dropped. Newlines and tabs stay. */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g
const clean = (text: string) => text.replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(CONTROL, "")
const length = (s: string) => [...s].length

/** Wraps at `width` on spaces, never inside a word; a word longer than the width gets a line of its own. */
export function wrap(text: string, width: number, indent = ""): string[] {
  const lines: string[] = []
  for (const paragraph of clean(text).split("\n")) {
    let line = ""
    for (const word of paragraph.split(" ").filter((w) => w !== "")) {
      if (line === "") line = word
      else if (length(indent) + length(line) + 1 + length(word) <= width) line += ` ${word}`
      else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines.map((l, i) => (i === 0 ? l : indent + l))
}

const bold = (line: string) => (line === "" ? line : `\u001b[1m${line}\u001b[22m`)

/**
 * Content first (a blank line between nodes), consequences as their own lines, then the numbered choices
 * (`1. Approve the budget`), then any hint and the question, ending with a `> ` prompt. A turn with no question
 * (done) ends with a newline instead.
 */
export function renderTurn(turn: Turn, options: RenderOptions = {}): string {
  const width = Number.isFinite(options.width) && options.width! >= 10 ? Math.floor(options.width!) : DEFAULT_WIDTH
  const strong = (part: Part) => options.color === true && (part.emphasis === "critical" || part.emphasis === "primary")
  const out: string[] = []

  let previous: string | undefined | null = null
  for (const part of turn.parts) {
    if (part.kind === "question" || part.kind === "hint") continue
    if (previous !== null && part.node !== previous) out.push("")
    previous = part.node
    const lines = wrap(part.text, width)
    out.push(...(strong(part) ? lines.map(bold) : lines))
  }

  if (turn.choices.length > 0) {
    if (out.length > 0) out.push("")
    for (const c of turn.choices) {
      const prefix = `${c.n}. `
      const lines = wrap(c.label, width - length(prefix), "")
      out.push(...lines.map((l, i) => (i === 0 ? prefix : " ".repeat(length(prefix))) + l))
    }
  }

  const hints = turn.parts.filter((p) => p.kind === "hint")
  const questions = turn.parts.filter((p) => p.kind === "question")
  if (hints.length > 0 || questions.length > 0) {
    if (out.length > 0) out.push("")
    for (const part of [...hints, ...questions]) out.push(...wrap(part.text, width))
  }

  const text = out.join("\n")
  if (questions.length > 0) return `${text}\n> `
  return text === "" ? "" : `${text}\n`
}
